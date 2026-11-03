"""Assert saved native scene semantics independently of Blendia's response codecs."""

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def close(actual, expected):
    """Use a fixed float tolerance for native RNA storage and orientation calculations."""
    assert math.isclose(actual, expected, rel_tol=1e-5, abs_tol=1e-5), (actual, expected)


def main():
    """Inspect a reopened native file and decode its published image without rerendering."""
    arguments = sys.argv[sys.argv.index("--") + 1:]
    if len(arguments) != 2:
        raise ValueError("Supply the PNG and native observation destination")
    image_path, report_path = map(Path, arguments)
    assert image_path.is_absolute() and report_path.is_absolute()
    assert bpy.app.background
    assert bpy.app.version[:2] == (5, 2)
    scene = bpy.context.scene
    assert scene.render.engine == "CYCLES"
    assert scene.cycles.device == "CPU"
    assert scene.cycles.samples == 8
    assert len(scene.objects) == 4
    assert scene.objects.get("Blendia Unsaved Partial Cube") is None

    pyramid = scene.objects["Blendia Pyramid 한글"]
    assert pyramid.type == "MESH"
    vertices = [tuple(vertex.co) for vertex in pyramid.data.vertices]
    expected = [(-1, -1, 0), (1, -1, 0), (1, 1, 0), (-1, 1, 0), (0, 0, 2)]
    assert len(vertices) == len(expected)
    for actual, target in zip(vertices, expected):
        for value, component in zip(actual, target):
            close(value, component)
    faces = [tuple(polygon.vertices) for polygon in pyramid.data.polygons]
    assert faces == [(3, 2, 1, 0), (0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)]
    assert len(pyramid.data.materials) == 1
    assert all(polygon.material_index == 0 for polygon in pyramid.data.polygons)
    material = pyramid.data.materials[0]
    assert material.name == "Blendia Blue"
    shader = next(node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    for actual, target in zip(shader.inputs["Base Color"].default_value, (0.08, 0.3, 0.8, 1)):
        close(actual, target)
    close(shader.inputs["Roughness"].default_value, 0.35)
    close(shader.inputs["Metallic"].default_value, 0.1)
    floor = scene.objects["Blendia Ground"]
    assert len(floor.data.vertices) == 4 and len(floor.data.polygons) == 1
    assert floor.data.materials[0].name == "Blendia Ground Matte"

    camera = scene.objects["Blendia Camera"]
    assert scene.camera == camera and camera.type == "CAMERA"
    close(camera.data.lens, 50)
    for actual, target in zip(camera.location, (5, -7, 5)):
        close(actual, target)
    direction = camera.rotation_euler.to_quaternion() @ Vector((0, 0, -1))
    target_direction = (Vector((0, 0, 0.9)) - camera.location).normalized()
    close(direction.dot(target_direction), 1)
    light = scene.objects["Blendia Softbox"]
    assert light.type == "LIGHT" and light.data.type == "AREA"
    close(light.data.energy, 1000)
    close(light.data.size, 5)

    image = bpy.data.images.load(str(image_path), check_existing=False)
    try:
        assert tuple(image.size) == (128, 128)
        pixels = list(image.pixels)
        intensity = [sum(pixels[index:index + 3]) / 3 for index in range(0, len(pixels), 4)]
        assert intensity and max(intensity) - min(intensity) > 0.05, "Native PNG must contain spatial scene variation"
        report = {
            "blenderVersion": bpy.app.version_string,
            "engine": scene.render.engine,
            "device": scene.cycles.device,
            "objectCount": len(scene.objects),
            "vertices": vertices,
            "faces": faces,
            "camera": camera.name,
            "lightWatts": light.data.energy,
            "imageSize": list(image.size),
            "pixelIntensityRange": [min(intensity), max(intensity)],
            "unsavedPartialObjectAbsent": True,
        }
        with report_path.open("x", encoding="utf8") as output:
            json.dump(report, output, indent=2)
    finally:
        bpy.data.images.remove(image)
    print("BLENDIA_NATIVE_SCENE_AND_IMAGE_OK")


main()
