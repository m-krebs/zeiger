import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';

const MIN_PASSWORD_LENGTH = 8;

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	const account = await db.query.user.findFirst({ where: eq(user.id, locals.user.id) });
	if (!account) redirect(302, '/login');
	return {
		account: {
			username: account.displayUsername ?? account.username ?? account.name,
			name: account.name,
			createdAt: account.createdAt
		}
	};
};

export const actions: Actions = {
	changePassword: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');

		const formData = await request.formData();
		const currentPassword = formData.get('currentPassword')?.toString() ?? '';
		const newPassword = formData.get('newPassword')?.toString() ?? '';
		const confirmPassword = formData.get('confirmPassword')?.toString() ?? '';
		const revokeOtherSessions = formData.get('revokeOtherSessions') === 'on';

		if (!currentPassword) {
			return fail(400, { message: 'Enter your current password' });
		}
		if (newPassword.length < MIN_PASSWORD_LENGTH) {
			return fail(400, {
				message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters`
			});
		}
		if (newPassword !== confirmPassword) {
			return fail(400, { message: 'The new passwords do not match' });
		}
		if (newPassword === currentPassword) {
			return fail(400, { message: 'The new password must differ from the current one' });
		}

		try {
			// on revokeOtherSessions better-auth drops every session and issues a new
			// one; the sveltekitCookies plugin writes that cookie onto this response,
			// so the user stays signed in here
			await auth.api.changePassword({
				body: { currentPassword, newPassword, revokeOtherSessions },
				headers: request.headers
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Could not change the password' });
			}
			return fail(500, { message: 'Unexpected error' });
		}

		return { success: true, revokedOtherSessions: revokeOtherSessions };
	},

	signOut: async ({ request }) => {
		await auth.api.signOut({ headers: request.headers });
		redirect(302, '/login');
	}
};
