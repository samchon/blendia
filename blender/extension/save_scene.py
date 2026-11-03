"""Save the current native working state without switching its document path."""

import bpy

from .file_publish import OwnedStage, destination
from .protocol import BridgeError, require_keys


def save_blend_copy(bridge, params):
    """Save a native sibling copy before atomically publishing the explicit name."""
    require_keys(params, ("path",), ("overwrite",))
    if bridge.loading or bridge.renders.busy or bpy.app.is_job_running("RENDER"):
        raise BridgeError("BUSY", "Finish rendering and filepath restoration before saving")
    overwrite = params.get("overwrite", False)
    target = destination(params["path"], ".blend", overwrite)

    # Native Save Copy can otherwise save unrelated external images first.
    paths = bpy.context.preferences.filepaths
    if paths.save_modified_images == "ALWAYS_SAVE":
        for image in bpy.data.images:
            if (image.is_dirty and image.filepath and image.packed_file is None
                    and image.type not in {"RENDER_RESULT", "COMPOSITING"}):
                raise BridgeError("INVALID_CONTEXT", "Native Always Save would write a modified external image")
    if not bpy.ops.wm.save_as_mainfile.poll():
        raise BridgeError("INVALID_CONTEXT", "Blender cannot save a native file in this context")
    session_id, generation = bridge.session_id, bridge.generation
    original = bpy.data.filepath
    stage = OwnedStage(target, overwrite, native=True)
    try:
        try:
            result = bpy.ops.wm.save_as_mainfile(
                "EXEC_DEFAULT", filepath=str(stage.path), check_existing=False,
                copy=True, relative_remap=True, compress=False,
                show_save_modified_images_dialog=False,
            )
            if "FINISHED" not in result:
                raise BridgeError("EXECUTION_ERROR", "Native Save Copy did not finish", "possible")
            if bpy.data.filepath != original:
                raise BridgeError("OUTCOME_UNKNOWN", "Native save handlers changed the working filepath", "possible")
            if bridge.session_id != session_id or bridge.generation != generation:
                raise BridgeError("OUTCOME_UNKNOWN", "Scene history changed during Save Copy", "possible")
            if stage.path.stat().st_size == 0:
                raise BridgeError("IO_ERROR", "Native Save Copy produced an empty file", "possible")
            output = stage.publish()
            output.update(sourceSessionId=session_id, generation=generation)
            return output
        except BridgeError:
            raise
        except Exception as error:
            raise BridgeError("EXECUTION_ERROR", f"Native Save Copy failed: {error}", "possible") from error
    finally:
        stage.cleanup()
