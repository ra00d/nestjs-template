/**
 * Normalizes an email the same way every lookup and rate-limit key does:
 * trim, NFC-normalize, lowercase. Use it before storing, querying, or
 * building a per-email tracker so `A@B.c ` and `a@b.c` are one account.
 */
export function normalizeEmail(email: string): string {
  return email.trim().normalize('NFC').toLowerCase();
}

/** `'ada@example.com'` -> `'a••@example.com'`: safe for logs and UIs. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '•••';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}••@${domain}`;
}

/**
 * URL-safe slug: lowercase, diacritics stripped, runs of other characters
 * collapsed to one `-`, capped at `maxLength` without trailing dashes.
 */
export function slugify(value: string, maxLength = 80): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
  return slug.length > maxLength
    ? slug.slice(0, maxLength).replace(/-+$/g, '')
    : slug;
}

/** Cuts to `maxLength` graphemes, appending `suffix` only when truncated. */
export function truncate(value: string, maxLength: number, suffix = '…'): string {
  if (maxLength < 0) throw new RangeError('maxLength must be >= 0');
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const graphemes = [...segmenter.segment(value)].map((part) => part.segment);
  if (graphemes.length <= maxLength) return value;
  const suffixLength = [...segmenter.segment(suffix)].length;
  return `${graphemes.slice(0, Math.max(0, maxLength - suffixLength)).join('')}${suffix}`;
}
