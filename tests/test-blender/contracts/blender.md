# Actual Blender verification

Apply these questions to scenarios that exercise Blendia with an actual Blender installation. This checklist does not turn a compiler, dependency, protocol stub, or manifest check into an engine test.

## Real engine boundary

Identify the supported public Blendia seam, actual engine work, and independently observed native result. State what the scenario does not establish, including GUI interaction or visual equivalence when only headless output is examined.

## Independent scene and image expectations

Describe the literal geometry, material, camera, light, image, and persistence requirements. Explain how a wrong implementation fails independently of the SDK's response decoder and distinguish semantic checks from deterministic byte or pixel equality.

## Process and file ownership

Keep script failure separate from native Blender exit and private bootstrap cleanup. Retain explicit user outputs, avoid mutation replay or process-tree termination, and explain how uncertain observations preserve files rather than becoming a passing case.
