import { customAlphabet } from 'nanoid';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { link } from '$lib/server/db/schema';

const shortId = customAlphabet('23456789abcdefghijkmnpqrstuvwxyz', 6);

/**
 * Validate a user-chosen short name; returns the normalized (lowercased)
 * slug or null. Letters, digits, - and _, 1-64 chars.
 */
export function normalizeShort(raw: string): string | null {
	const value = raw.trim().toLowerCase();
	if (!/^[a-z0-9_-]{1,64}$/.test(value)) return null;
	return value;
}

/** Check whether a short code is already used by another link. */
export async function isShortTaken(short: string, excludeId?: string): Promise<boolean> {
	const existing = await db.query.link.findFirst({
		where: excludeId ? and(eq(link.short, short), ne(link.id, excludeId)) : eq(link.short, short)
	});
	return existing !== undefined;
}

/** Generate a short code that is not yet taken. */
export async function generateShort(): Promise<string> {
	for (let i = 0; i < 10; i++) {
		const candidate = shortId();
		const existing = await db.query.link.findFirst({ where: eq(link.short, candidate) });
		if (!existing) return candidate;
	}
	// practically unreachable with a 32^6 keyspace
	return shortId() + shortId();
}

/** Validate a destination URL; returns the normalized href or null. */
export function normalizeUrl(raw: string): string | null {
	let value = raw.trim();
	if (!value) return null;
	if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) value = `https://${value}`;
	try {
		const url = new URL(value);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
		return url.href;
	} catch {
		return null;
	}
}

/** Parse a comma separated tag list into a deduplicated array. */
export function parseTags(raw: string): string[] {
	return [
		...new Set(
			raw
				.split(',')
				.map((t) => t.trim().toLowerCase())
				.filter(Boolean)
		)
	];
}

/**
 * Best-effort favicon discovery: try the page's <link rel="icon">, then
 * /favicon.ico, then fall back to DuckDuckGo's icon service.
 */
export async function fetchFavicon(destination: string): Promise<string | null> {
	let url: URL;
	try {
		url = new URL(destination);
	} catch {
		return null;
	}

	try {
		const res = await fetch(url.href, {
			redirect: 'follow',
			signal: AbortSignal.timeout(4000),
			headers: { accept: 'text/html' }
		});
		if (res.ok) {
			const html = (await res.text()).slice(0, 100_000);
			const match = html.match(
				/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i
			);
			if (match) return new URL(match[1], res.url).href;
		}
	} catch {
		// ignore and fall through
	}

	try {
		const icoUrl = `${url.origin}/favicon.ico`;
		const res = await fetch(icoUrl, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
		if (res.ok && (res.headers.get('content-type') ?? '').startsWith('image')) return icoUrl;
	} catch {
		// ignore and fall through
	}

	return `https://icons.duckduckgo.com/ip3/${url.hostname}.ico`;
}
