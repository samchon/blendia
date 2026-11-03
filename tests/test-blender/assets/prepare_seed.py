"""Prepare actual CPU Cycles settings without a GPU, display server, or committed binary fixture."""

import sys
from pathlib import Path

import bpy


def main():
    """Reserve the engine baseline that the public TypeScript recipe will load."""
    if bpy.app.version[:2] != (5, 2):
        raise RuntimeError("Actual engine tests require Blender 5.2")
    arguments = sys.argv[sys.argv.index("--") + 1:]
    if not 1 <= len(arguments) <= 2:
        raise ValueError("Supply a seed destination and optional empty/shared scene kind")
    destination = Path(arguments[0])
    kind = arguments[1] if len(arguments) == 2 else "empty"
    if kind not in {"empty", "shared"}:
        raise ValueError("Unsupported native scene kind")
    if not destination.is_absolute() or destination.exists():
        raise ValueError("Seed must have a fresh absolute output path")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 8
    scene.cycles.seed = 42
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.use_denoising = False
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 2
    scene.world.color = (0.05, 0.05, 0.05)
    scene.render.image_settings.file_format = "PNG"
    if kind == "shared":
        mesh = bpy.data.meshes.new("Shared Original Mesh")
        mesh.from_pydata([(-1, -1, 0), (1, -1, 0), (1, 1, 0), (-1, 1, 0)], [], [(0, 1, 2), (0, 2, 3)])
        mesh.update()
        material = bpy.data.materials.new("Original Shared Material")
        shader = next(node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
        shader.inputs["Base Color"].default_value = (0.2, 0.4, 0.6, 1)
        mesh.materials.append(material)
        for name, location in (("Shared A", (0, 0, 0)), ("Shared B", (3, 0, 0))):
            obj = bpy.data.objects.new(name, mesh)
            scene.collection.objects.link(obj)
            obj.location = location
    result = bpy.ops.wm.save_as_mainfile(filepath=str(destination), check_existing=False)
    if result != {"FINISHED"}:
        raise RuntimeError("Native CPU seed was not saved")


main()
