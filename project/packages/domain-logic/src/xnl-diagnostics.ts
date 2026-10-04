/** Domain-owned closer diagnostics. xnl-core only searches `</?` and will not
 * emit `expected </?>, got </Given>`. */

const XML_TEXT_CLOSER = /<\/(?!\?)([A-Za-z_][\w:.-]*)>/g;

export function xmlStyleTextClosers(source: string): readonly string[] {
  return [...new Set([...source.matchAll(XML_TEXT_CLOSER)].map((match) => `</${match[1]}>`))];
}

/** Name XML-style text closers when a parse already failed. A payload that ends
 * with `?` serializes as `?</?>`; that is not another closer. */
export function explainXnlParseError(source: string, cause: unknown): string {
  const original = cause instanceof Error ? cause.message : String(cause);
  const closers = xmlStyleTextClosers(source);
  if (closers.length) return `expected </?>, got ${closers.join(', ')}`;
  if (/Missing closing text tag/.test(original) && !original.includes('expected </?>')) {
    return `expected </?>, ${original}`;
  }
  return original;
}
