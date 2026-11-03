# @blendia/runtime

Run an existing project TypeScript file through `ttsc`'s `ttsx`. The runtime uses the current Node executable, the actual project directory, and an argument array without a shell. `ttsx` owns project discovery, type checking, transformations, source maps, and its private compilation cache.

The `blendia run` command uses this package. It is not yet published to npm. Applications with the package available can also launch scripts directly:

```ts
import { type IProjectScriptResult, runProjectScript } from "@blendia/runtime";

async function main(): Promise<void> {
  const result: IProjectScriptResult = await runProjectScript({
    cwd: "/path/to/project",
    project: "tsconfig.json",
    entry: "src/model.ts",
    args: ["--name", "Cube"],
  });
  console.log(result);
}

void main().catch((error: unknown): void => {
  console.error(error);
});
```

`IProjectScriptOptions` specifies `entry`, optional `cwd`, optional `project`, optional `args`, and optional `connection`. Relative entry and explicit tsconfig paths use `cwd`; omitted cwd uses the calling process's working directory. Omitted project delegates configuration discovery to `ttsx`. Arguments are forwarded verbatim to the script, without consuming a separator in this programmatic API.

The script inherits standard input, standard output, standard error, and the process environment. `connection.port` and `connection.token`, when provided, override `BLENDIA_PORT` and `BLENDIA_TOKEN` for that child only. Otherwise existing values are inherited. The runtime opens no SDK connection; the script's `BlenderClient` owns its socket. Keep credentials in the environment rather than command arguments.

`runProjectScript` resolves after the direct `ttsx` launcher closes, returning `{ code, signal }`. A spawn failure rejects. A zero code describes the launched program's exit status; it does not independently prove a Blender mutation completed. Source diagnostics remain on the inherited streams. There is no cancellation API, recursive process-tree shutdown guarantee, retry, or rollback. Run the CLI through the intended Node toolchain so `process.execPath` refers to that executable; this package does not install or discover another Node version.

See the [CLI](../cli/README.md) for terminal use and the [SDK](../sdk/README.md) for Blender scene operations.
