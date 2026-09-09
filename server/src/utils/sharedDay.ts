export function dateKeyInTimeZone(timeZone: string, date = new Date()) {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(date).map((part) => [part.type, part.value]),
    );
    if (parts.year && parts.month && parts.day) return `${parts.year}-${parts.month}-${parts.day}`;
  } catch {
    // Invalid/stale timezone data should never split the couple onto different
    // question days. UTC is the deterministic fallback.
  }
  return date.toISOString().slice(0, 10);
}
