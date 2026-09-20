import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { onlineMaintenance } from '$lib/online/maintenance';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ route }) => {
	if (onlineMaintenance && /^\/(friend|join|match|room|game)(\/|$)/.test(route.id ?? '')) {
		redirect(307, resolve('/'));
	}
};
