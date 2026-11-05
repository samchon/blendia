"""Own bounded immutable render PNGs independently of a client's connection."""

import base64
import os
import stat
import struct
import tempfile
import time
import uuid
import zlib
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .file_publish import OwnedStage, destination
from .protocol import BridgeError, require_keys

MAX_PNG_BYTES = 32 * 1024 * 1024
MAX_TOTAL_BYTES = 128 * 1024 * 1024
MAX_ARTIFACTS = 4
MAX_CHUNK_BYTES = 192 * 1024
ARTIFACT_TTL = 600


class ArtifactStore:
    """Retain at most four PNG files with fixed monotonic expiry and exact cleanup."""

    def __init__(self):
        self.session_id = ""
        self.directory = None
        self.entries = {}
        self.stages = set()

    def start(self, session_id):
        """Replace an idle session only after its completed artifacts are released."""
        self.close()
        self.session_id = session_id
        self.directory = Path(tempfile.mkdtemp(prefix="blendia-render-"))

    def reserve(self):
        """Reserve capacity before a native job can create its output."""
        self.expire()
        if self.directory is None:
            raise BridgeError("INVALID_CONTEXT", "No artifact session is active")
        if len(self.entries) + len(self.stages) >= MAX_ARTIFACTS:
            raise BridgeError("LIMIT_EXCEEDED", "Release an artifact before starting another render")
        if sum(entry["metadata"]["bytes"] for entry in self.entries.values()) + MAX_PNG_BYTES > MAX_TOTAL_BYTES:
            raise BridgeError("LIMIT_EXCEEDED", "The retained PNG byte limit would be exceeded")
        descriptor, name = tempfile.mkstemp(prefix="render-", suffix=".png", dir=self.directory)
        os.close(descriptor)
        path = Path(name)
        self.stages.add(path)
        return path

    def adopt(self, path, job):
        """Validate the native file and move it away from its render output pathname."""
        if path not in self.stages:
            raise BridgeError("IO_ERROR", "The render output is not an owned stage", "possible")
        information = path.lstat()
        if not stat.S_ISREG(information.st_mode) or not 33 <= information.st_size <= MAX_PNG_BYTES:
            raise BridgeError("LIMIT_EXCEEDED", "The native PNG is missing or exceeds 32 MiB", "possible")
        with path.open("rb") as stream:
            if self._identity(os.fstat(stream.fileno())) != self._identity(information):
                raise self._png_error("The native output changed before validation")
            width, height = self._validate_png(stream, information.st_size, job)
            if self._identity(os.fstat(stream.fileno())) != self._identity(information):
                raise self._png_error("The native output changed during validation")
        identifier = uuid.uuid4().hex
        target = self.directory / f"artifact-{identifier}.png"
        os.rename(path, target)
        self.stages.remove(path)
        metadata = {"handle": {"sessionId": self.session_id, "artifactId": identifier},
                    "renderId": job["handle"]["renderId"], "startGeneration": job["startGeneration"],
                    "mimeType": "image/png", "bytes": information.st_size,
                    "width": width, "height": height,
                    "expiresAt": (datetime.now(timezone.utc) + timedelta(seconds=ARTIFACT_TTL)).isoformat()}
        self.entries[identifier] = {"path": target, "metadata": metadata,
                                    "expires": time.monotonic() + ARTIFACT_TTL,
                                    "identity": self._identity(target.stat())}
        return metadata

    @staticmethod
    def _validate_png(stream, size, job):
        """Check complete owned RGBA output without reconstructing its pixel colors."""
        if stream.read(8) != b"\x89PNG\r\n\x1a\n":
            raise ArtifactStore._png_error("Missing PNG signature")
        prefix = stream.read(8)
        if len(prefix) != 8 or struct.unpack(">I4s", prefix) != (13, b"IHDR"):
            raise ArtifactStore._png_error("Missing initial IHDR")
        header, checksum = stream.read(13), stream.read(4)
        if (len(header) != 13 or len(checksum) != 4
                or zlib.crc32(b"IHDR" + header) != struct.unpack(">I", checksum)[0]):
            raise ArtifactStore._png_error("Incomplete or corrupt IHDR")
        width, height = struct.unpack(">II", header[:8])
        if not 1 <= width <= 4096 or not 1 <= height <= 4096:
            raise BridgeError("LIMIT_EXCEEDED", "The native PNG dimensions exceed the artifact limit", "possible")
        if width != job["width"] or height != job["height"]:
            raise BridgeError("OUTCOME_UNKNOWN", "The native PNG dimensions do not match this render", "possible")

        # NativeRender fixes 8-bit RGBA; its PNG writer emits non-interlaced rows.
        if header[8:] != b"\x08\x06\x00\x00\x00":
            raise ArtifactStore._png_error("PNG differs from the owned RGBA format")
        row_bytes = width * 4 + 1
        expected = row_bytes * height
        decoder = zlib.decompressobj()
        decoded = 0
        seen_data = False
        data_finished = False
        seen_palette = False
        while stream.tell() < size:
            prefix = stream.read(8)
            if len(prefix) != 8:
                raise ArtifactStore._png_error("Incomplete chunk header")
            length, kind = struct.unpack(">I4s", prefix)
            if (length > size - stream.tell() - 4
                    or any(not (65 <= letter <= 90 or 97 <= letter <= 122) for letter in kind)
                    or kind[2] & 32):
                raise ArtifactStore._png_error("Invalid chunk bounds or type")
            if kind == b"IDAT":
                if data_finished:
                    raise ArtifactStore._png_error("Image data chunks are not consecutive")
                seen_data = True
            else:
                data_finished = seen_data
                if kind == b"PLTE":
                    if seen_palette or seen_data or not 0 < length <= 768 or length % 3:
                        raise ArtifactStore._png_error("Invalid optional palette")
                    seen_palette = True
                elif kind == b"IEND":
                    if length or not seen_data:
                        raise ArtifactStore._png_error("Invalid image ending")
                elif not kind[0] & 32:
                    raise ArtifactStore._png_error("Unexpected critical chunk")
            checksum = zlib.crc32(kind)
            remaining = length
            while remaining:
                block = stream.read(min(65536, remaining))
                if not block:
                    raise ArtifactStore._png_error("Truncated chunk data")
                remaining -= len(block)
                checksum = zlib.crc32(block, checksum)
                if kind == b"IDAT":
                    decoded = ArtifactStore._inflate_png(decoder, block, decoded, expected, row_bytes)
            checksum_bytes = stream.read(4)
            if len(checksum_bytes) != 4 or checksum != struct.unpack(">I", checksum_bytes)[0]:
                raise ArtifactStore._png_error("Incomplete or corrupt chunk checksum")
            if kind == b"IEND":
                if stream.tell() != size or not decoder.eof or decoded != expected:
                    raise ArtifactStore._png_error("Incomplete image data or trailing content")
                return width, height
        raise ArtifactStore._png_error("Missing IEND")

    @staticmethod
    def _inflate_png(decoder, block, total, expected, row_bytes):
        """Bound inflation by dimensions and validate scanline framing, not pixels."""
        if decoder.eof:
            return total
        try:
            while True:
                limit = min(65536, expected - total + 1)
                output = decoder.decompress(block, limit)
                if total + len(output) > expected:
                    raise ArtifactStore._png_error("Image data exceeds the declared dimensions")
                if any(output[index] > 4 for index in range((-total) % row_bytes, len(output), row_bytes)):
                    raise ArtifactStore._png_error("Invalid scanline filter")
                total += len(output)

                # PNG permits padding after the zlib stream; never retain more input.
                if decoder.eof:
                    return total
                block = decoder.unconsumed_tail
                if not block and len(output) < limit:
                    return total
        except zlib.error as error:
            raise ArtifactStore._png_error("Corrupt compressed image data") from error

    @staticmethod
    def _png_error(message):
        """Report invalid native bytes without certifying a retained artifact."""
        return BridgeError("IO_ERROR", message, "possible")

    def read(self, params):
        """Read a bounded range, including an empty EOF page at exactly byte length."""
        require_keys(params, ("artifactId", "offset", "maxBytes"))
        entry = self._entry(params["artifactId"])
        offset, limit = params["offset"], params["maxBytes"]
        total = entry["metadata"]["bytes"]
        if type(offset) is not int or not 0 <= offset <= total:
            raise BridgeError("INVALID_ARGUMENT", "offset is outside the artifact")
        if type(limit) is not int or not 1 <= limit <= MAX_CHUNK_BYTES:
            raise BridgeError("INVALID_ARGUMENT", "maxBytes must be between 1 and 196608")
        with self._open(entry) as stream:
            stream.seek(offset)
            data = stream.read(min(limit, total - offset))
        if len(data) != min(limit, total - offset):
            raise BridgeError("IO_ERROR", "The owned artifact was truncated")
        following = offset + len(data)
        return {"artifactId": params["artifactId"], "offset": offset, "nextOffset": following,
                "totalBytes": total, "dataBase64": base64.b64encode(data).decode("ascii"),
                "eof": following == total}

    def release(self, params):
        """Release one completed artifact without affecting a native render."""
        require_keys(params, ("artifactId",))
        identifier = self._identifier(params["artifactId"])
        if identifier in self.entries:
            self._remove(identifier)
        return {}

    def save(self, params):
        """Export through a distinct inode so user edits cannot change private bytes."""
        require_keys(params, ("artifactId", "path"), ("overwrite",))
        entry = self._entry(params["artifactId"])
        overwrite = params.get("overwrite", False)
        target = destination(params["path"], ".png", overwrite)
        stage = OwnedStage(target, overwrite)
        try:
            with self._open(entry) as source, stage.path.open("wb") as output:
                remaining = entry["metadata"]["bytes"]
                while remaining:
                    block = source.read(min(65536, remaining))
                    if not block:
                        raise BridgeError("IO_ERROR", "The owned artifact was truncated", "possible")
                    output.write(block)
                    remaining -= len(block)
            result = stage.publish()
            result.update(sourceSessionId=self.session_id,
                          generation=entry["metadata"]["startGeneration"])
            return result
        finally:
            stage.cleanup()

    def expire(self):
        """Expiry never touches live native stages or extends itself on reads."""
        now = time.monotonic()
        for identifier, entry in tuple(self.entries.items()):
            if now >= entry["expires"]:
                self._remove(identifier)

    def discard(self, path):
        """Remove only an output pathname reserved by this store."""
        if path in self.stages:
            path.unlink(missing_ok=True)
            self.stages.remove(path)

    def cleanup_files(self):
        """Filesystem-only exit fallback; live render stages belong to their renderer."""
        for identifier in tuple(self.entries):
            try:
                self._remove(identifier)
            except (OSError, BridgeError):
                pass

    def close(self):
        """Close only after the native owner has retired every reserved stage."""
        if self.stages:
            raise BridgeError("BUSY", "A native render still owns an output stage")
        for identifier in tuple(self.entries):
            self._remove(identifier)
        if self.directory is not None:
            try:
                self.directory.rmdir()
            except FileNotFoundError:
                pass
        self.directory = None
        self.session_id = ""

    def _entry(self, identifier):
        self.expire()
        identifier = self._identifier(identifier)
        entry = self.entries.get(identifier)
        if entry is None:
            raise BridgeError("NOT_FOUND", "The artifact is released, expired, or unknown")
        return entry

    @staticmethod
    def _identifier(value):
        if not isinstance(value, str) or not value or len(value) > 128:
            raise BridgeError("INVALID_ARGUMENT", "artifactId must be a bounded nonempty string")
        return value

    def _open(self, entry):
        stream = entry["path"].open("rb")
        try:
            if self._identity(os.fstat(stream.fileno())) != entry["identity"]:
                raise BridgeError("IO_ERROR", "The owned artifact changed outside Blendia")
            return stream
        except Exception:
            stream.close()
            raise

    def _remove(self, identifier):
        entry = self.entries[identifier]
        try:
            information = entry["path"].lstat()
        except FileNotFoundError:
            del self.entries[identifier]
            return
        if self._identity(information) != entry["identity"]:
            raise BridgeError("IO_ERROR", "Refusing to remove a replaced artifact")
        entry["path"].unlink()
        del self.entries[identifier]

    @staticmethod
    def _identity(information):
        return information.st_dev, information.st_ino, information.st_size, information.st_mtime_ns
