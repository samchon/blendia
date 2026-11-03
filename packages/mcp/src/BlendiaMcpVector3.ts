import type { tags } from "typia";

/** Three finite coordinates in JSON array order; admission checks length and every indexed value before producing an SDK tuple. LLM schemas describe these length tags rather than enforcing them. */
export type BlendiaMcpVector3 = number[] & tags.MinItems<3> & tags.MaxItems<3>;
