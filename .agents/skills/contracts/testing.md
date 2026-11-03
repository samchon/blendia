# Test contracts

The unit module selects this checklist for meaningful first-party units permitted by the [testing guide](../development/testing.md). Actual Blender scenarios and extension installation answer their own [module contracts](../../../tests/test-blender/contracts/blender.md), selected by the engine package rather than this unit checklist. Answer from actual behavior and assertions; a passing run alone does not answer a contract.

## Behavioral verification

State the operation exercised, the observable defect caught, and valid behavior allowed. Verify the operation through its supported seam or output. A source pattern, document string, manifest field, or file's existence alone does not establish behavioral correctness; inspect arrangement directly rather than adding implementation-mirroring tests.

## Independent expectations

State the supported contract, specification, or independent reference that determines expected values, how it exposes a wrong implementation, and any oracle limitation. Do not derive expectations from the implementation under test or a snapshot of its output.

## Distinguishing cases

State the positive, negative, and boundary decisions this test owns and the cases another test owns. Cover relevant empty, singleton, limit, malformed, and failure inputs without weakening assertions or dropping cases to save time.

## Execution ownership

State the actual first-party unit behavior, discoverable entry, and case owner. Dependency smoke checks, package installation, and configuration assertions do not become permitted unit tests by moving or relabeling a file. Do not invent logic solely to populate this checklist.
