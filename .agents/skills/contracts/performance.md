# Performance

Judge the operation together with its helpers. Moving work to another layer does not remove its cost.

## Efficient algorithms

State the input dimensions driving time and space, the dominant work, and why any full scan or rebuild is needed. Use an efficient correct strategy for the supported workload without unnecessary traversals or allocation. Do not claim unmeasured speedups.

## Reuse equivalent work

State what completed or in-flight work is shared, which inputs, dependencies, and effects determine equivalence, and how identity and invalidation preserve it. For an operation without cross-call reuse responsibility, explain that scope. Matching results do not make effectful operations interchangeable.

## Bound retention and release resources

State the owner of retained state, handles, or tasks, the acquisition and release points, and what bounds their population. Cover completion, failure, cancellation, and transfer where supported. Keep handles, bytes, and tasks distinct, and disclose any missing bound.
