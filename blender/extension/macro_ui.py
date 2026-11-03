"""Project TypeScript controls in the viewport and active Text editor."""

import bpy

from .macro_process import launcher
from .server import bridge


class BLENDIA_PG_macro_settings(bpy.types.PropertyGroup):
    """Explicit project context; no token or live RNA handle is stored here."""

    project_root: bpy.props.StringProperty(name="Project Directory", subtype="DIR_PATH")
    source_path: bpy.props.StringProperty(name="Source Path", description="Project-relative or absolute TypeScript file; required for unsaved Text identity")
    tsconfig: bpy.props.StringProperty(name="Project tsconfig", description="Optional config path relative to the project directory")
    node_executable: bpy.props.StringProperty(name="Node Executable", subtype="FILE_PATH", description="Absolute Node executable path; shell wrappers are unsupported")
    ttsc_package: bpy.props.StringProperty(name="ttsc package.json", subtype="FILE_PATH", description="Absolute installed ttsc package.json; its public ttsx launcher runs the local CLI source")
    cli_entry: bpy.props.StringProperty(name="CLI Entry", subtype="FILE_PATH", description="Absolute Blendia CLI source src/bin.ts, or a published JavaScript entry")
    arguments: bpy.props.StringProperty(name="Arguments (JSON)", default="[]", description="Script arguments as a JSON array of strings")


class BLENDIA_OT_run_file(bpy.types.Operator):
    """Run the configured on-disk project entry through the public CLI."""

    bl_idname = "blendia.run_file"
    bl_label = "Run TypeScript File"

    def execute(self, context):
        try:
            launcher.launch(context.window_manager.blendia_macros)
        except Exception as error:
            self.report({"ERROR"}, str(error))
            return {"CANCELLED"}
        return {"FINISHED"}


class BLENDIA_OT_run_text(bpy.types.Operator):
    """Snapshot the active Text as a module macro without editing either original."""

    bl_idname = "blendia.run_text"
    bl_label = "Run Active Text Snapshot"

    @classmethod
    def poll(cls, context):
        return context.area is not None and context.area.type == "TEXT_EDITOR" and context.space_data.text is not None

    def execute(self, context):
        text = context.space_data.text
        try:
            launcher.launch(context.window_manager.blendia_macros, text=text.as_string(), origin=text.name)
        except Exception as error:
            self.report({"ERROR"}, str(error))
            return {"CANCELLED"}
        return {"FINISHED"}


class BLENDIA_OT_copy_macro_log(bpy.types.Operator):
    """Copy the bounded output tail, including source and staging diagnostics."""

    bl_idname = "blendia.copy_macro_log"
    bl_label = "Copy TypeScript Output"

    def execute(self, context):
        context.window_manager.clipboard = ("[Earlier output truncated]\n" if launcher.truncated else "") + launcher.log
        return {"FINISHED"}


def draw_macros(layout, context, active_text=False):
    """Show actual launcher state without retaining RNA between draw callbacks."""
    settings = context.window_manager.blendia_macros
    for name in ("project_root", "source_path", "tsconfig", "node_executable", "ttsc_package", "cli_entry", "arguments"):
        layout.prop(settings, name)
    row = layout.column()
    row.enabled = bridge.running and not launcher.running and not launcher.uncertain
    row.operator("blendia.run_file")
    if active_text:
        row.operator("blendia.run_text")
        layout.label(text="Text runs as a staged module sibling", icon="INFO")
    if not bridge.running:
        layout.label(text="Start Blendia in the viewport first", icon="INFO")
    layout.label(text=launcher.status[:150])
    if launcher.uncertain:
        layout.label(text="Resolve descendants, then restart Blender", icon="ERROR")
    layout.label(text="Stopping Blendia does not cancel TypeScript", icon="INFO")
    if launcher.truncated:
        layout.label(text="Earlier output truncated", icon="INFO")
    if launcher.log:
        box = layout.box()
        for line in launcher.log.splitlines()[-10:]:
            box.label(text=line[:150])
        layout.operator("blendia.copy_macro_log")


class BLENDIA_PT_macros(bpy.types.Panel):
    """Run project files from Blender's existing viewport sidebar."""

    bl_label = "TypeScript Macros"
    bl_idname = "BLENDIA_PT_macros"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Blendia"

    def draw(self, context):
        draw_macros(self.layout, context)


class BLENDIA_PT_text_macros(bpy.types.Panel):
    """Run the actual active Text from its own editor context."""

    bl_label = "TypeScript Macros"
    bl_idname = "BLENDIA_PT_text_macros"
    bl_space_type = "TEXT_EDITOR"
    bl_region_type = "UI"
    bl_category = "Blendia"

    def draw(self, context):
        draw_macros(self.layout, context, active_text=True)


MACRO_CLASSES = (BLENDIA_PG_macro_settings, BLENDIA_OT_run_file, BLENDIA_OT_run_text,
                 BLENDIA_OT_copy_macro_log, BLENDIA_PT_macros, BLENDIA_PT_text_macros)
