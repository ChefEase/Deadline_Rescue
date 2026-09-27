/** Use the browser's zone only to seed a new document, never to reinterpret saved instants. */
export function detectedTimezone(): string {
  const candidate = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return candidate;
  } catch {
    return "UTC";
  }
}

export function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Calendar arithmetic stays in local dates, so DST days are never assumed to be 24 hours. */
export function addLocalDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Return every matching instant: zero in a DST gap, two during a repeated hour. */
export function localDateTimeCandidates(date: string, time: string, timezone: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) || !isValidTimezone(timezone)) return [];
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wallTime = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(wallTime);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return [];

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const offsets = new Set<number>();
  // Sample on both sides of a possible clock change, then verify each candidate.
  for (const hours of [-36, -12, 0, 12, 36]) {
    const sample = wallTime + hours * 3_600_000;
    const parts = Object.fromEntries(formatter.formatToParts(new Date(sample)).map((part) => [part.type, part.value]));
    const localAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    offsets.add((localAsUtc - sample) / 60_000);
  }
  const matches: string[] = [];
  for (const offset of offsets) {
    const candidate = new Date(wallTime - offset * 60_000);
    const parts = Object.fromEntries(formatter.formatToParts(candidate).map((part) => [part.type, part.value]));
    if (Number(parts.year) === year && Number(parts.month) === month && Number(parts.day) === day && Number(parts.hour) === hour && Number(parts.minute) === minute) {
      matches.push(candidate.toISOString());
    }
  }
  return [...new Set(matches)].sort();
}

export function localDateTimeToInstant(date: string, time: string, timezone: string): string | null {
  const candidates = localDateTimeCandidates(date, time, timezone);
  // Forms require a unique wall time; scheduling consistently chooses the earlier instant.
  return candidates.length === 1 ? candidates[0] : null;
}

export function instantToLocalFields(instant: string, timezone: string): { date: string; time: string } {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
