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
	buildSwapModelSettings,
	collectExportFilaments,
	countSwapInsertionsFromJobs,
	exportFlow3mfFromPayload,
	type ExportJob
} from './export-3mf.js';
import { normalizeOutputFileName, swapOutputFileName } from './filename.js';
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
		expect(processed.plateDetails[0].filaments[0].sliceAttributes?.tray_info_idx).toBe('GFG99');
		expect(processed.plateDetails[0].filaments[0].sliceAttributes?.used_for_object).toBe('true');
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
				plateIndex: 0,
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

describe('slice info filaments', () => {
	it('keeps AMS identity and scales usage by repeats and loops', () => {
		const filaments = collectExportFilaments(
			[
				{
					gcodeContent: '',
					repeatCount: 2,
					filaments: [
						{
							id: '1',
							type: 'PETG',
							color: '#F75403',
							used_m: '10.5',
							used_g: '32.1',
							sliceAttributes: {
								id: '1',
								tray_info_idx: 'GFG99',
								type: 'PETG',
								color: '#F75403',
								used_m: '10.5',
								used_g: '32.1',
								used_for_object: 'true',
								volume_type: 'Standard'
							}
						}
					]
				}
			],
			2
		);
		expect(filaments[0].used_m).toBe('42.00');
		expect(filaments[0].used_g).toBe('128.40');

		const slice = buildSliceInfoConfig(
			`<?xml version="1.0" encoding="UTF-8"?>
<config>
  <plate>
    <metadata key="index" value="2"/>
    <metadata key="weight" value="32.1"/>
    <metadata key="filament_maps" value="1"/>
  </plate>
</config>`,
			filaments
		);
		expect(slice).toContain('tray_info_idx="GFG99"');
		expect(slice).toContain('type="PETG"');
		expect(slice).toContain('color="#F75403"');
		expect(slice).toContain('used_m="42.00"');
		expect(slice).toContain('used_g="128.40"');
		expect(slice).toContain('used_for_object="true"');
		expect(slice).toContain('volume_type="Standard"');
		expect(slice).toContain('key="filament_maps" value="1"');
		expect(slice).toContain('key="weight" value="128.40"');
		expect(slice).toContain('key="index" value="1"');
	});

	it('copies filament map metadata onto the swap plate', () => {
		const settings = buildSwapModelSettings(`<?xml version="1.0" encoding="UTF-8"?>
<config>
  <plate>
    <metadata key="plater_id" value="1"/>
    <metadata key="filament_map_mode" value="Auto For Flush"/>
    <metadata key="filament_maps" value="1"/>
    <metadata key="filament_volume_maps" value="0"/>
  </plate>
</config>`);
		expect(settings).toContain('plater_name" value="SWAP"');
		expect(settings).toContain('filament_map_mode" value="Auto For Flush"');
		expect(settings).toContain('filament_maps" value="1"');
		expect(settings).toContain('filament_volume_maps" value="0"');
		expect(buildSwapModelSettings(null)).toBe(MODEL_SETTINGS_SWAP);
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
		expect(sliceInfo).toContain('type="PETG"');
		expect(sliceInfo).toContain('color="#f00"');
		expect(sliceInfo).toContain('used_m="1.00"');
		expect(sliceInfo).toContain('used_g="1.00"');

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
	it('strips .gcode.3mf suffixes for swap output name', () => {
		expect(swapOutputFileName('plate.gcode.3mf')).toBe('plate.swap.3mf');
		expect(swapOutputFileName('plate.gcode.3mf.gcode.3mf')).toBe('plate.swap.3mf');
	});

	it('keeps an edited output name and ensures a .3mf suffix', () => {
		expect(normalizeOutputFileName('plate.swap.3mf', 'fallback.swap.3mf')).toBe('plate.swap.3mf');
		expect(normalizeOutputFileName('night run', 'plate.swap.3mf')).toBe('night run.3mf');
		expect(normalizeOutputFileName('custom.3MF', 'plate.swap.3mf')).toBe('custom.3MF');
		expect(normalizeOutputFileName('bad/name:here', 'plate.swap.3mf')).toBe('badnamehere.3mf');
		expect(normalizeOutputFileName('a\u0000b', 'fallback.swap.3mf')).toBe('ab.3mf');
		expect(normalizeOutputFileName('   ', 'plate.swap.3mf')).toBe('plate.swap.3mf');
		expect(normalizeOutputFileName('', '')).toBe('print.swap.3mf');
	});
});
