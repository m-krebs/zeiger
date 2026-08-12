import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(302, '/');
	return {};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const username = formData.get('username')?.toString().trim() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) {
			return fail(400, {
				message: 'Username must be 3-30 characters (letters, digits, _ . -)'
			});
		}
		if (password.length < 8) {
			return fail(400, { message: 'Password must be at least 8 characters' });
		}

		try {
			await auth.api.signUpEmail({
				body: {
					// accounts are username-only; better-auth still requires an email
					email: `${username.toLowerCase()}@users.zeiger.local`,
					name: username,
					username,
					password
				},
				headers: request.headers
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Registration failed' });
			}
			return fail(500, { message: 'Unexpected error' });
		}

		redirect(302, '/');
	}
};
