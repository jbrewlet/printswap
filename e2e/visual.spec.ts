import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from '@playwright/test';

const SHOTS = '/tmp/printswap-shots';
const REAL_3MF =
	'sample.gcode.3mf';

test('capture UI screenshots (light, dark, empty, loaded)', async ({ page, browser }) => {
	mkdirSync(SHOTS, { recursive: true });

	await page.emulateMedia({ colorScheme: 'light' });
	await page.goto('/');
	await page.screenshot({ path: join(SHOTS, 'empty-light.png'), fullPage: true });

	if (existsSync(REAL_3MF)) {
		await page.getByTestId('file-input').setInputFiles(REAL_3MF);
		await page.waitForTimeout(500);
		await page.screenshot({ path: join(SHOTS, 'loaded-light.png'), fullPage: true });
	}

	const darkContext = await browser.newContext({ colorScheme: 'dark' });
	const darkPage = await darkContext.newPage();
	await darkPage.goto('/');
	await darkPage.screenshot({ path: join(SHOTS, 'empty-dark.png'), fullPage: true });

	if (existsSync(REAL_3MF)) {
		await darkPage.getByTestId('file-input').setInputFiles(REAL_3MF);
		await darkPage.waitForTimeout(500);
		await darkPage.screenshot({ path: join(SHOTS, 'loaded-dark.png'), fullPage: true });
	}

	await darkContext.close();
});
