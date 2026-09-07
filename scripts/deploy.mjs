import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

for (const name of [
	'CLOUDFLARE_ACCOUNT_ID',
	'CLOUDFLARE_API_TOKEN',
	'CONVEX_DEPLOY_KEY',
	'AUTH_PROXY_SECRET'
]) {
	if (!process.env[name]) throw new Error(`Missing deployment secret: ${name}`);
}
if (!process.env.CONVEX_DEPLOY_KEY.startsWith('prod:')) {
	throw new Error('Production releases require a production Convex deploy key.');
}
if (!process.env.PRODUCTION_CONVEX_URL) {
	throw new Error('Missing expected PRODUCTION_CONVEX_URL.');
}
function run(args) {
	const result = spawnSync('bunx', args, { stdio: 'inherit' });
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error(`${args[0]} exited with status ${result.status}`);
}

// A failed build stops before publishing backend changes. A failed backend push stops the Worker deploy.
run([
	'convex',
	'deploy',
	'--cmd',
	'node scripts/build-for-deploy.mjs',
	'--cmd-url-env-var-name',
	'PUBLIC_CONVEX_URL',
	'--typecheck',
	'enable',
	'--codegen',
	'disable'
]);
const directory = mkdtempSync(join(tmpdir(), '4dchess-deploy-'));
try {
	const file = join(directory, 'secrets.json');
	writeFileSync(file, JSON.stringify({ AUTH_PROXY_SECRET: process.env.AUTH_PROXY_SECRET }), {
		mode: 0o600
	});
	run(['wrangler', 'deploy', '--secrets-file', file]);
} finally {
	rmSync(directory, { recursive: true, force: true });
}
