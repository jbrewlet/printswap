import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	timeout: 120_000,
	expect: { timeout: 60_000 },
	fullyParallel: false,
	workers: 1,
	use: {
		baseURL: 'http://localhost:3100',
		trace: 'on-first-retry'
	},
	webServer: {
		command: 'npm run dev',
		url: 'http://localhost:3100',
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	}
});
