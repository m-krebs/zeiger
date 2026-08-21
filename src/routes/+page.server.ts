import { fail, redirect } from '@sveltejs/kit';
import { and, asc, count, desc, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { folder, link, linkVisit } from '$lib/server/db/schema';
import {
	fetchFavicon,
	generateShort,
	isShortTaken,
	normalizeShort,
	normalizeUrl,
	parseTags
} from '$lib/server/links';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	const [links, folders, visitCounts] = await Promise.all([
		db.query.link.findMany({
			where: eq(link.userId, locals.user.id),
			orderBy: desc(link.createdAt)
		}),
		db.query.folder.findMany({
			where: eq(folder.userId, locals.user.id),
			orderBy: asc(folder.name)
		}),
		db
			.select({ linkId: linkVisit.linkId, visits: count() })
			.from(linkVisit)
			.innerJoin(link, eq(link.id, linkVisit.linkId))
			.where(eq(link.userId, locals.user.id))
			.groupBy(linkVisit.linkId)
	]);
	const byId = new Map(visitCounts.map((v) => [v.linkId, v.visits]));
	return { links: links.map((l) => ({ ...l, visits: byId.get(l.id) ?? 0 })), folders };
};

type ImportEntry = {
	title: string;
	url: string;
	tags: string[];
	public: boolean;
	short: string | null;
	favicon: string | null;
	folderName: string;
};

/** How to treat imported links whose URL already exists. */
type DuplicateStrategy = 'keep' | 'overwrite';

/** Pick the importable links out of a parsed JSON array; malformed entries are skipped. */
function parseImport(parsed: unknown[]): { entries: ImportEntry[]; skipped: number } {
	const entries: ImportEntry[] = [];
	let skipped = 0;
	for (const entry of parsed) {
		if (typeof entry !== 'object' || entry === null) {
			skipped++;
			continue;
		}
		const item = entry as Record<string, unknown>;
		const rawTitle = typeof item.title === 'string' ? item.title : item.name;
		const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
		const url = normalizeUrl(typeof item.url === 'string' ? item.url : '');
		if (!title || !url) {
			skipped++;
			continue;
		}
		entries.push({
			title,
			url,
			tags: Array.isArray(item.tags)
				? parseTags(item.tags.filter((t) => typeof t === 'string').join(','))
				: [],
			public: item.public === true,
			short: typeof item.short === 'string' ? normalizeShort(item.short) : null,
			favicon: typeof item.favicon === 'string' && item.favicon ? item.favicon : null,
			folderName: typeof item.folder === 'string' ? item.folder.trim() : ''
		});
	}
	return { entries, skipped };
}

export const actions: Actions = {
	createFolder: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';
		if (!name) return fail(400, { action: 'folder', message: 'Folder name is required' });
		await db.insert(folder).values({ userId: locals.user.id, name });
		return { action: 'folder', success: true };
	},

	deleteFolder: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const formData = await request.formData();
		const id = formData.get('id')?.toString() ?? '';
		if (!id) return fail(400, { action: 'folder', message: 'Missing folder id' });
		// links in the folder are kept; their folder_id is set to null by the FK
		await db.delete(folder).where(and(eq(folder.id, id), eq(folder.userId, locals.user.id)));
		return { action: 'folder', success: true };
	},

	import: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const formData = await request.formData();
		const file = formData.get('file');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { action: 'import', message: 'Choose a JSON file to import' });
		}
		const requested = formData.get('duplicates')?.toString();
		const strategy: DuplicateStrategy | null =
			requested === 'keep' || requested === 'overwrite' ? requested : null;

		let parsed: unknown;
		try {
			parsed = JSON.parse(await file.text());
		} catch {
			return fail(400, { action: 'import', message: 'File is not valid JSON' });
		}
		if (!Array.isArray(parsed)) {
			return fail(400, { action: 'import', message: 'Expected a JSON array of links' });
		}

		const { entries, skipped } = parseImport(parsed);

		// a link counts as a duplicate when its destination URL already exists for this user
		const existingByUrl = new Map(
			(await db.query.link.findMany({ where: eq(link.userId, locals.user.id) })).map((l) => [
				l.url,
				{ id: l.id, short: l.short, favicon: l.favicon }
			])
		);
		const duplicates = entries.filter((e) => existingByUrl.has(e.url)).length;
		if (duplicates > 0 && !strategy) {
			// let the user decide before anything is written
			return { action: 'import', needsChoice: true, duplicates };
		}

		const folderIdByName = new Map(
			(await db.query.folder.findMany({ where: eq(folder.userId, locals.user.id) })).map((f) => [
				f.name,
				f.id
			])
		);

		let imported = 0;
		let updated = 0;
		let kept = 0;
		for (const entry of entries) {
			const existing = existingByUrl.get(entry.url);
			if (existing && strategy === 'keep') {
				kept++;
				continue;
			}

			let folderId: string | null = null;
			if (entry.folderName) {
				folderId = folderIdByName.get(entry.folderName) ?? null;
				if (!folderId) {
					const [created] = await db
						.insert(folder)
						.values({ userId: locals.user.id, name: entry.folderName })
						.returning({ id: folder.id });
					folderId = created.id;
					folderIdByName.set(entry.folderName, folderId);
				}
			}

			if (existing) {
				// keep the current short unless the file names one that is still free, so
				// links already shared out of band keep resolving
				const short =
					entry.short && !(await isShortTaken(entry.short, existing.id))
						? entry.short
						: existing.short;
				const favicon = entry.favicon ?? existing.favicon ?? (await fetchFavicon(entry.url));
				await db
					.update(link)
					.set({
						folderId,
						title: entry.title,
						tags: entry.tags,
						public: entry.public,
						short,
						favicon,
						updatedAt: new Date()
					})
					.where(and(eq(link.id, existing.id), eq(link.userId, locals.user.id)));
				existingByUrl.set(entry.url, { id: existing.id, short, favicon });
				updated++;
				continue;
			}

			const shortTaken = entry.short ? await isShortTaken(entry.short) : true;
			const favicon = entry.favicon ?? (await fetchFavicon(entry.url));
			const [created] = await db
				.insert(link)
				.values({
					userId: locals.user.id,
					folderId,
					title: entry.title,
					url: entry.url,
					tags: entry.tags,
					public: entry.public,
					short: !entry.short || shortTaken ? await generateShort() : entry.short,
					favicon
				})
				.returning({ id: link.id, short: link.short });
			// later entries pointing at the same URL are duplicates of this one
			existingByUrl.set(entry.url, { id: created.id, short: created.short, favicon });
			imported++;
		}
		return { action: 'import', success: true, imported, updated, kept, skipped };
	},

	signOut: async ({ request }) => {
		await auth.api.signOut({ headers: request.headers });
		redirect(302, '/login');
	}
};
