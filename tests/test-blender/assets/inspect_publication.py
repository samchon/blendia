"""Observe a real native file published through explicit overwrite."""

import json
import sys
from pathlib import Path

import bpy


def main():
    """Check the final authored transform rather than treating nonempty bytes as scene correctness."""
    arguments = sys.argv[sys.argv.index("--") + 1:]
    if len(arguments) != 1:
        raise ValueError("Supply one observation destination")
    cube = bpy.context.scene.objects["Published Cube"]
    assert cube.type == "MESH"
    assert tuple(cube.location) == (3, 2, 1)
    assert len(cube.data.vertices) == 8 and len(cube.data.polygons) == 6
    assert bpy.context.scene.camera is not None
    report = {"cube": cube.name, "location": list(cube.location), "vertices": len(cube.data.vertices), "polygons": len(cube.data.polygons)}
    with Path(arguments[0]).open("x", encoding="utf8") as output:
        json.dump(report, output, indent=2)
    print("BLENDIA_NATIVE_PUBLICATION_OK")


main()
