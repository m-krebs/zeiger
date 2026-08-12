import { error, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { link, linkVisit } from '$lib/server/db/schema';

export const GET: RequestHandler = async ({ params, locals, url, request }) => {
	const found = await db.query.link.findFirst({ where: eq(link.short, params.short) });
	if (!found) error(404, 'Short link not found');

	if (!found.public && !locals.session) {
		redirect(302, `/login?redirectTo=${encodeURIComponent(url.pathname)}`);
	}

	await db.insert(linkVisit).values({
		linkId: found.id,
		userId: locals.user?.id ?? null,
		userAgent: request.headers.get('user-agent'),
		referer: request.headers.get('referer')
	});

	redirect(302, found.url);
};
