"""Launch the public CLI and drain its bounded output without Python threads."""

import codecs
import json
import os
import subprocess
import tempfile
import time
from pathlib import Path

import bpy

from .server import bridge


MAX_TEXT_BYTES = 262144
MAX_LOG_BYTES = 65536


class MacroLauncher:
    """Own one direct CLI process; this is not descendant cancellation or rollback."""

    def __init__(self):
        self.process = None
        self.output_fd = None
        self.decoder = None
        self.input_path = None
        self.log = ""
        self.truncated = False
        self.status = "Idle"
        self.exit_code = None
        self.exit_seen = None
        self.uncertain = False
        self.enabled = False
        self.secret = ""
        self.output_tail = ""
        self.timer = self.tick

    @property
    def running(self):
        return self.process is not None

    def append(self, text):
        """Retain only a bounded tail and avoid echoing the connection token."""
        if self.secret:
            text = text.replace(self.secret, "[redacted session token]")
        self.log += text
        encoded = self.log.encode("utf-8")
        if len(encoded) > MAX_LOG_BYTES:
            self.log = encoded[-MAX_LOG_BYTES:].decode("utf-8", errors="ignore")
            self.truncated = True

    def append_output(self, text, final=False):
        """Hold a token-sized tail so a secret split across reads is redacted."""
        text = self.output_tail + text
        if self.secret:
            text = text.replace(self.secret, "[redacted session token]")
        count = len(text) if final else max(0, len(text) - max(0, len(self.secret) - 1))
        self.output_tail = text[count:]
        self.append(text[:count])

    def launch(self, settings, text=None, origin=None):
        """Snapshot settings and Text before launching; never retain Blender RNA."""
        if self.running:
            raise ValueError("A TypeScript launcher is already running")
        if self.uncertain:
            raise ValueError("Previous execution is uncertain; resolve its descendants and restart Blender before another run")
        if not bridge.running:
            raise ValueError("Start Blendia before running TypeScript")
        if bridge.owner is not None:
            raise ValueError("Disconnect the existing TypeScript client before running a macro")

        cwd = self.absolute_file(settings.project_root, "Project directory", directory=True)
        node = self.absolute_file(settings.node_executable, "Node executable")
        cli = self.absolute_file(settings.cli_entry, "CLI entry")
        prefix = [str(node)]
        if cli.suffix.lower() in {".ts", ".tsx", ".mts", ".cts"}:
            metadata_path = self.absolute_file(settings.ttsc_package, "ttsc package.json")
            if metadata_path.stat().st_size > 65536:
                raise ValueError("ttsc package.json exceeds the 64 KiB metadata limit")
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            binaries = metadata.get("bin") if isinstance(metadata, dict) else None
            entry = binaries.get("ttsx") if isinstance(binaries, dict) else None
            if not isinstance(entry, str) or not entry:
                raise ValueError("ttsc package.json must declare its public bin.ttsx launcher")
            ttsx = self.absolute_file(str(metadata_path.parent / entry), "ttsx launcher")
            prefix.append(str(ttsx))
        elif cli.suffix.lower() not in {".js", ".mjs", ".cjs"}:
            raise ValueError("CLI entry must be TypeScript source or JavaScript, not a shell wrapper")
        if node.suffix.lower() in {".cmd", ".bat", ".ps1"}:
            raise ValueError("Node executable must not be a shell wrapper")
        source = settings.source_path.strip()
        if not source:
            raise ValueError("Provide the project source path, including for an unsaved Text")
        if len(settings.arguments.encode("utf-8")) > 65536:
            raise ValueError("Argument JSON exceeds the 64 KiB limit")
        args = json.loads(settings.arguments)
        if not isinstance(args, list) or not all(isinstance(arg, str) for arg in args):
            raise ValueError("Arguments must be a JSON array of strings")

        command = [*prefix, str(cli), "run-text" if text is not None else "run", "--cwd", str(cwd)]
        if settings.tsconfig.strip():
            command += ["--project", settings.tsconfig.strip()]
        self.log = ""
        self.truncated = False
        self.exit_code = None
        self.exit_seen = None
        self.uncertain = False
        self.secret = bridge.token
        self.output_tail = ""
        if self.input_path is not None:
            self.append(f"Earlier private input remains at {self.input_path}\n")
            self.input_path = None
        read_fd = write_fd = None
        try:
            if text is not None:
                encoded = text.encode("utf-8")
                if len(encoded) > MAX_TEXT_BYTES:
                    raise ValueError("Active Text exceeds the 256 KiB UTF-8 limit")
                directory = Path(tempfile.mkdtemp(prefix="blendia-macro-"))
                self.input_path = directory / "input.txt"
                with os.fdopen(os.open(self.input_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "wb") as stream:
                    stream.write(encoded)
                command += ["--source-path", source, "--input-file", str(self.input_path)]
                if origin:
                    command += ["--origin", origin]
            else:
                command.append(source)
            command += ["--", *args]

            # Configure the read end before spawning, so setup cannot block a child.
            read_fd, write_fd = os.pipe()
            os.set_blocking(read_fd, False)
            env = os.environ.copy()
            env.update(BLENDIA_PORT=str(bridge.port), BLENDIA_TOKEN=bridge.token)
            if not bpy.app.timers.is_registered(self.timer):
                bpy.app.timers.register(self.timer, first_interval=0.01, persistent=True)
            self.process = subprocess.Popen(
                command, cwd=str(cwd), env=env, shell=False,
                stdin=subprocess.DEVNULL, stdout=write_fd, stderr=write_fd,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
            self.output_fd = read_fd
            read_fd = None
            self.decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
            self.status = "Running TypeScript"
            self.append(f"Project: {cwd}\nSource: {source}\n")
            if origin:
                self.append(f"Text snapshot: {origin}; staged sibling identity applies\n")
        except Exception:
            if self.process is None:
                self.cleanup_input()
            else:
                self.uncertain = True
                self.status = "Launcher observation failed; process may still be running"
            raise
        finally:
            for fd in (read_fd, write_fd):
                if fd is not None:
                    os.close(fd)

    @staticmethod
    def absolute_file(value, label, directory=False):
        path = Path(value.strip()).expanduser()
        if not value.strip() or not path.is_absolute():
            raise ValueError(f"{label} must be an absolute path")
        if not (path.is_dir() if directory else path.is_file()):
            raise ValueError(f"{label} does not exist: {path}")
        return path.resolve()

    def cleanup_input(self):
        """Delete only the exact private input and its otherwise empty directory."""
        if self.input_path is None:
            return
        path = self.input_path
        try:
            path.unlink(missing_ok=True)
        except OSError as error:
            self.append(f"Private input retained at {path}: {error}\n")
            return
        self.input_path = None
        try:
            path.parent.rmdir()
        except OSError as error:
            self.append(f"Private input removed; directory retained at {path.parent}: {error}\n")

    def close_output(self):
        if self.output_fd is not None:
            try:
                os.close(self.output_fd)
            except OSError:
                self.uncertain = True
            self.output_fd = None
            if self.decoder is not None:
                self.append_output(self.decoder.decode(b"", final=True), final=True)
                self.decoder = None

    def tick(self):
        """Read at most 64 KiB with a soft 4 ms read-loop budget, also after exit."""
        if self.process is None:
            return None
        deadline = time.monotonic() + 0.004
        budget = 65536
        while self.output_fd is not None and budget > 0 and time.monotonic() < deadline:
            try:
                data = os.read(self.output_fd, min(8192, budget))
            except BlockingIOError:
                break
            except OSError as error:
                self.append(f"Output observation failed: {error}\n")
                self.uncertain = True
                self.close_output()
                break
            if not data:
                self.close_output()
                break
            budget -= len(data)
            self.append_output(self.decoder.decode(data))

        try:
            code = self.process.poll()
        except OSError as error:
            self.uncertain = True
            self.status = "Launcher observation failed; descendant state unknown"
            self.close_output()
            self.append(f"{self.status}: {error}\n")
            if self.input_path is not None:
                self.append(f"Private input retained at {self.input_path}\n")
            self.process = None
            return None
        if code is not None:
            if self.exit_seen is None:
                self.exit_seen = time.monotonic()
            # Descendants can inherit the pipe; never wait indefinitely for their EOF.
            if self.output_fd is not None and time.monotonic() - self.exit_seen > 2:
                self.uncertain = True
                self.append("Output drain timed out; a descendant may still be running.\n")
                self.close_output()
            if self.output_fd is None:
                self.exit_code = code
                interrupted = code < 0 or (os.name == "nt" and code >= 0x80000000)
                self.uncertain = self.uncertain or interrupted
                self.status = f"CLI exited with code {code}"
                if self.uncertain:
                    self.status += "; descendant state unknown"
                    if self.input_path is not None:
                        self.append(f"Private input retained at {self.input_path}\n")
                else:
                    self.cleanup_input()
                self.append(self.status + "\n")
                self.process = None
                self.secret = ""
        if self.enabled:
            self.redraw()
        return 0.05 if self.process is not None else None

    @staticmethod
    def redraw():
        """UI teardown or file loading must not interrupt process observation."""
        try:
            manager = bpy.context.window_manager
            if manager is not None:
                for window in manager.windows:
                    if window.screen is not None:
                        for area in window.screen.areas:
                            if area.type in {"VIEW_3D", "TEXT_EDITOR"}:
                                area.tag_redraw()
        except (AttributeError, ReferenceError, RuntimeError):
            pass

    def abandon_at_exit(self):
        """Close owned output without bpy, waiting, killing or deleting live input."""
        self.close_output()


launcher = MacroLauncher()
