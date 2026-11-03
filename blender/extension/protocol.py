"""Bounded wire messages and errors shared by the local bridge handlers."""

import json
import math
import re
import struct

MAX_FRAME_BYTES = 1024 * 1024
ID_PATTERN = re.compile(r"[1-9][0-9]{0,19}\Z")


class BridgeError(Exception):
    """A recoverable command refusal with an explicit mutation outcome."""

    def __init__(self, code, message, effects="none"):
        super().__init__(message)
        self.code = code
        self.effects = effects


def encode_frame(value):
    """Encode one finite JSON response with a bounded four-byte length prefix."""
    payload = json.dumps(value, allow_nan=False, separators=(",", ":")).encode("utf-8")
    if len(payload) > MAX_FRAME_BYTES:
        raise BridgeError("INTERNAL_ERROR", "Response exceeds the frame limit")
    return struct.pack(">I", len(payload)) + payload


def decode_frame(buffer):
    """Consume one complete JSON frame, retaining partial or following input."""
    if len(buffer) < 4:
        return None
    length = struct.unpack(">I", buffer[:4])[0]
    if length == 0 or length > MAX_FRAME_BYTES:
        raise BridgeError("INVALID_REQUEST", "Invalid frame length")
    if len(buffer) < length + 4:
        return None
    payload = bytes(buffer[4:length + 4])
    del buffer[:length + 4]
    try:
        value = json.loads(payload.decode("utf-8"), parse_constant=_reject_constant)
    except (ValueError, UnicodeError, RecursionError) as error:
        raise BridgeError("INVALID_REQUEST", "Expected a UTF-8 JSON object") from error
    if not isinstance(value, dict):
        raise BridgeError("INVALID_REQUEST", "Expected a JSON object")
    return value


def require_keys(value, required, optional=()):
    """Reject missing and unknown properties at the Python trust boundary."""
    if not isinstance(value, dict):
        raise BridgeError("INVALID_ARGUMENT", "Expected an object")
    if not set(required) <= value.keys() or value.keys() - set(required) - set(optional):
        raise BridgeError("INVALID_ARGUMENT", "Unexpected or missing properties")


def require_number(value, label):
    """Accept finite wire numbers without treating Python booleans as numbers."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise BridgeError("INVALID_ARGUMENT", f"{label} must be a finite number")
    try:
        finite = math.isfinite(value)
    except OverflowError:
        finite = False
    if not finite:
        raise BridgeError("INVALID_ARGUMENT", f"{label} must be a finite number")
    return value


def require_vector(value, label):
    """Validate the three local coordinates used by the initial SDK."""
    if not isinstance(value, list) or len(value) != 3:
        raise BridgeError("INVALID_ARGUMENT", f"{label} must have three numbers")
    return [require_number(component, label) for component in value]


def _reject_constant(value):
    raise ValueError(f"Non-finite JSON constant: {value}")
