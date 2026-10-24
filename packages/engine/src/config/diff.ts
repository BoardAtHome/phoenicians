/** Lists the leaf values that differ between two configs, e.g. `costs.attack.warriors: 3 → 4`. */
export function diffConfig(before: unknown, after: unknown, path = ''): string[] {
  if (typeof before === 'object' && before !== null && typeof after === 'object' && after !== null) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return [...keys].flatMap((k) =>
      diffConfig((before as Record<string, unknown>)[k], (after as Record<string, unknown>)[k], path ? `${path}.${k}` : k),
    );
  }
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  return [`${path}: ${JSON.stringify(before) ?? '(none)'} → ${JSON.stringify(after) ?? '(none)'}`];
}
