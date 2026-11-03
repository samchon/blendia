# Unit tests

These unit cases verify Blendia's first-party command-line argument grammar and Blender stream framing. They cover script argument boundaries, malformed inputs, fragmented messages, strict UTF-8, and payload byte limits.

They do not require a Blender installation. Execution guidance and the scope of these checks are documented in [UNIT_TESTS.md](UNIT_TESTS.md).

Implementation and verification work is tracked in [issue #6](https://github.com/samchon/blendia/issues/6).
