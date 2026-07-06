/**
 * Shared date helpers for calendar event creation
 */

/**
 * Format a Date as local wall-clock time (without Z/offset) for a given IANA timezone.
 * Example: 2026-07-17T10:00:00.000Z + 'Europe/Berlin' → "2026-07-17T12:00:00"
 * Sending this together with the timeZone field makes calendar invites
 * display the time in the host's timezone instead of UTC.
 */
export function toLocalDateTime(date: Date, timeZone: string): string {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	}).formatToParts(date);
	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
	// Intl can return "24" for midnight in some environments – normalize to "00"
	const hour = get('hour') === '24' ? '00' : get('hour');
	return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}`;
}
