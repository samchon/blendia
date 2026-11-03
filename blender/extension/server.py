"""A bounded, authenticated local transport polled on Blender's main thread."""

import hmac
import json
import os
import secrets
import socket
import time
import uuid
from pathlib import Path

import bpy
from bpy.app.handlers import persistent

from .artifacts import ArtifactStore
from .commands import SceneCommands
from .native_render import NativeRender
from .protocol import BridgeError, ID_PATTERN, MAX_FRAME_BYTES, decode_frame, encode_frame, require_keys
from .save_scene import save_blend_copy
from .scene_data import SCENE_METHODS


class Connection:
    """Bound one client's partial frames, authentication deadline, and pending reply."""

    def __init__(self, stream):
        self.stream = stream
        self.input = bytearray()
        self.output = bytearray()
        self.authenticated = False
        self.closing = False
        self.deadline = time.monotonic() + 5
        self.last_id = 0


class Bridge:
    """Own a single live session without a background Python execution thread."""

    def __init__(self):
        self.listener = None
        self.connections = []
        self.owner = None
        self.port = 0
        self.token = ""
        self.session_id = ""
        self.generation = 0
        self.descriptor_path = ""
        self.loading = False
        self.last_error = ""
        self.enabled = False
        self.artifacts = ArtifactStore()
        self.renders = NativeRender(self, self.artifacts)
        self.commands = SceneCommands(self)

        # Keep the exact bound-method object for timer registration and teardown.
        self.timer = self.tick

    @property
    def running(self):
        return self.listener is not None

    def start(self):
        """Start a fresh explicitly enabled session and write its private descriptor."""
        if self.running:
            return
        if bpy.app.version < (5, 2, 0):
            raise RuntimeError("Blendia requires Blender 5.2 or newer")
        session_id = str(uuid.uuid4())
        self.renders.start_session(session_id)
        self.session_id = session_id
        self.token = secrets.token_urlsafe(32)
        self.generation = 0
        self.loading = False
        self.last_error = ""
        listener = None
        try:
            listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
                listener.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            listener.bind(("127.0.0.1", 0))
            listener.listen(4)
            listener.setblocking(False)
            self.listener = listener
            self.port = listener.getsockname()[1]
            location = bpy.utils.user_resource("CONFIG", path="blendia", create=True)
            if not location or not Path(location).is_absolute():
                raise RuntimeError("Blender did not provide an absolute user configuration directory")
            directory = Path(location)
            path = directory / f"session-{self.session_id}.json"
            self.descriptor_path = str(path)
            descriptor = {"protocolVersion": 1, "host": "127.0.0.1", "port": self.port,
                          "token": self.token, "sessionId": self.session_id}
            with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w", encoding="utf-8") as file:
                json.dump(descriptor, file, separators=(",", ":"))
            bpy.app.timers.register(self.timer, first_interval=0.01, persistent=True)
        except Exception:
            if listener is not None:
                listener.close()
            self.stop()
            raise

    def stop(self):
        """Close owned sockets and remove only the current session's descriptor."""
        try:
            self.renders.retire()
        finally:
            try:
                if bpy.app.timers.is_registered(self.timer):
                    bpy.app.timers.unregister(self.timer)
            finally:
                self.close_transport()

    def render_retired(self):
        """Keep invalidation callbacks alive until a disabled native job retires."""
        if not self.enabled:
            unregister_handlers()

    def close_transport(self):
        """Release session resources without bpy access, including interpreter exit."""
        for connection in tuple(self.connections):
            self.close(connection)
        if self.listener is not None:
            self.listener.close()
        self.listener = None
        if self.descriptor_path:
            path = Path(self.descriptor_path)
            try:
                descriptor = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(descriptor, dict) and descriptor.get("sessionId") == self.session_id:
                    path.unlink()
            except (OSError, ValueError):
                pass
        self.port = 0
        self.token = ""
        self.session_id = ""
        self.descriptor_path = ""

    def close(self, connection):
        """Release ownership on disconnect without changing the Blender scene."""
        connection.stream.close()
        if connection in self.connections:
            self.connections.remove(connection)
        if self.owner is connection:
            self.owner = None

    def require_identity(self, value):
        """Reject session replacement and undo/load generation changes before edits."""
        if value.get("sessionId") != self.session_id:
            raise BridgeError("STALE_SESSION", "Reconnect to the current Blender session")
        generation = value.get("generation")
        if isinstance(generation, bool) or not isinstance(generation, int):
            raise BridgeError("INVALID_ARGUMENT", "generation must be an integer")
        if generation != self.generation:
            raise BridgeError("STALE_GENERATION", "Scene history changed; reconnect and obtain new handles")

    def tick(self):
        """Bound network work to keep Blender responsive between short commands."""
        if not self.running:
            return None
        deadline = time.monotonic() + 0.005
        try:
            self.renders.tick()
            for _ in range(4):
                try:
                    stream, _ = self.listener.accept()
                except BlockingIOError:
                    break
                stream.setblocking(False)
                if len(self.connections) >= 4:
                    stream.close()
                else:
                    self.connections.append(Connection(stream))
            for connection in tuple(self.connections):
                if time.monotonic() >= deadline:
                    break
                try:
                    self.poll(connection)
                except (OSError, ValueError):
                    self.close(connection)
        except Exception as error:
            self.last_error = f"Bridge stopped: {type(error).__name__}: {error}"
            self.stop()
            return None
        return 0.01 if self.connections else 0.1

    def poll(self, connection):
        """Read at most 64 KiB and execute at most one request per polling turn."""
        if time.monotonic() > connection.deadline:
            self.close(connection)
            return
        if connection.output:
            try:
                sent = connection.stream.send(connection.output[:65536])
                del connection.output[:sent]
            except BlockingIOError:
                return
            if not connection.output and connection.closing:
                self.close(connection)
            elif not connection.output and connection.authenticated:
                connection.deadline = float("inf")
            return
        if connection.closing:
            self.close(connection)
            return
        try:
            chunk = connection.stream.recv(65536)
        except BlockingIOError:
            chunk = None
        if chunk == b"":
            self.close(connection)
            return
        if chunk:
            if not connection.input and connection.authenticated:
                connection.deadline = time.monotonic() + 30
            connection.input.extend(chunk)
            if len(connection.input) > MAX_FRAME_BYTES + 4:
                self.close(connection)
                return
        try:
            request = decode_frame(connection.input)
        except BridgeError:
            self.close(connection)
            return
        if request is None:
            return
        response = self.dispatch(connection, request)
        connection.output = bytearray(encode_frame(response))
        connection.deadline = time.monotonic() + 30

    def dispatch(self, connection, request):
        """Authenticate, correlate, and validate ownership before allowing a command."""
        supplied_id = request.get("id")
        identifier = (supplied_id if isinstance(supplied_id, str)
                      and ID_PATTERN.fullmatch(supplied_id) else "")
        try:
            require_keys(request, ("id", "method", "params"), ("sessionId", "generation"))
            if not isinstance(identifier, str) or not ID_PATTERN.fullmatch(identifier):
                raise BridgeError("INVALID_REQUEST", "id must be a positive decimal counter of at most 20 digits")
            counter = int(identifier)
            if counter <= connection.last_id:
                raise BridgeError("INVALID_REQUEST", "Request counters must increase")
            connection.last_id = counter
            method = request["method"]
            params = request["params"]
            if not isinstance(method, str) or not isinstance(params, dict):
                raise BridgeError("INVALID_REQUEST", "Expected method string and params object")
            if method == "hello":
                require_keys(params, ("protocolVersion", "token"))
                if connection.authenticated:
                    raise BridgeError("INVALID_REQUEST", "Already authenticated")
                token = params["token"]
                if (not isinstance(token, str) or not token.isascii()
                        or not hmac.compare_digest(token, self.token)):
                    raise BridgeError("UNAUTHORIZED", "Invalid session token")
                if type(params["protocolVersion"]) is not int or params["protocolVersion"] != 1:
                    raise BridgeError("PROTOCOL_MISMATCH", "Only protocol version 1 is supported")
                if self.owner is not None:
                    raise BridgeError("BUSY", "Another TypeScript client owns this session")
                connection.authenticated = True
                self.owner = connection
                result = {"protocolVersion": 1, "sessionId": self.session_id,
                          "generation": self.generation, "blenderVersion": bpy.app.version_string,
                          "capabilities": ["cube.create", "object.get", "object.setTransform", *SCENE_METHODS,
                                           "render.start", "render.get", "artifact.read", "artifact.release",
                                           "artifact.save", "scene.saveBlendCopy"]}
            else:
                if not connection.authenticated:
                    raise BridgeError("UNAUTHORIZED", "Authenticate with hello first")
                self.require_identity(request)
                readable = method in ("render.get", "artifact.read", "artifact.release", "disconnect")
                if self.loading or ((self.renders.busy or bpy.app.is_job_running("RENDER")) and not readable):
                    raise BridgeError("BUSY", "Blender is loading, rendering, or finalizing output")
                if method == "disconnect":
                    require_keys(params, ())
                    result = {}
                    connection.closing = True
                elif method == "render.start":
                    result = self.renders.start(params)
                elif method == "render.get":
                    result = self.renders.get(params)
                elif method == "artifact.read":
                    result = self.artifacts.read(params)
                elif method == "artifact.release":
                    result = self.artifacts.release(params)
                elif method == "artifact.save":
                    result = self.artifacts.save(params)
                elif method == "scene.saveBlendCopy":
                    result = save_blend_copy(self, params)
                else:
                    result = self.commands.execute(method, params)
            return self.envelope(connection, identifier, {"ok": True, "result": result})
        except BridgeError as error:
            if not connection.authenticated:
                connection.closing = True
            return self.envelope(connection, identifier, {"ok": False, "error": {
                "code": error.code, "message": str(error), "effects": error.effects}})
        except Exception as error:
            return self.envelope(connection, identifier, {"ok": False, "error": {
                "code": "INTERNAL_ERROR", "message": str(error), "effects": "none"}})

    def envelope(self, connection, identifier, body):
        """Identify authenticated replies with current, not caller-supplied history."""
        result = {"id": identifier, **body}
        if connection.authenticated:
            result.update(sessionId=self.session_id, generation=self.generation)
        return result


