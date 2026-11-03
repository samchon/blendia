"""Allowlisted scene operations; Blender remains the geometry and undo owner."""

import bpy

from .protocol import BridgeError, require_keys, require_number, require_vector


class SceneCommands:
    """Resolve fresh Blender IDs and dispatch mutations through one undo operator."""

    def __init__(self, bridge):
        self.bridge = bridge
        self.pending = None
        self.result = None
        self.error = None
        self.effects = "none"

    def execute(self, method, params):
        """Validate before mutation and report possible effects after partial failure."""
        if method == "cube.create":
            require_keys(params, (), ("name", "size"))
            size = require_number(params.get("size", 2), "size")
            if size <= 0 or size > 1e20:
                raise BridgeError("INVALID_ARGUMENT", "size must be positive and at most 1e20")
            if "name" in params and (not isinstance(params["name"], str) or not params["name"]):
                raise BridgeError("INVALID_ARGUMENT", "name must be a nonempty string")
        elif method == "object.get":
            require_keys(params, ("object",))
            return self.snapshot(self.resolve(params["object"]))
        elif method == "object.setTransform":
            require_keys(params, ("object",), ("location", "rotationEuler", "scale"))
            if len(params) == 1:
                raise BridgeError("INVALID_ARGUMENT", "Supply at least one transform")
            self.resolve(params["object"])
            for key in ("location", "rotationEuler", "scale"):
                if key in params:
                    vector = require_vector(params[key], key)
                    if any(abs(value) > 1e20 for value in vector):
                        raise BridgeError("INVALID_ARGUMENT", f"{key} exceeds Blender's supported range")
        else:
            raise BridgeError("UNKNOWN_METHOD", "Unknown bridge method")

        # An undoable operator owns each mutation rather than a timer-side undo push.
        if bpy.context.mode != "OBJECT":
            raise BridgeError("INVALID_CONTEXT", "Switch Blender to Object Mode before modifying the scene")
        if not bpy.context.preferences.edit.use_global_undo:
            raise BridgeError("INVALID_CONTEXT", "Enable Global Undo before modifying the scene")
        self.pending = (method, params)
        self.result = None
        self.error = None
        self.effects = "none"
        try:
            outcome = bpy.ops.blendia.mutate("EXEC_DEFAULT", True)
            if "FINISHED" not in outcome:
                raise BridgeError("INVALID_CONTEXT", "Blender refused the mutation")
            if self.error is not None:
                raise self.error
            return self.result
        except BridgeError:
            raise
        except Exception as error:
            raise BridgeError("EXECUTION_ERROR", str(error), self.effects) from error
        finally:
            self.pending = None
            self.result = None
            self.error = None
            self.effects = "none"

    def mutate(self):
        """Called only by the registered Blender operator on the main thread."""
        method, params = self.pending
        changed = False
        try:
            if method == "cube.create":
                half = params.get("size", 2) / 2
                vertices = [(x * half, y * half, z * half) for x, y, z in (
                    (-1, -1, -1), (-1, -1, 1), (-1, 1, -1), (-1, 1, 1),
                    (1, -1, -1), (1, -1, 1), (1, 1, -1), (1, 1, 1),
                )]
                faces = [(0, 2, 6, 4), (1, 5, 7, 3), (0, 4, 5, 1),
                         (2, 3, 7, 6), (0, 1, 3, 2), (4, 6, 7, 5)]
                name = params.get("name", "Cube")
                mesh = bpy.data.meshes.new(name)
                changed = True
                self.effects = "possible"
                mesh.from_pydata(vertices, [], faces)
                mesh.update()
                obj = bpy.data.objects.new(name, mesh)
                bpy.context.scene.collection.objects.link(obj)
            else:
                obj = self.resolve(params["object"])
                changed = True
                self.effects = "possible"
                if "location" in params:
                    obj.location = params["location"]
                if "rotationEuler" in params:
                    obj.rotation_mode = "XYZ"
                    obj.rotation_euler = params["rotationEuler"]
                if "scale" in params:
                    obj.scale = params["scale"]
            self.result = self.snapshot(obj)
        except Exception as error:
            effects = "possible" if changed else "none"
            self.error = BridgeError("EXECUTION_ERROR", str(error), effects)

    def resolve(self, handle):
        """Reject stale generations and resolve fresh RNA wrappers by session UID."""
        require_keys(handle, ("sessionId", "generation", "objectId"))
        self.bridge.require_identity(handle)
        identifier = handle["objectId"]
        if (not isinstance(identifier, str) or len(identifier) > 20
                or not identifier.isascii() or not identifier.isdecimal()):
            raise BridgeError("INVALID_ARGUMENT", "objectId must be a decimal string")
        for obj in bpy.data.objects:
            if str(obj.session_uid) == identifier:
                return obj
        raise BridgeError("OBJECT_NOT_FOUND", "The object no longer exists")

    def snapshot(self, obj):
        """Return original local properties, never an evaluated world transform."""
        result = {
            "handle": {"sessionId": self.bridge.session_id,
                       "generation": self.bridge.generation,
                       "objectId": str(obj.session_uid)},
            "name": obj.name,
            "type": obj.type,
            "location": list(obj.location),
            "rotationEuler": list(obj.rotation_euler),
            "scale": list(obj.scale),
        }
        for key in ("location", "rotationEuler", "scale"):
            require_vector(result[key], key)
        return result


class BLENDIA_OT_mutate(bpy.types.Operator):
    """Apply a validated bridge mutation as one native Blender undo step."""

    bl_idname = "blendia.mutate"
    bl_label = "Blendia Scene Edit"
    bl_options = {"REGISTER", "UNDO", "INTERNAL"}

    def execute(self, context):
        from .server import bridge

        if bridge.commands.pending is None:
            return {"CANCELLED"}
        bridge.commands.mutate()

        # Partial errors must retain an undo entry; the wire reports their effects.
        return {"FINISHED"}
