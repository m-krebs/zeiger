import { error, fail, redirect } from '@sveltejs/kit';
import { and, asc, count, desc, eq } from 'drizzle-orm';
import QRCode from 'qrcode';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { folder, link, linkVisit, user } from '$lib/server/db/schema';
import {
	fetchFavicon,
	generateShort,
	isShortTaken,
	normalizeShort,
	normalizeUrl,
	parseTags
} from '$lib/server/links';

async function ownedLink(id: string, userId: string) {
	const found = await db.query.link.findFirst({
		where: and(eq(link.id, id), eq(link.userId, userId))
	});
	if (!found) error(404, 'Link not found');
	return found;
}

async function ownedFolders(userId: string) {
	return db.query.folder.findMany({
		where: eq(folder.userId, userId),
		orderBy: asc(folder.name)
	});
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) redirect(302, '/login');
	const folders = await ownedFolders(locals.user.id);
	if (params.id === 'new') {
		return { link: null, qr: null, folders, visitCount: 0, recentVisits: [] };
	}
	const found = await ownedLink(params.id, locals.user.id);
	const shortUrl = `${url.origin}/l/${found.short}`;
	const [qr, [{ visitCount }], recentVisits] = await Promise.all([
		QRCode.toDataURL(shortUrl, { width: 256, margin: 1 }),
		db.select({ visitCount: count() }).from(linkVisit).where(eq(linkVisit.linkId, found.id)),
		db
			.select({
				visitedAt: linkVisit.visitedAt,
				userAgent: linkVisit.userAgent,
				referer: linkVisit.referer,
				username: user.name
			})
			.from(linkVisit)
			.leftJoin(user, eq(user.id, linkVisit.userId))
			.where(eq(linkVisit.linkId, found.id))
			.orderBy(desc(linkVisit.visitedAt))
			.limit(10)
	]);
	return { link: found, qr, folders, visitCount, recentVisits };
};

export const actions: Actions = {
	save: async ({ request, locals, params }) => {
		if (!locals.user) redirect(302, '/login');
		const creating = params.id === 'new';
		const existing = creating ? null : await ownedLink(params.id, locals.user.id);

		const formData = await request.formData();
		const title = formData.get('title')?.toString().trim() ?? '';
		const url = normalizeUrl(formData.get('url')?.toString() ?? '');
		const tags = parseTags(formData.get('tags')?.toString() ?? '');
		const isPublic = formData.get('public') === 'on';
		const rawShort = formData.get('short')?.toString().trim() ?? '';
		const rawFolder = formData.get('folder')?.toString() ?? '';

		if (!title) return fail(400, { message: 'Title is required' });
		if (!url) return fail(400, { message: 'A valid http(s) URL is required' });

		let folderId: string | null = null;
		if (rawFolder) {
			const folders = await ownedFolders(locals.user.id);
			if (!folders.some((f) => f.id === rawFolder)) {
				return fail(400, { message: 'Unknown folder' });
			}
			folderId = rawFolder;
		}

		let short: string;
		if (!rawShort) {
			short = existing?.short ?? (await generateShort());
		} else {
			const normalized = normalizeShort(rawShort);
			if (!normalized) {
				return fail(400, {
					message: 'Name may only contain letters, digits, - and _ (max 64 chars)'
				});
			}
			if (normalized !== existing?.short && (await isShortTaken(normalized, existing?.id))) {
				return fail(400, { message: `“/l/${normalized}” is already taken` });
			}
			short = normalized;
		}

		if (creating) {
			const favicon = await fetchFavicon(url);
			const [created] = await db
				.insert(link)
				.values({
					userId: locals.user.id,
					folderId,
					title,
					url,
					tags,
					public: isPublic,
					short,
					favicon
				})
				.returning({ id: link.id });
			redirect(303, `/edit/${created.id}`);
		}

		const favicon = url === existing!.url ? existing!.favicon : await fetchFavicon(url);
		await db
			.update(link)
			.set({ folderId, title, url, tags, public: isPublic, short, favicon, updatedAt: new Date() })
			.where(and(eq(link.id, params.id), eq(link.userId, locals.user.id)));

		return { success: true };
	},

	delete: async ({ locals, params }) => {
		if (!locals.user) redirect(302, '/login');
		if (params.id === 'new') redirect(302, '/');
		await db.delete(link).where(and(eq(link.id, params.id), eq(link.userId, locals.user.id)));
		redirect(302, '/');
	}
};
