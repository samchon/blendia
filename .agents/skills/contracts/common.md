# Common implementation principles

Answer from the declaration's actual behavior. Keep simple decisions brief and do not invent design history.

## Principled Implementation

State the method or representation, its input assumptions, why those assumptions hold, and any unresolved limitation. Base the method on the problem's semantics, a language idiom, or documented API behavior. For transformations and numerical methods, include preserved meaning, precision, and degeneracies where applicable.

## Clear and Simple Design

State which responsibility the declaration owns and why a non-obvious separation or layer is needed. Use the simplest structure that serves current requirements rather than options or abstractions for hypothetical consumers.

## Prohibited Implementation Shortcuts

Identify any consumer-specific special case, compensation, or unresolved shortcut and its supported basis. Do not special-case fixtures or expected answers, replace globals or foreign methods, add production behavior solely to pass tests, or retain a disproven assumption under retries and wrappers. A constant expressing an actual supported contract is permitted.

## Meaningful documentation

State which non-obvious facts the documentation provides: purpose, ownership, units, failure effects, optional-state meaning, or another fact needed to use and change the declaration. Explain calculations near their implementation with premises and units; distinguish conventional coefficients from measured quantities. Follow the [documentation skill](../documentation/SKILL.md), with blank comment lines between prose and tags and between documented properties.
