import { ConvexHttpClient } from 'convex/browser';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { api } from '../../convex/_generated/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ setHeaders }) => {
	try {
		const stats = await new ConvexHttpClient(PUBLIC_CONVEX_URL, {
			fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5000) })
		}).query(api.stats.publicSummary, {});
		setHeaders({ 'cache-control': 'public, max-age=30, s-maxage=60' });
		return {
			stats,
			unavailable: false,
			stale: !!stats && Date.now() - stats.sampledAt > 15 * 60000
		};
	} catch {
		setHeaders({ 'cache-control': 'no-store' });
		return { stats: null, unavailable: true, stale: false };
	}
};
