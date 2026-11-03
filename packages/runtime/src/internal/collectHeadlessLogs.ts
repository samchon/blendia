import type { IScriptLogPage } from "../IScriptLogPage";

/** Copy the bounded retained tail before releasing its actual job/process owner. */
export function collectHeadlessLogs(
  read: (cursor: number) => IScriptLogPage,
): IScriptLogPage[] {
  const pages: IScriptLogPage[] = [];
  let cursor: number = 0;
  for (;;) {
    const page: IScriptLogPage = read(cursor);
    pages.push(page);
    if (!page.hasMore) return pages;
    if (page.nextCursor <= cursor)
      throw new Error("blendia: headless log cursor did not advance.");
    cursor = page.nextCursor;
  }
}
