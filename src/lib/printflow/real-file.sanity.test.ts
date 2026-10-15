import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import JSZip from 'jszip';
import SparkMD5 from 'spark-md5';
import { describe, expect, it } from 'vitest';
import { SWAP_GCODE_BLOCK } from '#lib/constants/swap-gcode.js';
import { localSample3mfPath } from '../../../e2e/local-sample.ts';
import {
	buildExportPayload,
	countSwapInsertionsFromJobs,
	exportFlow3mfFromPayload
} from './export-3mf.js';
import { swapOutputFileName } from './filename.js';
import { ingest3mfFile } from './ingest.js';
import { entriesFromProcessedFile } from './queue.js';

const REAL_FILE = localSample3mfPath();

describe('real local 3MF (manual sanity)', () => {
	it.skipIf(!REAL_FILE)('ingest + export a local sliced 3MF', async () => {
		const sampleName = basename(REAL_FILE);
		const buf = readFileSync(REAL_FILE);
		const file = new File([buf], sampleName, { type: 'application/zip' });
		const processed = await ingest3mfFile(file);

		expect(processed.fileName).toBe(sampleName);
		const outputName = swapOutputFileName(processed.fileName);
		expect(outputName.endsWith('.swap.3mf')).toBe(true);
		expect(outputName.includes('.gcode')).toBe(false);
		expect(processed.plateDetails.length).toBeGreaterThan(0);
		for (const plate of processed.plateDetails) {
			expect(plate.totalSeconds).toBeGreaterThan(0);
			expect(plate.filaments.length).toBeGreaterThan(0);
		}

		const queue = entriesFromProcessedFile(processed);
		const payload = await buildExportPayload(queue, 1);
		const blob = await exportFlow3mfFromPayload(payload);
		writeFileSync(
			join('/tmp', swapOutputFileName(sampleName)),
			Buffer.from(await blob.arrayBuffer())
		);

		const zip = await JSZip.loadAsync(await blob.arrayBuffer());
		expect(zip.file('Metadata/plate_2.gcode')).toBeNull();
		expect(zip.file('Metadata/custom_gcode_per_layer.xml')).toBeNull();

		const model = await zip.file('Metadata/model_settings.config')?.async('string');
		const slice = await zip.file('Metadata/slice_info.config')?.async('string');
		const merged = await zip.file('Metadata/plate_1.gcode')?.async('string');
		const md5 = await zip.file('Metadata/plate_1.gcode.md5')?.async('string');

		expect(model).toContain('plater_name" value="SWAP"');
		expect(model).toContain('filament_maps" value="1"');
		expect(slice).toMatch(/<filament\b[^>]*\btype="[^"]+"/);
		expect(slice).toMatch(/<filament\b[^>]*\bcolor="#[0-9A-Fa-f]+"/);
		expect(slice).toMatch(/used_g="(?!0(?:\.00)?")[0-9.]+"/);
		expect(slice).toContain('used_for_object="true"');
		expect(merged!.split(SWAP_GCODE_BLOCK).length - 1).toBe(
			countSwapInsertionsFromJobs(payload.jobs, 1)
		);
		expect(md5).toBe(SparkMD5.hash(merged ?? ''));
	});
});
