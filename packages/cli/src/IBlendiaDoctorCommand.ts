import type { IProjectDoctorOptions } from "@blendia/runtime";

/** Inspect project/runtime metadata without launching a compiler or native preparation. */
export interface IBlendiaDoctorCommand {
  /** Select metadata inspection, without executing the project. */
  kind: "doctor";
  /** Optional invocation directory and explicit config candidate. */
  options: IProjectDoctorOptions;
}
