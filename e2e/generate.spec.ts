import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import JSZip from 'jszip';
import { expect, test } from '@playwright/test';
import { SWAP_GCODE_BLOCK } from '../src/lib/constants/swap-gcode.ts';
import { flowOutputFileName } from '../src/lib/printflow/filename.ts';
import { localSample3mfPath } from './local-sample.ts';

const REAL_3MF = localSample3mfPath();

test.describe('Generate flow export', () => {
	test.skip(!REAL_3MF, 'local sample 3MF is not configured');

	test('uploads, exports once, and embeds swap blocks', async ({ page }) => {
		const consoleErrors: string[] = [];
		page.on('pageerror', (error) => consoleErrors.push(error.message));
		page.on('console', (message) => {
			if (message.type() === 'error') {
				consoleErrors.push(message.text());
			}
		});

		let downloadCount = 0;
		page.on('download', () => {
			downloadCount += 1;
		});

		await page.goto('/');

		await page.getByTestId('file-input').setInputFiles(REAL_3MF);
		await expect(page.getByRole('list', { name: 'Plate queue' })).toBeVisible();

		await page.getByTestId('loops-input').fill('2');

		const downloadPromise = page.waitForEvent('download');
		await page.getByTestId('generate-button').click();
		const download = await downloadPromise;

		expect(downloadCount).toBe(1);
		expect(download.suggestedFilename()).toBe(flowOutputFileName(basename(REAL_3MF)));

		const tempPath = await download.path();
		expect(tempPath).toBeTruthy();
		const zip = await JSZip.loadAsync(readFileSync(tempPath!));
		const merged = await zip.file('Metadata/plate_1.gcode')?.async('string');
		expect(merged).toBeTruthy();

		const plateCount = await page.locator('ul[aria-label="Plate queue"] > li').count();
		const swapCount = merged!.split(SWAP_GCODE_BLOCK).length - 1;
		expect(swapCount).toBe(plateCount * 2);

		expect(consoleErrors).toEqual([]);
	});
});
