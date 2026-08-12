import { error } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { folder, link } from '$lib/server/db/schema';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401, 'Sign in to export your links');

	const links = await db
		.select({
			title: link.title,
			url: link.url,
			tags: link.tags,
			public: link.public,
			short: link.short,
			favicon: link.favicon,
			createdAt: link.createdAt,
			folder: folder.name
		})
		.from(link)
		.leftJoin(folder, eq(folder.id, link.folderId))
		.where(eq(link.userId, locals.user.id))
		.orderBy(desc(link.createdAt));

	const payload = links.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() }));

	return new Response(JSON.stringify(payload, null, 2), {
		headers: {
			'content-type': 'application/json',
			'content-disposition': 'attachment; filename="zeiger-links.json"'
		}
	});
};
