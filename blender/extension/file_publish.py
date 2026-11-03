"""Publish explicit user destinations without replacing them by accident."""

import os
import stat
import tempfile
from pathlib import Path

from .protocol import BridgeError


def destination(value, extension, overwrite=False):
    """Validate the requested name without appending an extension or making folders."""
    if not isinstance(value, str) or not value or "\x00" in value:
        raise BridgeError("INVALID_ARGUMENT", "path must be a nonempty absolute path")
    if type(overwrite) is not bool:
        raise BridgeError("INVALID_ARGUMENT", "overwrite must be a boolean")
    path = Path(value)
    if not path.is_absolute() or path.suffix.lower() != extension:
        raise BridgeError("INVALID_ARGUMENT", f"Supply an absolute {extension} destination")
    if not path.parent.is_dir():
        raise BridgeError("INVALID_ARGUMENT", "The destination parent must already exist")
    if os.path.lexists(path):
        if not overwrite:
            raise BridgeError("FILE_EXISTS", "The destination already exists")
        if path.is_dir():
            raise BridgeError("INVALID_ARGUMENT", "The destination is a directory")
    return path


class OwnedStage:
    """Own one sibling stage and its previously empty native backup namespace."""

    def __init__(self, target, overwrite, native=False):
        self.target = target
        self.overwrite = overwrite
        self.path = None
        self.paths = []
        self.published = False
        self.native = native

        # Reserve the real filename before allowing a native writer to replace it.
        for _ in range(8):
            descriptor, name = tempfile.mkstemp(prefix=".blendia-", suffix=target.suffix,
                                                dir=target.parent)
            information = os.fstat(descriptor)
            os.close(descriptor)
            path = Path(name)
            extras = ([Path(f"{name}@")] + [Path(f"{name}{n}") for n in range(1, 100)]
                      if native else [])
            if any(os.path.lexists(extra) for extra in extras):
                path.unlink()
                continue
            self.path = path
            self.paths = [path, Path(f"{name}@")] if native else [path]
            self.backup = Path(f"{name}1") if native else None
            self.reservation = information.st_dev, information.st_ino
            break
        if self.path is None:
            raise BridgeError("IO_ERROR", "Could not allocate an unused output stage")

    def publish(self):
        """Expose completed bytes atomically; the default never replaces a racer."""
        information = self.path.lstat()
        if not stat.S_ISREG(information.st_mode):
            raise BridgeError("IO_ERROR", "The owned output stage is not a regular file", "possible")
        with self.path.open("r+b") as stream:
            os.fsync(stream.fileno())
        try:
            if self.overwrite:
                os.replace(self.path, self.target)
            else:
                os.link(self.path, self.target)
                self.published = True
                self.path.unlink()
            self.published = True
        except FileExistsError as error:
            raise BridgeError("FILE_EXISTS", "The destination appeared before publication", "possible") from error
        except OSError as error:
            raise BridgeError("IO_ERROR", f"Atomic file publication failed: {error}", "possible") from error
        return {"path": str(self.target), "bytes": information.st_size}

    def cleanup(self):
        """Remove exact allocated names, never the published destination or user backups."""
        errors = []
        if self.backup is not None:
            try:
                information = self.backup.lstat()
                if (information.st_dev, information.st_ino) != self.reservation:
                    raise OSError("The native backup no longer matches our reserved empty stage")
                self.backup.unlink()
            except FileNotFoundError:
                pass
            except OSError as error:
                errors.append(f"{self.backup}: {error}")
        for path in self.paths:
            try:
                path.unlink(missing_ok=True)
            except OSError as error:
                errors.append(f"{path}: {error}")
        if errors:
            raise BridgeError("IO_ERROR", "Owned output stage cleanup failed: " + "; ".join(errors)[:2048],
                              "possible")
