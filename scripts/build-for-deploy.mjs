import { spawnSync } from 'node:child_process';

// Convex injects the URL of the deployment selected by CONVEX_DEPLOY_KEY.
const url = new URL(process.env.PUBLIC_CONVEX_URL ?? '');
if (url.protocol !== 'https:' || !url.hostname.endsWith('.convex.cloud')) {
	throw new Error('Expected a Convex cloud deployment URL.');
}
if (url.origin !== process.env.PRODUCTION_CONVEX_URL) {
	throw new Error('Convex selected a different backend than PRODUCTION_CONVEX_URL.');
}
const site = new URL(url);
site.hostname = site.hostname.replace(/\.convex\.cloud$/, '.convex.site');
const env = { ...process.env, PUBLIC_CONVEX_SITE_URL: site.origin };
for (const script of ['gen', 'build']) {
	const result = spawnSync('bun', ['run', script], { env, stdio: 'inherit' });
	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status ?? 1);
}
