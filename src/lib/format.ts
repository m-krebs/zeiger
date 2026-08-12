// Dates are rendered on the server and again on the client after hydration. Both
// sides have to agree on locale *and* field widths, otherwise the text visibly
// switches format right after load, so the locale travels with the page data and
// every field is pinned explicitly.
const DATE: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
const DATE_TIME: Intl.DateTimeFormatOptions = {
	...DATE,
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hourCycle: 'h23'
};

/** Pick the first usable language tag from an Accept-Language header. */
export function preferredLocale(header: string | null): string {
	for (const part of header?.split(',') ?? []) {
		const tag = part.split(';')[0].trim();
		if (!tag || tag === '*') continue;
		try {
			new Intl.DateTimeFormat(tag);
			return tag;
		} catch {
			// not a usable tag, try the next one
		}
	}
	return 'en';
}

export function formatDate(value: Date | string, locale: string): string {
	return new Date(value).toLocaleDateString(locale, DATE);
}

export function formatDateTime(value: Date | string, locale: string): string {
	return new Date(value).toLocaleString(locale, DATE_TIME);
}
