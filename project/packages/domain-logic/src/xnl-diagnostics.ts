/** Domain-owned closer diagnostics. xnl-core only searches `</?` and will not
 * emit `expected </?>, got </Given>`; `?</?>` often parses as an empty marker. */

const XML_TEXT_CLOSER = /<\/(?!\?)([A-Za-z_][\w:.-]*)>/g;

export function xmlStyleTextClosers(source: string): readonly string[] {
  return [...new Set([...source.matchAll(XML_TEXT_CLOSER)].map((match) => `</${match[1]}>`))];
}

/** Diagnostic for a parse that already failed. `?</?>` is only meaningful here:
 * on a successful parse the same bytes are the legitimate reading of text that
 * ends with `?` followed by `</?>`, so it cannot be a standalone lint rule. */
export function explainXnlParseError(source: string, cause: unknown): string {
  const original = cause instanceof Error ? cause.message : String(cause);
  const closers = xmlStyleTextClosers(source);
  if (closers.length) return `expected </?>, got ${closers.join(', ')}`;
  if (source.includes('?</?>')) return 'expected </?>, got ?</?>';
  if (/Missing closing text tag/.test(original) && !original.includes('expected </?>')) {
    return `expected </?>, ${original}`;
  }
  return original;
}
