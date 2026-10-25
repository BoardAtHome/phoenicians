export interface AppBuild {
  version: string;
  title: string;
  /** The italic line under the heading, e.g. "25 Oct 2026 · PR #8". */
  meta: string;
  items: string[];
}

/** Reads CHANGELOG.md: one build per `## <version> — <title>` heading, bullets joined across wrapped lines. */
export function parseChangelog(markdown: string): AppBuild[] {
  const builds: AppBuild[] = [];
  let current: AppBuild | null = null;
  for (const raw of markdown.split('\n')) {
    const line = raw.trimEnd();
    const heading = line.match(/^## (\d+\.\d+\.\d+)\s+—\s+(.+)$/);
    if (heading) {
      current = { version: heading[1]!, title: heading[2]!, meta: '', items: [] };
      builds.push(current);
    } else if (line.startsWith('## ') || line.startsWith('# ')) {
      current = null;
    } else if (!current) {
      continue;
    } else if (/^_.+_$/.test(line) && current.items.length === 0) {
      current.meta = line.slice(1, -1);
    } else if (line.startsWith('- ')) {
      current.items.push(line.slice(2));
    } else if (line.startsWith('  ') && current.items.length > 0) {
      current.items[current.items.length - 1] += ` ${line.trim()}`;
    }
  }
  return builds;
}

/** Turns `code` spans into <code> parts; the changelog uses no other markdown inside bullets. */
export function codeSpans(text: string): { text: string; code: boolean }[] {
  return text.split('`').map((part, i) => ({ text: part, code: i % 2 === 1 })).filter((p) => p.text);
}
