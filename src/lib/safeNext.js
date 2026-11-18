// Only allow redirects to a path on this site (blocks "//evil.com", "https://…", "@evil.com", "javascript:").
export function safeNext(value, fallback = '/') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}
