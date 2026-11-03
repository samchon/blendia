import { DynamicExecutor } from "@nestia/e2e";
import path from "node:path";

/** Execute every first-party unit case and preserve failures in the process status. */
async function main(): Promise<void> {
  const report: DynamicExecutor.IReport = await DynamicExecutor.validate({
    prefix: "test_",
    extension: "ts",
    location: path.join(__dirname, "features"),
    parameters: (): [] => [],
    onComplete: (execution: DynamicExecutor.IExecution): void => {
      console.log(
        `${execution.error === null ? "PASS" : "FAIL"} ${execution.name}`,
      );
      if (execution.error !== null) console.error(execution.error);
    },
  });
  if (report.executions.length === 0)
    throw new Error("No first-party unit cases were discovered.");
  const failures: number = report.executions.filter(
    (execution: DynamicExecutor.IExecution): boolean =>
      execution.error !== null,
  ).length;
  console.log(
    `${report.executions.length - failures}/${report.executions.length} unit cases passed.`,
  );
  if (failures !== 0) process.exitCode = 1;
}

main().catch((error: unknown): void => {
  console.error(error);
  process.exitCode = 1;
});
