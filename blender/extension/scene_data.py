"""Bounded scene data operations shared by GUI dispatch and later background hosts."""

import base64
import heapq
import json
import math

import bpy
from mathutils import Vector

from .protocol import BridgeError, require_keys, require_number, require_vector


SCENE_METHODS = ("scene.inspect", "mesh.create", "material.create", "object.assignMaterial",
                 "camera.create", "light.createArea")


class SceneData:
    """Validate before effects; apply prepared operations to an explicit scene."""

    def __init__(self, commands):
        self.commands = commands
        self.bridge = commands.bridge

    @staticmethod
    def number(value, label, low, high):
        value = require_number(value, label)
        if not low <= value <= high:
            raise BridgeError("INVALID_ARGUMENT", f"{label} is outside the supported range")
        return value

    def vector(self, value, label, low=-1e20, high=1e20):
        return [self.number(item, label, low, high) for item in require_vector(value, label)]

    @staticmethod
    def identifier(value, label):
        if (not isinstance(value, str) or not 1 <= len(value) <= 20
                or not value.isascii() or not value.isdecimal()):
            raise BridgeError("INVALID_ARGUMENT", f"{label} must be a decimal identifier")
        return int(value)

    def material(self, handle):
        require_keys(handle, ("sessionId", "generation", "materialId"))
        self.bridge.require_identity(handle)
        identifier = self.identifier(handle["materialId"], "materialId")
        for material in bpy.data.materials:
            if material.session_uid == identifier:
                return material
        raise BridgeError("MATERIAL_NOT_FOUND", "The material no longer exists")

    def inspect(self, params, scene):
        """UID-ordered fresh observations; cursors do not freeze the scene."""
        require_keys(params, (), ("limit", "cursor"))
        limit = params.get("limit", 50)
        if type(limit) is not int or not 1 <= limit <= 100:
            raise BridgeError("INVALID_ARGUMENT", "limit must be an integer from 1 through 100")
        after = 0
        scene_id = str(scene.session_uid)
        if "cursor" in params:
            cursor = params["cursor"]
            try:
                if not isinstance(cursor, str) or not 1 <= len(cursor) <= 1024 or not cursor.isascii():
                    raise ValueError("Invalid cursor")
                value = json.loads(base64.b64decode(cursor, altchars=b"-_", validate=True).decode("utf-8"))
                require_keys(value, ("sessionId", "generation", "sceneId", "after"))
                self.bridge.require_identity(value)
                if value["sceneId"] != scene_id:
                    raise BridgeError("INVALID_ARGUMENT", "The cursor belongs to another scene")
                after = self.identifier(value["after"], "cursor after")
            except (ValueError, UnicodeError, RecursionError) as error:
                raise BridgeError("INVALID_ARGUMENT", "Invalid scene cursor") from error
        objects = heapq.nsmallest(limit + 1, (obj for obj in scene.objects if obj.session_uid > after),
                                 key=lambda obj: obj.session_uid)
        page = objects[:limit]
        next_cursor = None
        if len(objects) > limit:
            value = {"sessionId": self.bridge.session_id, "generation": self.bridge.generation,
                     "sceneId": scene_id, "after": str(page[-1].session_uid)}
            next_cursor = base64.urlsafe_b64encode(json.dumps(value, separators=(",", ":")).encode("utf-8")).decode("ascii")
        return {"sessionId": self.bridge.session_id, "generation": self.bridge.generation,
                "sceneId": scene_id, "sceneName": scene.name, "frame": scene.frame_current,
                "activeCamera": None if scene.camera is None else self.commands.snapshot(scene.camera)["handle"],
                "objectCount": len(scene.objects),
                "objects": [self.commands.snapshot(obj) for obj in page], "nextCursor": next_cursor}

    def validate(self, method, params, scene):
        """Return normalized wire values; no bpy data is changed here."""
        required, optional = {
            "mesh.create": (("vertices", "faces"), ("name",)),
            "material.create": (("baseColorLinearRGB",), ("name", "roughness", "metallic")),
            "object.assignMaterial": (("object", "material"), ()),
            "camera.create": (("location", "target"), ("name", "lensMm", "clipStart", "clipEnd", "setActive")),
            "light.createArea": (("location", "target"), ("name", "colorLinearRGB", "powerWatts", "size")),
        }[method]
        require_keys(params, required, optional)
        result = dict(params)
        if "name" in params and (not isinstance(params["name"], str) or not params["name"] or "\0" in params["name"]):
            raise BridgeError("INVALID_ARGUMENT", "name must be a nonempty string without NUL")
        if method == "mesh.create":
            vertices, faces = params["vertices"], params["faces"]
            if (not isinstance(vertices, list) or len(vertices) > 8192
                    or not isinstance(faces, list) or len(faces) > 8192):
                raise BridgeError("INVALID_ARGUMENT", "Mesh limits are 8192 vertices and 8192 faces")
            result["vertices"] = [self.vector(vertex, "vertex") for vertex in vertices]
            corners = 0
            for face in faces:
                if not isinstance(face, list) or len(face) < 3:
                    raise BridgeError("INVALID_ARGUMENT", "Every face needs at least three vertex indices")
                corners += len(face)
                if corners > 32768 or any(type(index) is not int or not 0 <= index < len(vertices) for index in face):
                    raise BridgeError("INVALID_ARGUMENT", "Mesh corners exceed 32768 or contain an invalid index")
                if len(set(face)) != len(face):
                    raise BridgeError("INVALID_ARGUMENT", "A face cannot repeat a vertex index")
        elif method == "material.create":
            result["baseColorLinearRGB"] = self.vector(params["baseColorLinearRGB"], "baseColorLinearRGB", 0, 1)
            for key, default in (("roughness", 0.5), ("metallic", 0)):
                result[key] = self.number(params.get(key, default), key, 0, 1)
        elif method == "object.assignMaterial":
            obj = self.commands.resolve(params["object"])
            self.material(params["material"])
            if (obj.type != "MESH" or obj.library is not None or obj.data.library is not None
                    or obj.data.users != 1 or not obj.is_editable or not obj.data.is_editable):
                raise BridgeError("INVALID_ARGUMENT", "Material assignment needs a local editable single-user mesh")
            if len(obj.data.polygons) > 8192 or len(obj.data.loops) > 32768:
                raise BridgeError("INVALID_ARGUMENT", "Material assignment exceeds 8192 polygons or 32768 corners")
        else:
            result["location"] = self.vector(params["location"], "location")
            result["target"] = self.vector(params["target"], "target")
            direction = [target - position for target, position in zip(result["target"], result["location"])]
            length = math.hypot(*direction)
            if length == 0:
                raise BridgeError("INVALID_ARGUMENT", "location and target must differ")
            # Normalize in Python float precision before constructing a float32 Vector.
            rotation = Vector([component / length for component in direction]).to_track_quat("-Z", "Y").to_euler("XYZ")
            result["_rotation"] = self.vector(list(rotation), "rotationEuler")
            if method == "camera.create":
                result["lensMm"] = self.number(params.get("lensMm", 50), "lensMm", 1, 500)
                result["clipStart"] = self.number(params.get("clipStart", 0.1), "clipStart", 1e-6, 1e12)
                result["clipEnd"] = self.number(params.get("clipEnd", 1000), "clipEnd", 1e-6, 1e12)
                result["setActive"] = params.get("setActive", False)
                if type(result["setActive"]) is not bool or result["clipStart"] >= result["clipEnd"]:
                    raise BridgeError("INVALID_ARGUMENT", "setActive must be boolean and clipStart must precede clipEnd")
            else:
                result["colorLinearRGB"] = self.vector(params.get("colorLinearRGB", [1, 1, 1]), "colorLinearRGB", 0, 1)
                result["powerWatts"] = self.number(params.get("powerWatts", 1000), "powerWatts", 0, 1e12)
                result["size"] = self.number(params.get("size", 5), "size", 1e-6, 1e6)
        return result

    def apply(self, method, params, scene, mark_changed):
        """Apply validated values on the main thread; partial errors remain undoable."""
        owned = []
        try:
            if method == "object.assignMaterial":
                obj = self.commands.resolve(params["object"])
                material = self.material(params["material"])
                mark_changed()
                obj.data.materials.clear()
                obj.data.materials.append(material)
                obj.material_slots[0].link = "DATA"
                for polygon in obj.data.polygons:
                    polygon.material_index = 0
                return self.commands.snapshot(obj)
            name = params.get("name", {"mesh.create": "Mesh", "material.create": "Material",
                                       "camera.create": "Camera", "light.createArea": "Area"}[method])
            collection = {"mesh.create": bpy.data.meshes, "material.create": bpy.data.materials,
                          "camera.create": bpy.data.cameras, "light.createArea": bpy.data.lights}[method]
            data = collection.new(name, type="AREA") if method == "light.createArea" else collection.new(name)
            mark_changed()
            owned.append((collection, data))
            if method == "material.create":
                tree = data.node_tree
                if tree is None:
                    raise BridgeError("EXECUTION_ERROR", "The new material has no shader node tree")
                tree.nodes.clear()
                shader = tree.nodes.new("ShaderNodeBsdfPrincipled")
                output = tree.nodes.new("ShaderNodeOutputMaterial")
                shader.inputs["Base Color"].default_value = (*params["baseColorLinearRGB"], 1)
                shader.inputs["Roughness"].default_value = params["roughness"]
                shader.inputs["Metallic"].default_value = params["metallic"]
                shader.inputs["Alpha"].default_value = 1
                tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
                data.diffuse_color = (*params["baseColorLinearRGB"], 1)
                return {"handle": {"sessionId": self.bridge.session_id, "generation": self.bridge.generation,
                                   "materialId": str(data.session_uid)}, "name": data.name,
                        "baseColorLinearRGB": list(shader.inputs["Base Color"].default_value[:3]),
                        "roughness": shader.inputs["Roughness"].default_value,
                        "metallic": shader.inputs["Metallic"].default_value}
            if method == "mesh.create":
                data.from_pydata(params["vertices"], [], params["faces"])
                if data.validate():
                    raise BridgeError("INVALID_ARGUMENT", "Blender rejected invalid mesh geometry")
                data.update()
            elif method == "camera.create":
                data.type = "PERSP"
                data.lens, data.clip_start, data.clip_end = params["lensMm"], params["clipStart"], params["clipEnd"]
                if not data.clip_start < data.clip_end:
                    raise BridgeError("INVALID_ARGUMENT", "Camera clipping distances collapse at Blender float precision")
            else:
                data.color, data.energy, data.size = params["colorLinearRGB"], params["powerWatts"], params["size"]
                data.shape = "SQUARE"
            obj = bpy.data.objects.new(name, data)
            owned.append((bpy.data.objects, obj))
            scene.collection.objects.link(obj)
            if method != "mesh.create":
                obj.location = params["location"]
                obj.rotation_mode = "XYZ"
                obj.rotation_euler = params["_rotation"]
            if method == "camera.create" and params["setActive"]:
                scene.camera = obj
            result = self.commands.snapshot(obj)
            if method == "mesh.create":
                result.update(vertexCount=len(data.vertices), edgeCount=len(data.edges), polygonCount=len(data.polygons))
            elif method == "camera.create":
                result.update(lensMm=data.lens, clipStart=data.clip_start, clipEnd=data.clip_end, isActive=scene.camera == obj)
            else:
                result.update(colorLinearRGB=list(data.color), powerWatts=data.energy, size=data.size)
            return result
        except Exception:
            # Only this call's newly created IDs are removed, never existing user data.
            for collection, data in reversed(owned):
                try:
                    collection.remove(data, do_unlink=True)
                except (ReferenceError, RuntimeError):
                    pass
            raise
