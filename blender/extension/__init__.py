"""Blender controls for the authenticated Blendia TypeScript bridge."""

import atexit
import json

import bpy

from .commands import BLENDIA_OT_mutate
from .macro_process import launcher
from .macro_ui import BLENDIA_PG_macro_settings, MACRO_CLASSES
from .server import bridge, register_handlers, unregister_handlers


class BLENDIA_OT_start(bpy.types.Operator):
    """Start a new local connection without changing the user's scene."""

    bl_idname = "blendia.start"
    bl_label = "Start Blendia"

    def execute(self, context):
        try:
            bridge.start()
        except Exception as error:
            self.report({"ERROR"}, f"Cannot start Blendia: {error}")
            return {"CANCELLED"}
        return {"FINISHED"}


class BLENDIA_OT_stop(bpy.types.Operator):
    """Revoke the local session and close all extension-owned sockets."""

    bl_idname = "blendia.stop"
    bl_label = "Stop Blendia"

    def execute(self, context):
        bridge.stop()
        return {"FINISHED"}


class BLENDIA_OT_copy_connection(bpy.types.Operator):
    """Copy local environment values; the clipboard contains a session secret."""

    bl_idname = "blendia.copy_connection"
    bl_label = "Copy Connection Environment"
    bl_description = "Copy BLENDIA_PORT and BLENDIA_TOKEN as JSON; keep the token private"

    def execute(self, context):
        if not bridge.running:
            return {"CANCELLED"}
        context.window_manager.clipboard = json.dumps({
            "BLENDIA_PORT": str(bridge.port), "BLENDIA_TOKEN": bridge.token,
        })
        return {"FINISHED"}


class BLENDIA_OT_copy_descriptor(bpy.types.Operator):
    """Copy the descriptor path without placing the secret itself on screen."""

    bl_idname = "blendia.copy_descriptor"
    bl_label = "Copy Session File Path"

    def execute(self, context):
        if not bridge.running:
            return {"CANCELLED"}
        context.window_manager.clipboard = bridge.descriptor_path
        return {"FINISHED"}


class BLENDIA_PT_session(bpy.types.Panel):
    """Keep connection ownership visible in the existing Blender viewport."""

    bl_label = "Blendia"
    bl_idname = "BLENDIA_PT_session"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Blendia"

    def draw(self, context):
        layout = self.layout
        if not bridge.running:
            layout.label(text="Project TypeScript connection is off")
            if bridge.last_error:
                layout.label(text=bridge.last_error, icon="ERROR")
            layout.operator("blendia.start")
            return
        layout.label(text=f"Local port: {bridge.port}")
        layout.label(text="Client connected" if bridge.owner else "Waiting for a TypeScript client")
        layout.label(text=f"Scene generation: {bridge.generation}")
        layout.operator("blendia.copy_connection")
        layout.operator("blendia.copy_descriptor")
        layout.operator("blendia.stop")


CLASSES = (BLENDIA_OT_mutate, BLENDIA_OT_start, BLENDIA_OT_stop,
           BLENDIA_OT_copy_connection, BLENDIA_OT_copy_descriptor, BLENDIA_PT_session,
           *MACRO_CLASSES)


def register():
    """Register controls without opening a socket until the user selects Start."""
    for cls in CLASSES:
        bpy.utils.register_class(cls)
    bpy.types.WindowManager.blendia_macros = bpy.props.PointerProperty(type=BLENDIA_PG_macro_settings)
    launcher.enabled = True
    bridge.enabled = True
    register_handlers()
    atexit.register(bridge.close_transport)
    atexit.unregister(launcher.abandon_at_exit)
    atexit.register(launcher.abandon_at_exit)
    atexit.unregister(bridge.artifacts.cleanup_files)
    atexit.register(bridge.artifacts.cleanup_files)


def unregister():
    """Revoke the session before removing classes and lifecycle callbacks."""
    launcher.enabled = False
    bridge.enabled = False
    try:
        bridge.stop()
    finally:
        atexit.unregister(bridge.close_transport)
        if not bridge.renders.busy:
            atexit.unregister(bridge.artifacts.cleanup_files)

        # Live launch/render owners retain their own drain and cleanup callbacks.
        if not launcher.running:
            atexit.unregister(launcher.abandon_at_exit)
        unregister_handlers()
        del bpy.types.WindowManager.blendia_macros
        for cls in reversed(CLASSES):
            bpy.utils.unregister_class(cls)
