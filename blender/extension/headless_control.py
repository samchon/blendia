"""Bounded private parent control, independent of the SDK writer connection."""

import hmac
import json
import os
import socket
import stat
import struct
import time
import uuid
from pathlib import Path


MAX_METADATA_BYTES = 16384
MAX_CONTROL_BYTES = 4096


def load_config(value):
    """Read one private regular configuration without printing credential content."""
    path = Path(value)
    if not path.is_absolute():
        raise ValueError("Configuration path must be absolute")
    information = path.lstat()
    if not stat.S_ISREG(information.st_mode) or information.st_size > MAX_METADATA_BYTES:
        raise ValueError("Configuration must be a bounded regular file")
    with path.open("rb") as stream:
        current = os.fstat(stream.fileno())
        if (current.st_dev, current.st_ino) != (information.st_dev, information.st_ino):
            raise ValueError("Configuration identity changed")
        raw = stream.read(MAX_METADATA_BYTES + 1)
    if len(raw) > MAX_METADATA_BYTES:
        raise ValueError("Configuration exceeds its byte bound")
    config = json.loads(raw.decode("utf-8"))
    if (not isinstance(config, dict) or set(config) != {
            "protocolVersion", "runId", "readyPath", "controlToken", "attachTimeoutMs"}
            or type(config["protocolVersion"]) is not int or config["protocolVersion"] != 1):
        raise ValueError("Unsupported configuration")
    identifier = config["runId"]
    if not isinstance(identifier, str) or str(uuid.UUID(identifier)) != identifier:
        raise ValueError("Invalid invocation identity")
    token = config["controlToken"]
    if not isinstance(token, str) or not 32 <= len(token) <= 256 or not token.isascii() or not token.isprintable():
        raise ValueError("Invalid invocation credential")
    timeout = config["attachTimeoutMs"]
    if type(timeout) is not int or not 100 <= timeout <= 3600000:
        raise ValueError("Invalid attach deadline")
    ready = Path(config["readyPath"])
    parent = path.parent.resolve()
    if not ready.is_absolute() or ready.parent.resolve() != parent or ready == path or os.path.lexists(ready):
        raise ValueError("Readiness must name a new file in the private directory")
    config["directory"] = parent
    return config


def publish_ready(config, bridge, control):
    """Atomically publish only after both authenticated loopback ports are bound."""
    value = {"protocolVersion": 1, "runId": config["runId"], "host": "127.0.0.1",
             "port": bridge.port, "token": bridge.token, "sessionId": bridge.session_id,
             "controlPort": control.port}
    raw = json.dumps(value, separators=(",", ":")).encode("utf-8")
    if len(raw) > MAX_METADATA_BYTES:
        raise ValueError("Readiness exceeds its byte bound")
    path = config["directory"] / f".ready-{config['runId']}.tmp"
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        if os.path.lexists(config["readyPath"]):
            raise ValueError("Readiness destination appeared unexpectedly")
        os.replace(path, config["readyPath"])
    finally:
        path.unlink(missing_ok=True)


class HeadlessControl:
    """Observe attach, finish and parent EOF only between main-thread commands."""

    def __init__(self, config):
        self.config = config
        self.listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.clients = []
        self.owner = None
        self.attached = False
        self.reason = None
        self.deadline = time.monotonic() + config["attachTimeoutMs"] / 1000
        self.finish_deadline = None
        try:
            if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
                self.listener.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            self.listener.bind(("127.0.0.1", 0))
            self.listener.listen(2)
            self.listener.setblocking(False)
            self.port = self.listener.getsockname()[1]
        except Exception:
            self.listener.close()
            raise

    @property
    def finishing(self):
        return self.reason is not None

    @property
    def flushed(self):
        return self.finishing and not any(client["output"] for client in self.clients)

    @property
    def flush_expired(self):
        return self.finishing and time.monotonic() >= self.finish_deadline

    def finish(self, reason):
        if self.reason is None:
            self.reason = reason
            self.finish_deadline = time.monotonic() + 2

    def drop(self, client):
        try:
            client["stream"].close()
        except OSError:
            pass
        if client in self.clients:
            self.clients.remove(client)
        if self.owner is client:
            self.owner = None
            self.finish("control-lost")

    def poll(self):
        """Bound accepts, bytes, frame processing and unauthenticated retention."""
        if not self.attached and time.monotonic() >= self.deadline:
            self.finish("attach-timeout")
        for _ in range(2):
            try:
                stream, _ = self.listener.accept()
            except BlockingIOError:
                break
            if len(self.clients) >= 2 or self.finishing:
                stream.close()
                continue
            stream.setblocking(False)
            self.clients.append({"stream": stream, "input": bytearray(), "output": bytearray(),
                                 "deadline": time.monotonic() + 5})
        for client in tuple(self.clients):
            try:
                if time.monotonic() >= client["deadline"]:
                    self.drop(client)
                    continue
                if client["output"]:
                    sent = client["stream"].send(client["output"])
                    del client["output"][:sent]
                    continue
                try:
                    raw = client["stream"].recv(MAX_CONTROL_BYTES + 5 - len(client["input"]))
                except BlockingIOError:
                    raw = None
                if raw == b"":
                    self.drop(client)
                    continue
                if raw:
                    client["input"].extend(raw)
                if len(client["input"]) > MAX_CONTROL_BYTES + 4:
                    raise ValueError("Oversized control request")
                if len(client["input"]) < 4:
                    continue
                length = struct.unpack(">I", client["input"][:4])[0]
                if not 1 <= length <= MAX_CONTROL_BYTES:
                    raise ValueError("Invalid control frame")
                if len(client["input"]) < length + 4:
                    continue
                request = json.loads(bytes(client["input"][4:length + 4]).decode("utf-8"))
                del client["input"][:length + 4]
                self.dispatch(client, request)
            except BlockingIOError:
                continue
            except (OSError, ValueError, RecursionError, TypeError):
                self.drop(client)

    def dispatch(self, client, request):
        if (not isinstance(request, dict) or set(request) != {"protocolVersion", "runId", "token", "method"}
                or type(request["protocolVersion"]) is not int or request["protocolVersion"] != 1
                or request["runId"] != self.config["runId"]):
            raise ValueError("Invalid control request")
        token = request["token"]
        if not isinstance(token, str) or not token.isascii() or not hmac.compare_digest(token, self.config["controlToken"]):
            raise ValueError("Control authentication failed")
        if request["method"] == "attach" and not self.attached and not self.finishing:
            self.owner = client
            self.attached = True
            client["deadline"] = float("inf")
            phase = "attached"
        elif request["method"] == "finish" and self.owner is client and not self.finishing:
            self.finish("finish")
            phase = "finishing"
        else:
            raise ValueError("Invalid control phase")
        reply = {"protocolVersion": 1, "runId": self.config["runId"], "ok": True, "phase": phase}
        raw = json.dumps(reply, separators=(",", ":")).encode("utf-8")
        client["output"] = bytearray(struct.pack(">I", len(raw)) + raw)

    def close(self):
        for client in tuple(self.clients):
            self.drop(client)
        self.owner = None
        try:
            self.listener.close()
        except OSError:
            pass
