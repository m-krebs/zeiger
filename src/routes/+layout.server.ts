import type { LayoutServerLoad } from './$types';
import { preferredLocale } from '$lib/format';

export const load: LayoutServerLoad = ({ locals, request }) => {
	return {
		user: locals.user ?? null,
		locale: preferredLocale(request.headers.get('accept-language'))
	};
};