bridge = Bridge()


@persistent
def before_load(*_):
    """Invalidate queued handles before Blender releases the old Main database."""
    bridge.renders.invalidate("Blender is loading another file")
    bridge.loading = True
    bridge.generation += 1


@persistent
def after_load(*_):
    """Resume polling against a newly loaded scene without reusing old handles."""
    bridge.loading = False


@persistent
def history_changed(*_):
    """Conservatively expire handles whenever Blender restores undo or redo data."""
    bridge.renders.invalidate("Blender undo or redo changed scene history")
    bridge.generation += 1


HANDLERS = (("load_pre", before_load), ("load_post", after_load),
            ("load_post_fail", after_load), ("undo_pre", history_changed),
            ("redo_pre", history_changed))


def register_handlers():
    """Install only this extension's persistent file and history callbacks."""
    for name, callback in HANDLERS:
        handlers = getattr(bpy.app.handlers, name, None)
        if handlers is not None and callback not in handlers:
            handlers.append(callback)


def unregister_handlers():
    """Remove owned handlers without clearing another add-on's callback list."""
    if bridge.renders.busy:
        return
    for name, callback in HANDLERS:
        handlers = getattr(bpy.app.handlers, name, None)
        if handlers is not None and callback in handlers:
            handlers.remove(callback)
