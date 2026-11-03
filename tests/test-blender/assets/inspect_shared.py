"""Inspect real saved mesh sharing and shading after rejected SDK assignments."""

import json
import math
import sys
from pathlib import Path

import bpy


def main():
    """Confirm both siblings retain the original native mesh and material."""
    arguments = sys.argv[sys.argv.index("--") + 1:]
    if len(arguments) != 1:
        raise ValueError("Supply one observation destination")
    first = bpy.context.scene.objects["Shared A"]
    second = bpy.context.scene.objects["Shared B"]
    assert first.data == second.data and first.data.users == 2
    assert len(bpy.context.scene.objects) == 2
    assert tuple(first.location) == (0, 0, 0)
    assert tuple(second.location) == (3, 0, 0)
    assert [tuple(vertex.co) for vertex in first.data.vertices] == [(-1, -1, 0), (1, -1, 0), (1, 1, 0), (-1, 1, 0)]
    assert [tuple(face.vertices) for face in first.data.polygons] == [(0, 1, 2), (0, 2, 3)]
    assert all(face.material_index == 0 for face in first.data.polygons)
    assert len(first.data.materials) == 1
    material = first.data.materials[0]
    assert material.name == "Original Shared Material"
    shader = next(node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    for actual, expected in zip(shader.inputs["Base Color"].default_value, (0.2, 0.4, 0.6, 1)):
        assert math.isclose(actual, expected, rel_tol=1e-5, abs_tol=1e-5)
    replacement = bpy.data.materials.get("Unassigned Replacement")
    assert replacement is None or replacement not in first.data.materials[:]
    report = {"sharedUsers": first.data.users, "material": material.name, "faceSlots": [face.material_index for face in first.data.polygons]}
    with Path(arguments[0]).open("x", encoding="utf8") as output:
        json.dump(report, output, indent=2)
    print("BLENDIA_SHARED_MESH_PRESERVED_OK")


main()
