import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import JSZip from 'jszip';
import SparkMD5 from 'spark-md5';
import { describe, expect, it } from 'vitest';
import { MODEL_SETTINGS_SWAP, SWAP_GCODE_BLOCK } from '#lib/constants/swap-gcode.js';
import { localSample3mfPath } from '../../../e2e/local-sample.ts';
import {
	buildExportPayload,
	countSwapInsertionsFromJobs,
	exportFlow3mfFromPayload
} from './export-3mf.js';
import { flowOutputFileName } from './filename.js';
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
		const outputName = flowOutputFileName(processed.fileName);
		expect(outputName.endsWith('.flow.3mf')).toBe(true);
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
			join('/tmp', flowOutputFileName(sampleName)),
			Buffer.from(await blob.arrayBuffer())
		);

		const zip = await JSZip.loadAsync(await blob.arrayBuffer());
		expect(zip.file('Metadata/plate_2.gcode')).toBeNull();
		expect(zip.file('Metadata/custom_gcode_per_layer.xml')).toBeNull();

		const model = await zip.file('Metadata/model_settings.config')?.async('string');
		const slice = await zip.file('Metadata/slice_info.config')?.async('string');
		const merged = await zip.file('Metadata/plate_1.gcode')?.async('string');
		const md5 = await zip.file('Metadata/plate_1.gcode.md5')?.async('string');

		expect(model).toBe(MODEL_SETTINGS_SWAP);
		expect(slice).toContain('used_m="0"');
		expect(slice).toContain('used_g="0"');
		expect(merged!.split(SWAP_GCODE_BLOCK).length - 1).toBe(
			countSwapInsertionsFromJobs(payload.jobs, 1)
		);
		expect(md5).toBe(SparkMD5.hash(merged ?? ''));
	});
});
