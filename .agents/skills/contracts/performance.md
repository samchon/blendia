# Performance

Select a question only for an operation with a material cost, reuse decision, or resource-lifetime requirement. DTOs, ordinary properties, simple parsers, and configuration do not acquire performance obligations from their syntax. Do not write `N/A` or type-only `O(1)` boilerplate. Judge the selected operation together with its helpers; moving work to another layer does not remove its cost.

Optional reuse guidance: when an operation actually coordinates reusable work, consider which inputs, dependencies, and effects determine equivalence and how identity and invalidation preserve it. Matching results do not make effectful operations interchangeable. This guidance is not a formal checklist question.

## Efficient algorithms

State the input dimensions driving time and space, the dominant work, and why any full scan or rebuild is needed. Use an efficient correct strategy for the supported workload without unnecessary traversals or allocation. Do not claim unmeasured speedups.

## Bound retention and release resources

State the owner of retained state, handles, or tasks, the acquisition and release points, and what bounds their population. Cover completion, failure, cancellation, and transfer where supported. Keep handles, bytes, and tasks distinct, and disclose any missing bound.
