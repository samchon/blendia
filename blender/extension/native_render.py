"""Share render provenance and retirement while retaining native GUI invocation."""

import os
import time
import uuid
from collections import OrderedDict
from datetime import datetime, timezone

import bpy
from bpy.app.handlers import persistent

from .protocol import BridgeError, require_keys


class NativeRender:
    """Own render correlation, temporary output routing and deferred retirement."""

    def __init__(self, bridge, artifacts):
        self.bridge = bridge
        self.artifacts = artifacts
        self.session_id = ""
        self.jobs = OrderedDict()
        self.seen_ids = set()
        self.active = None
        self.retiring = False
        self.unresolved = None
        self.pending_cleanup = set()
        self.serial = 0
        self.timer = self.tick

        # Keep exact persistent closure objects, independent of registered UI classes.
        @persistent
        def initialized(scene, *_):
            self.serial += 1
            job = self.active
            if job is not None:
                if job["initSerial"] is None and self._scene_matches(scene, job):
                    job["initSerial"] = self.serial
                else:
                    job["conflict"] = "Another native render initialized before finalization"

        @persistent
        def completed(scene, *_):
            self._signal(scene, "complete")

        @persistent
        def cancelled(scene, *_):
            self._signal(scene, "cancel")

        self.handlers = (("render_init", initialized), ("render_complete", completed),
                         ("render_cancel", cancelled))

    @property
    def busy(self):
        if self.unresolved is not None:
            job = self.unresolved
            scene = self._scene(job)
            if scene is None or not self._owns_filepath(scene, job):
                self.unresolved = None
        return (self.active is not None or self.unresolved is not None
                or bool(self.pending_cleanup) or self.retiring)

    def start_session(self, session_id):
        """Refuse session replacement while old native output still needs retirement."""
        if self.busy:
            raise BridgeError("BUSY", "Wait for native render retirement and filepath restoration")
        self.artifacts.start(session_id)
        self.session_id = session_id
        self.jobs.clear()
        self.seen_ids.clear()
        self.retiring = False

    def start(self, params):
        """Apply persistent settings and invoke the adapter's native still operation."""
        require_keys(params, ("renderId",), ("width", "height"))
        identifier = self._identifier(params["renderId"])
        if identifier in self.seen_ids:
            raise BridgeError("DUPLICATE_ID", "This renderId was already accepted; inspect it instead")
        if len(self.seen_ids) >= 4096:
            raise BridgeError("LIMIT_EXCEEDED", "Start a new session after 4096 accepted render IDs")
        if self.busy or self.bridge.loading or bpy.app.is_job_running("RENDER"):
            raise BridgeError("BUSY", "A native render or filepath restoration is still active")
        execution_context = self._execution_context()
        if not self.session_id or self.session_id != self.bridge.session_id:
            raise BridgeError("INVALID_CONTEXT", "No current render session is active")
        scene = bpy.context.scene
        if scene.camera is None or scene.camera.type != "CAMERA":
            raise BridgeError("INVALID_CONTEXT", "Select an active scene camera before rendering")
        if scene.render.use_multiview:
            raise BridgeError("INVALID_CONTEXT", "The PNG artifact operation requires a single-view render")
        if scene.render.use_border and scene.render.use_crop_to_border:
            raise BridgeError("INVALID_CONTEXT", "Disable cropped render borders before creating a PNG artifact")
        if not bpy.ops.render.render.poll():
            raise BridgeError("INVALID_CONTEXT", "Blender cannot render in the current context")
        width = self._dimension(params.get("width", 512), scene, "resolution_x")
        height = self._dimension(params.get("height", 512), scene, "resolution_y")
        stage = self.artifacts.reserve()
        public = {"handle": {"sessionId": self.session_id, "renderId": identifier},
                  "startGeneration": self.bridge.generation, "sceneId": str(scene.session_uid),
                  "sceneName": scene.name, "cameraObjectId": str(scene.camera.session_uid),
                  "engine": scene.render.engine, "frame": scene.frame_current,
                  "width": width, "height": height, "startedAt": self._now(), "status": "running"}
        job = {"public": public, "stage": stage, "originalPath": scene.render.filepath,
               "generation": self.bridge.generation, "initSerial": None, "outcome": None,
               "conflict": None, "launchError": None, "seenRunning": False,
               "subframe": scene.frame_subframe, "finished": None}
        try:
            self._install()
        except Exception:
            self.artifacts.discard(stage)
            self._remove_handlers()
            raise
        self.active = job
        self.jobs[identifier] = job
        self.seen_ids.add(identifier)
        try:
            # These requested settings persist so Save Copy can reproduce this still.
            scene.render.resolution_x = width
            scene.render.resolution_y = height
            scene.render.resolution_percentage = 100
            scene.render.image_settings.file_format = "PNG"
            scene.render.image_settings.color_depth = "8"
            scene.render.image_settings.color_mode = "RGBA"
            scene.render.filepath = str(stage)
            result = bpy.ops.render.render(execution_context, write_still=True, scene=scene.name)
            if not result.intersection({"RUNNING_MODAL", "FINISHED"}):
                job["launchError"] = "Native render invocation was cancelled before completion"
        except Exception as error:
            job["launchError"] = f"Native render invocation failed: {error}"
        self.tick()
        return dict(public)

    def get(self, params):
        """Return retained metadata without re-running a caller's render ID."""
        require_keys(params, ("renderId",))
        identifier = self._identifier(params["renderId"])
        self.tick()
        job = self.jobs.get(identifier)
        if job is None:
            raise BridgeError("NOT_FOUND", "The render is unknown or its terminal metadata expired")
        return dict(job["public"])

    def invalidate(self, reason="Scene history changed"):
        """Invalidate provenance before undo/load can release the original scene."""
        if self.active is not None:
            self.active["conflict"] = reason

    def retire(self):
        """Stop admission, retaining callbacks until native rendering actually ends."""
        self.retiring = True
        if not bpy.app.timers.is_registered(self.timer):
            bpy.app.timers.register(self.timer, first_interval=0.05, persistent=True)
        self.tick()
        return self.busy

    def tick(self):
        """Finalize on the main thread only after a terminal signal and native closure."""
        try:
            self.artifacts.expire()
        except Exception as error:
            self.bridge.last_error = f"Artifact expiry needs attention: {error}"
        try:
            self._prune()
            for path in tuple(self.pending_cleanup):
                if self.unresolved is not None and self.unresolved["stage"] == path:
                    scene = self._scene(self.unresolved)
                    if scene is not None and self._owns_filepath(scene, self.unresolved):
                        continue
                    self.unresolved = None
                if bpy.app.is_job_running("RENDER"):
                    continue
                try:
                    self.artifacts.discard(path)
                    self.pending_cleanup.remove(path)
                except OSError as error:
                    self.bridge.last_error = f"Render stage cleanup needs attention: {error}"
            job = self.active
            if job is not None:
                running = bpy.app.is_job_running("RENDER")
                job["seenRunning"] = job["seenRunning"] or running
                if running:
                    return 0.05
                if job["outcome"] is not None or job["launchError"] is not None:
                    self._finish(job)
                elif job["seenRunning"]:
                    job["conflict"] = "Native rendering ended without an owned terminal callback"
                    self._finish(job)
            if (self.retiring and self.active is None and self.unresolved is None
                    and not self.pending_cleanup):
                self._retired()
            return 0.05 if self.busy else None
        except Exception as error:
            # Keep the retirement owner alive rather than silently dropping native state.
            self.bridge.last_error = f"Render retirement needs attention: {type(error).__name__}: {error}"
            return 0.1 if self.busy else None

    def _signal(self, scene, outcome):
        job = self.active
        if job is not None and self._scene_matches(scene, job):
            if job["initSerial"] is None or self.serial != job["initSerial"]:
                job["conflict"] = "Native render callbacks cannot be attributed to this job"
            job["outcome"] = outcome
            job["public"]["status"] = "finalizing"

    def _finish(self, job):
        public = job["public"]
        scene = self._scene(job)
        error = None
        if job["conflict"] or self.bridge.generation != job["generation"]:
            error = ("unknown", "OUTCOME_UNKNOWN", job["conflict"] or "Scene history changed")
        elif job["launchError"]:
            error = ("failed", "EXECUTION_ERROR", job["launchError"])
        elif job["outcome"] == "cancel":
            error = ("cancelled", "RENDER_CANCELLED", "Blender reported native render cancellation")
        elif scene is None or not self._settings_match(scene, job):
            error = ("unknown", "OUTCOME_UNKNOWN", "Scene settings changed before PNG finalization")
        if not self._restore(scene, job):
            error = ("unknown", "SETTINGS_RESTORE_FAILED", "The owned render filepath needs restoration")
        try:
            if error is None:
                if job["initSerial"] is None or self.serial != job["initSerial"]:
                    raise BridgeError("OUTCOME_UNKNOWN", "Another render changed output ownership", "possible")
                artifact = self.artifacts.adopt(job["stage"], public)
                if (job["conflict"] or self.serial != job["initSerial"]
                        or self.bridge.generation != job["generation"]):
                    self.artifacts.release({"artifactId": artifact["handle"]["artifactId"]})
                    raise BridgeError("OUTCOME_UNKNOWN", "Render ownership changed during PNG finalization", "possible")
                public.update(status="succeeded", artifact=artifact)
            else:
                status, code, message = error
                public.update(status=status, error={"code": code, "message": message[:2048], "effects": "possible"})
        except Exception as failure:
            code = failure.code if isinstance(failure, BridgeError) else "IO_ERROR"
            status = "unknown" if code == "OUTCOME_UNKNOWN" else "failed"
            public.update(status=status, error={"code": code, "message": str(failure)[:2048], "effects": "possible"})
        public["finishedAt"] = self._now()
        job["finished"] = time.monotonic()
        try:
            if self.unresolved is job:
                self.pending_cleanup.add(job["stage"])
            else:
                self.artifacts.discard(job["stage"])
        except OSError as failure:
            self.pending_cleanup.add(job["stage"])
            public.pop("artifact", None)
            public.update(status="unknown", error={"code": "IO_ERROR", "message": str(failure)[:2048],
                                                   "effects": "possible"})
        self.active = None
        self._remove_handlers()
        self._prune()

    def _restore(self, scene, job):
        if scene is None:
            return True
        if not self._owns_filepath(scene, job):
            return True
        if self.bridge.generation != job["generation"]:
            self.unresolved = job
            return False
        try:
            scene.render.filepath = job["originalPath"]
            if scene.render.filepath == job["originalPath"]:
                return True
            self.unresolved = job
            return False
        except Exception:
            self.unresolved = job
            return False

    def _settings_match(self, scene, job):
        public = job["public"]
        image = scene.render.image_settings
        return (scene.camera is not None and str(scene.camera.session_uid) == public["cameraObjectId"]
                and scene.render.engine == public["engine"] and scene.frame_current == public["frame"]
                and scene.frame_subframe == job["subframe"]
                and scene.render.resolution_x == public["width"]
                and scene.render.resolution_y == public["height"]
                and scene.render.resolution_percentage == 100
                and image.file_format == "PNG" and image.color_depth == "8" and image.color_mode == "RGBA")

    def _scene(self, job):
        return next((scene for scene in bpy.data.scenes
                     if str(scene.session_uid) == job["public"]["sceneId"]), None)

    @staticmethod
    def _scene_matches(scene, job):
        try:
            return str(scene.session_uid) == job["public"]["sceneId"]
        except ReferenceError:
            return False

    @staticmethod
    def _owns_filepath(scene, job):
        current = bpy.path.abspath(scene.render.filepath)
        return os.path.normcase(os.path.abspath(current)) == os.path.normcase(str(job["stage"]))

    def _install(self):
        self._install_handlers()
        if not bpy.app.timers.is_registered(self.timer):
            bpy.app.timers.register(self.timer, first_interval=0.05, persistent=True)

    def _install_handlers(self):
        for name, handler in self.handlers:
            callbacks = getattr(bpy.app.handlers, name)
            if handler not in callbacks:
                callbacks.append(handler)

    def _execution_context(self):
        """Keep the GUI adapter's context refusal separate from shared render state."""
        if bpy.app.background or bpy.context.window is None:
            raise BridgeError("INVALID_CONTEXT", "This render operation requires a Blender GUI window")
        return "INVOKE_DEFAULT"

    def _remove_handlers(self):
        for name, handler in self.handlers:
            callbacks = getattr(bpy.app.handlers, name)
            if handler in callbacks:
                callbacks.remove(handler)

    def _retired(self):
        self._remove_handlers()
        self.artifacts.close()
        self.jobs.clear()
        self.session_id = ""
        self.retiring = False
        self.bridge.render_retired()

    def _prune(self):
        now = time.monotonic()
        for identifier, job in tuple(self.jobs.items()):
            if job["finished"] is not None and now - job["finished"] >= 600:
                del self.jobs[identifier]
        terminal = [identifier for identifier, job in self.jobs.items() if job["finished"] is not None]
        for identifier in terminal[:-8]:
            del self.jobs[identifier]

    @staticmethod
    def _dimension(value, scene, property_name):
        property_rna = scene.render.bl_rna.properties[property_name]
        minimum, maximum = property_rna.hard_min, min(4096, property_rna.hard_max)
        if type(value) is not int or not minimum <= value <= maximum:
            raise BridgeError("INVALID_ARGUMENT", f"Render dimensions must be integers in {minimum}..{maximum}")
        return value

    @staticmethod
    def _identifier(value):
        try:
            valid = isinstance(value, str) and str(uuid.UUID(value)) == value
        except (ValueError, AttributeError):
            valid = False
        if not valid:
            raise BridgeError("INVALID_ARGUMENT", "renderId must be a canonical lower-case UUID")
        return value

    @staticmethod
    def _now():
        return datetime.now(timezone.utc).isoformat()
