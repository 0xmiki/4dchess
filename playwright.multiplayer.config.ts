import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	testMatch: 'multiplayer.spec.ts',
	timeout: 90000,
	expect: { timeout: 15000 },
	workers: 1,
	use: {
		baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
		launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
	}
});
