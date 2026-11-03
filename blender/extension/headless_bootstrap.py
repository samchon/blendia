"""Public --python entry for one owned background session; no GUI registration."""

import importlib
import importlib.machinery
import sys
import time
import types
from pathlib import Path

import bpy


def main():
    """Keep the background --python script alive and pump bpy on this thread."""
    if not bpy.app.background:
        raise RuntimeError("The owned bootstrap requires background Blender")
    arguments = sys.argv[sys.argv.index("--") + 1:]
    if len(arguments) != 1 or not Path(arguments[0]).is_absolute():
        raise ValueError("Supply one absolute private configuration path")
    directory = Path(__file__).resolve().parent
    namespace = "_blendia_owned_headless"
    if namespace in sys.modules:
        raise RuntimeError("An owned bootstrap is already active")

    # A namespace package imports only colocated core, without executing addon __init__.
    package = types.ModuleType(namespace)
    package.__path__ = [str(directory)]
    package.__package__ = namespace
    package.__spec__ = importlib.machinery.ModuleSpec(namespace, loader=None, is_package=True)
    package.__spec__.submodule_search_locations = [str(directory)]
    sys.modules[namespace] = package
    private = importlib.import_module(f"{namespace}.headless_control")
    config = private.load_config(arguments[0])
    server = importlib.import_module(f"{namespace}.server")
    bridge = server.bridge
    control = None
    stopping = False
    try:
        control = private.HeadlessControl(config)
        bridge.start(directory=config["directory"], token=config["controlToken"])
        server.register_handlers()
        private.publish_ready(config, bridge, control)
        while True:
            control.poll()
            if not bridge.running and not stopping:
                control.finish("bridge-stopped")
            if control.finishing:
                if not stopping:
                    stopping = True
                    bridge.stop()
                bridge.renders.tick()
                if not bpy.app.is_job_running("RENDER") and (control.flushed or control.flush_expired):
                    if bridge.renders.busy:
                        raise RuntimeError("Owned background cleanup remains uncertain")
                    return 0 if control.reason == "finish" and control.flushed else 1
            else:
                bridge.tick()
            time.sleep(0.01)
    finally:
        try:
            bridge.stop()
        finally:
            try:
                server.unregister_handlers()
            finally:
                if control is not None:
                    control.close()


if __name__ == "__main__":
    try:
        status = main()
    except Exception:
        # Configuration and invocation secrets must never become public diagnostics.
        print("Blendia owned background bootstrap failed; execution may be incomplete.", file=sys.stderr)
        status = 1
    if status:
        raise SystemExit(status)
