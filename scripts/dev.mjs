import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';

const local = existsSync('.env.local') ? parseEnv(readFileSync('.env.local', 'utf8')) : {};
const env = { ...local, ...process.env };
if (env.CONVEX_DEPLOY_KEY) {
	throw new Error(
		'Remove CONVEX_DEPLOY_KEY from local development. CI owns production credentials.'
	);
}
const deployment = env.CONVEX_DEPLOYMENT ?? '';
if (!/^(dev|local):/.test(deployment)) {
	throw new Error('Local development requires a dev or local CONVEX_DEPLOYMENT in .env.local.');
}
const url = new URL(env.PUBLIC_CONVEX_URL ?? '');
if (deployment.startsWith('dev:') && !url.hostname.startsWith(`${deployment.slice(4)}.`)) {
	throw new Error('PUBLIC_CONVEX_URL must point to the selected development deployment.');
}
console.log(`Development backend: ${url.origin}`);
const commands = {
	frontend: ['vite', 'dev'],
	backend: ['convex', 'dev'],
	all: ['convex', 'dev', '--start', 'vite dev'],
	push: ['convex', 'dev', '--once']
};
const args = commands[process.argv[2]];
if (!args) throw new Error('Expected frontend, backend, all, or push.');
const child = spawn('bunx', args, { env, stdio: 'inherit' });
child.on('error', (error) => {
	console.error(error.message);
	process.exitCode = 1;
});
child.on('exit', (code) => {
	process.exitCode = code ?? 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
