"""Observe native publication and installed artifact admission against actual PNG bytes."""

import base64
import hashlib
import importlib
import importlib.machinery
import json
import sys
import types
import uuid
from pathlib import Path

import bpy


def installed_artifacts(directory):
    """Load only the verified installed core, using the public headless namespace convention."""
    namespace = "_blendia_installed_artifact_observation"
    assert namespace not in sys.modules
    package = types.ModuleType(namespace)
    package.__path__ = [str(directory)]
    package.__package__ = namespace
    package.__spec__ = importlib.machinery.ModuleSpec(namespace, loader=None, is_package=True)
    package.__spec__.submodule_search_locations = [str(directory)]
    sys.modules[namespace] = package
    artifacts = importlib.import_module(f"{namespace}.artifacts")
    protocol = importlib.import_module(f"{namespace}.protocol")
    assert Path(artifacts.__file__).resolve(strict=True) == directory / "artifacts.py"
    assert Path(protocol.__file__).resolve(strict=True) == directory / "protocol.py"
    return artifacts, protocol.BridgeError


def incomplete_copies(raw):
    """Locate native chunk boundaries only; production validation is never used as an oracle."""
    chunks = []
    offset = 8
    while offset < len(raw):
        length = int.from_bytes(raw[offset:offset + 4], "big")
        kind = raw[offset + 4:offset + 8]
        chunks.append((kind, offset, length))
        offset += 12 + length
    idat = next(chunk for chunk in chunks if chunk[0] == b"IDAT")
    iend = next(chunk for chunk in chunks if chunk[0] == b"IEND")
    assert idat[2] > 1
    middle = idat[1] + 8 + idat[2] // 2

    # Alter an actual data byte without updating its checksum, independently of any validator branch.
    corrupt = bytearray(raw)
    corrupt[middle] ^= 1
    return (
        ("header-only", raw[:33]),
        ("inside-idat", raw[:middle]),
        ("missing-iend", raw[:iend[1]]),
        ("corrupt-idat", bytes(corrupt)),
    )


def inspect_artifacts(directory, image_path, raw):
    """Exercise real installed ownership, complete-file publication and malformed physical stages."""
    artifacts, bridge_error = installed_artifacts(directory)
    store = artifacts.ArtifactStore()
    session_id = str(uuid.uuid4())
    job = {"handle": {"renderId": str(uuid.uuid4())}, "startGeneration": 7, "width": 32, "height": 32}
    exported = image_path.with_name("validated-artifact.png")
    observations = []
    failures = []
    positive = {"accepted": False}
    store.start(session_id)
    try:
        stage = store.reserve()
        metadata = None
        try:
            stage.write_bytes(raw)
            metadata = store.adopt(stage, job)
            assert metadata["bytes"] == len(raw)
            assert metadata["mimeType"] == "image/png"
            assert (metadata["width"], metadata["height"]) == (32, 32)
            assert metadata["handle"]["sessionId"] == session_id
            assert metadata["renderId"] == job["handle"]["renderId"]
            assert metadata["startGeneration"] == 7
            identifier = metadata["handle"]["artifactId"]
            streamed = bytearray()
            while len(streamed) < len(raw):
                offset = len(streamed)
                chunk = store.read({"artifactId": identifier, "offset": offset, "maxBytes": 4096})
                block = base64.b64decode(chunk["dataBase64"], validate=True)
                assert block and len(block) <= 4096
                assert chunk["offset"] == offset
                assert chunk["nextOffset"] == offset + len(block)
                assert chunk["totalBytes"] == len(raw)
                assert chunk["eof"] == (offset + len(block) == len(raw))
                streamed.extend(block)
            assert bytes(streamed) == raw
            published = store.save({"artifactId": identifier, "path": str(exported)})
            assert published["sourceSessionId"] == session_id
            assert published["generation"] == 7
            assert exported.read_bytes() == raw
            store.release({"artifactId": identifier})
            metadata = None
            assert exported.read_bytes() == raw
            positive = {"accepted": True, "bytes": len(raw), "width": 32, "height": 32,
                        "readMatches": True, "exportMatchesAfterRelease": True,
                        "provenanceMatches": True}
        except Exception as error:
            failures.append(f"complete-native-png: {type(error).__name__}")
        finally:
            if metadata is not None:
                store.release({"artifactId": metadata["handle"]["artifactId"]})
            store.discard(stage)

        # Collect every malformed-file observation before reporting a failed integrity round.
        for name, data in incomplete_copies(raw):
            stage = store.reserve()
            metadata = None
            observation = {"case": name, "bytes": len(data), "rejected": False}
            try:
                stage.write_bytes(data)
                metadata = store.adopt(stage, job)
                failures.append(f"{name}: incomplete or corrupt PNG was admitted")
            except bridge_error as error:
                observation.update(rejected=True, code=error.code, effects=error.effects)
                if error.code != "IO_ERROR" or error.effects != "possible":
                    failures.append(f"{name}: unexpected rejection status")
            except Exception as error:
                observation["unexpectedError"] = type(error).__name__
                failures.append(f"{name}: {type(error).__name__}")
            finally:
                if metadata is not None:
                    store.release({"artifactId": metadata["handle"]["artifactId"]})
                store.discard(stage)
            observations.append(observation)
    finally:
        store.close()
    assert image_path.read_bytes() == raw
    return {"moduleFile": str(Path(artifacts.__file__).resolve(strict=True)),
            "positive": positive, "malformed": observations, "failures": failures,
            "originalSha256": hashlib.sha256(raw).hexdigest(),
            "storeClosed": store.directory is None}, failures


def main():
    """Check saved scene semantics and real installed PNG admission without another native launch."""
    arguments = sys.argv[sys.argv.index("--") + 1:]
    if len(arguments) != 3:
        raise ValueError("Supply the published PNG, verified installed core and observation destination")
    image_path, directory, report_path = map(Path, arguments)
    assert image_path.is_absolute() and directory.is_absolute() and report_path.is_absolute()
    directory = directory.resolve(strict=True)
    assert bpy.app.background and bpy.app.version[:2] == (5, 2)
    cube = bpy.context.scene.objects["Published Cube"]
    assert cube.type == "MESH"
    assert tuple(cube.location) == (3, 2, 1)
    assert len(cube.data.vertices) == 8 and len(cube.data.polygons) == 6
    assert bpy.context.scene.camera is not None

    raw = image_path.read_bytes()
    image = bpy.data.images.load(str(image_path), check_existing=False)
    try:
        assert tuple(image.size) == (32, 32)
        assert len(list(image.pixels)) == 32 * 32 * 4
    finally:
        bpy.data.images.remove(image)
    integrity, failures = inspect_artifacts(directory, image_path, raw)
    report = {"cube": cube.name, "location": list(cube.location), "vertices": len(cube.data.vertices), "polygons": len(cube.data.polygons)}
    report.update(blenderVersion=bpy.app.version_string, decodedImageSize=[32, 32], artifactIntegrity=integrity)
    with report_path.open("x", encoding="utf8") as output:
        json.dump(report, output, indent=2)
    assert not failures, failures
    print("BLENDIA_NATIVE_PUBLICATION_OK")


main()
