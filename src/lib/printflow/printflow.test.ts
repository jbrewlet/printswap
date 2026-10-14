import JSZip from 'jszip';
import SparkMD5 from 'spark-md5';
import { describe, expect, it } from 'vitest';
import { MODEL_SETTINGS_SWAP, SWAP_GCODE_BLOCK } from '#lib/constants/swap-gcode.js';
import {
	commentOutM620Line,
	replaceAmsBlockWithSwapComment,
	stripAmsUnloadBlocks
} from './ams-strip.js';
import {
	buildSliceInfoConfig,
	countSwapInsertionsFromJobs,
	exportFlow3mfFromPayload,
	type ExportJob
} from './export-3mf.js';
import { flowOutputFileName, normalizeOutputFileName } from './filename.js';
import { ingest3mfFile } from './ingest.js';
import { computeQueueStats, computeSlotStats } from './stats.js';
import { extractEstimatedTimeFromGcode, parseEstimatedTimeSeconds } from './time.js';
import { buildSynthetic3mf, buildSyntheticFile, sampleGcodeWithAms } from './test-fixture.js';
import type { QueueEntry } from './types.js';

describe('time parsing', () => {
	it('parses multi-unit estimated time strings', () => {
		expect(parseEstimatedTimeSeconds('1d 2h 3m 4s')).toBe(93784);
		expect(parseEstimatedTimeSeconds('45m 2s')).toBe(2702);
	});

	it('reads total estimated time from gcode', () => {
		const result = extractEstimatedTimeFromGcode(sampleGcodeWithAms());
		expect(result.timeString).toBe('2h 5m 10s');
		expect(result.totalSeconds).toBe(7510);
	});
});

describe('ingest', () => {
	it('loads plate metadata and filaments from synthetic 3mf', async () => {
		const file = await buildSyntheticFile();
		const processed = await ingest3mfFile(file);
		expect(processed.plateDetails).toHaveLength(1);
		expect(processed.plateDetails[0].filaments[0].type).toBe('PETG');
		expect(processed.plateDetails[0].totalSeconds).toBe(7510);
	});
});

describe('stats', () => {
	it('computes queue totals with loops and material from slots', () => {
		const queue: QueueEntry[] = [
			{
				entryId: '1',
				fileKey: 'f1',
				fileName: 'a.gcode.3mf',
				zip: new JSZip(),
				plateLabel: 'Plate 1',
				plate: {
					gcodeFilePath: 'Metadata/plate_1.gcode',
					gcodeContent: '',
					plateName: 'plate_1',
					repeatCount: 2,
					thumbnailBlobUrl: null,
					timeString: '1h',
					totalSeconds: 3600,
					filaments: [{ id: '1', type: 'PETG', color: '#fff', used_m: '1', used_g: '3' }]
				}
			}
		];
		const slots = computeSlotStats(queue, 2);
		const stats = computeQueueStats(queue, 2, slots);
		expect(stats.totalPlates).toBe(4);
		expect(stats.totalSeconds).toBe(3600 * 4);
		expect(stats.totalMaterialGrams).toBe(12);
	});
});

describe('AMS stripping', () => {
	it('comments unload and replaces load block with padded SWAP comment', () => {
		const gcode = sampleGcodeWithAms();
		const stripped = stripAmsUnloadBlocks([gcode])[0];
		expect(stripped).toContain(';SWAP - AMS block removed');
		expect(stripped).not.toMatch(/^M620 S255/m);
	});

	it('matches Printflow padding behavior', () => {
		const segment = '\nM620 S255\nnext';
		const index = segment.indexOf('M620 S255');
		const replaced = replaceAmsBlockWithSwapComment(segment, index);
		expect(replaced).toContain(';SWAP - AMS block removed');
	});

	it('comments M on unload line', () => {
		const line = '\nM620 S255';
		const idx = line.indexOf('M620');
		expect(commentOutM620Line(line, idx)).toBe('\n;620 S255');
	});
});

describe('export', () => {
	it('writes merged gcode, md5, rewritten xml, and removes old plate gcodes', async () => {
		const baseBlob = await buildSynthetic3mf({ includeExtraPlateGcode: true });
		const baseBuffer = await baseBlob.arrayBuffer();
		const jobs: ExportJob[] = [
			{
				gcodeContent: sampleGcodeWithAms(),
				repeatCount: 2,
				filaments: [{ id: '1', type: 'PETG', color: '#f00', used_m: '1', used_g: '1' }]
			}
		];

		const baseZip = await JSZip.loadAsync(baseBuffer);
		const originalSlice = await baseZip.file('Metadata/slice_info.config')?.async('string');
		const exported = await exportFlow3mfFromPayload({
			baseZipArrayBuffer: baseBuffer,
			projectSettingsText: '<config/>',
			sliceInfoText: buildSliceInfoConfig(originalSlice!, jobs[0].filaments),
			jobs,
			loopCount: 2
		});

		const zip = await JSZip.loadAsync(await exported.arrayBuffer());
		expect(zip.file('Metadata/plate_2.gcode')).toBeNull();
		expect(zip.file('Metadata/custom_gcode_per_layer.xml')).toBeNull();

		const modelSettings = await zip.file('Metadata/model_settings.config')?.async('string');
		expect(modelSettings).toBe(MODEL_SETTINGS_SWAP);

		const sliceInfo = await zip.file('Metadata/slice_info.config')?.async('string');
		expect(sliceInfo).toContain('used_m="0"');
		expect(sliceInfo).toContain('used_g="0"');

		const merged = await zip.file('Metadata/plate_1.gcode')?.async('string');
		expect(merged).toBeTruthy();
		const swapCount = merged!.split(SWAP_GCODE_BLOCK).length - 1;
		expect(swapCount).toBe(countSwapInsertionsFromJobs(jobs, 2));
		expect(merged).toContain(';SWAP - AMS block removed');

		const md5File = await zip.file('Metadata/plate_1.gcode.md5')?.async('string');
		const expectedMd5 = SparkMD5.hash(merged ?? '');
		expect(md5File).toBe(expectedMd5);
	});
});

describe('filename', () => {
	it('strips .gcode.3mf suffixes for flow output name', () => {
		expect(flowOutputFileName('sample.gcode.3mf')).toBe('sample.flow.3mf');
		expect(flowOutputFileName('sample-plate.gcode.3mf.gcode.3mf')).toBe('sample-plate.flow.3mf');
	});

	it('keeps an edited output name and ensures a .3mf suffix', () => {
		expect(normalizeOutputFileName('sample-plate.flow.3mf', 'fallback.flow.3mf')).toBe(
			'sample-plate.flow.3mf'
		);
		expect(normalizeOutputFileName('night run', 'sample-plate.flow.3mf')).toBe('night run.3mf');
		expect(normalizeOutputFileName('custom.3MF', 'sample-plate.flow.3mf')).toBe('custom.3MF');
		expect(normalizeOutputFileName('bad/name:here', 'sample-plate.flow.3mf')).toBe(
			'badnamehere.3mf'
		);
		expect(normalizeOutputFileName('   ', 'sample-plate.flow.3mf')).toBe('sample-plate.flow.3mf');
		expect(normalizeOutputFileName('', '')).toBe('print.flow.3mf');
	});
});
