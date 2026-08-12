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

		let parsed: unknown;
		try {
			parsed = JSON.parse(await file.text());
		} catch {
			return fail(400, { action: 'import', message: 'File is not valid JSON' });
		}
		if (!Array.isArray(parsed)) {
			return fail(400, { action: 'import', message: 'Expected a JSON array of links' });
		}

		const folderIdByName = new Map(
			(await db.query.folder.findMany({ where: eq(folder.userId, locals.user.id) })).map((f) => [
				f.name,
				f.id
			])
		);

		let imported = 0;
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
			const tags = Array.isArray(item.tags)
				? parseTags(item.tags.filter((t) => typeof t === 'string').join(','))
				: [];
			const requestedShort = typeof item.short === 'string' ? normalizeShort(item.short) : null;
			const shortTaken = requestedShort ? await isShortTaken(requestedShort) : true;
			const favicon =
				typeof item.favicon === 'string' && item.favicon ? item.favicon : await fetchFavicon(url);

			let folderId: string | null = null;
			const folderName = typeof item.folder === 'string' ? item.folder.trim() : '';
			if (folderName) {
				folderId = folderIdByName.get(folderName) ?? null;
				if (!folderId) {
					const [created] = await db
						.insert(folder)
						.values({ userId: locals.user.id, name: folderName })
						.returning({ id: folder.id });
					folderId = created.id;
					folderIdByName.set(folderName, folderId);
				}
			}

			await db.insert(link).values({
				userId: locals.user.id,
				folderId,
				title,
				url,
				tags,
				public: item.public === true,
				short: !requestedShort || shortTaken ? await generateShort() : requestedShort,
				favicon
			});
			imported++;
		}
		return { action: 'import', success: true, imported, skipped };
	},

	signOut: async ({ request }) => {
		await auth.api.signOut({ headers: request.headers });
		redirect(302, '/login');
	}
};
