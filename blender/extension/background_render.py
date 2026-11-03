"""Run one native background render on the bootstrap's existing main thread."""

import bpy

from .native_render import NativeRender
from .protocol import BridgeError


class BackgroundRender(NativeRender):
    """Reuse bounded artifacts and provenance without a GUI job or timer owner.

    EXEC_DEFAULT blocks transport and bootstrap control until it returns. A
    caller timeout does not cancel that work or authorize replay. The bootstrap
    pumps this owner between commands and retires private artifacts on shutdown;
    only explicitly published user PNG and .blend outputs outlive the process.
    """

    def start(self, params):
        """Return a finalized native result, or disclose an unobserved completion."""
        result = super().start(params)
        job = self.active
        if job is None:
            return result

        # A returned EXEC call cannot be certified by inventing a complete event.
        job["conflict"] = "Background render returned without an owned terminal result"
        if bpy.app.is_job_running("RENDER"):
            raise BridgeError("OUTCOME_UNKNOWN", "A native render remains active after EXEC returned", "possible")
        try:
            self._finish(job)
        except Exception as error:
            raise BridgeError("OUTCOME_UNKNOWN", "Background render finalization is uncertain", "possible") from error
        return dict(job["public"])

    def retire(self):
        """Use the bootstrap pump instead of installing a background application timer."""
        self.retiring = True
        self.tick()
        return self.busy

    def _execution_context(self):
        """Keep blocking background execution distinct from the GUI window contract."""
        if not bpy.app.background:
            raise BridgeError("INVALID_CONTEXT", "This render adapter requires background Blender")
        return "EXEC_DEFAULT"

    def _install(self):
        """The bootstrap directly pumps this owner, so no application timer is needed."""
        self._install_handlers()
