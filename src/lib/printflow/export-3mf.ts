import JSZip from 'jszip';
import SparkMD5 from 'spark-md5';
import { MODEL_SETTINGS_SWAP, SWAP_GCODE_BLOCK } from '#lib/constants/swap-gcode.js';
import { stripAmsUnloadBlocks } from './ams-strip.js';
import type { FilamentUsage, QueueEntry } from './types.js';
import { parseXmlDocument } from './xml.js';

export type ExportJob = {
	gcodeContent: string;
	repeatCount: number;
	filaments: FilamentUsage[];
};

export type ExportPayload = {
	baseZipArrayBuffer: ArrayBuffer;
	projectSettingsText: string | null;
	/** Pre-built on the main thread so the worker avoids DOM XML APIs. */
	sliceInfoText: string;
	jobs: ExportJob[];
	loopCount: number;
};

function collectUniqueFilamentsFromJobs(jobs: ExportJob[]): FilamentUsage[] {
	const unique: FilamentUsage[] = [];
	for (const job of jobs) {
		for (const filament of job.filaments) {
			if (!unique.some((item) => item.id === filament.id)) {
				unique.push(filament);
			}
		}
	}
	return unique;
}

export function buildSliceInfoConfig(originalXml: string, filaments: FilamentUsage[]): string {
	const doc = parseXmlDocument(originalXml);
	if (!doc) {
		throw new Error('Failed to parse slice_info.config for export.');
	}

	const plates = doc.getElementsByTagName('plate');
	while (plates.length > 1) {
		plates[plates.length - 1].remove();
	}

	const plate = plates[0];
	const indexMeta = plate?.querySelectorAll("[key='index']")[0];
	indexMeta?.setAttribute('value', '1');

	const existingFilaments = plate?.getElementsByTagName('filament');
	while (existingFilaments && existingFilaments.length > 0) {
		existingFilaments[existingFilaments.length - 1].remove();
	}

	if (plate) {
		for (const filament of filaments) {
			const node = doc.createElement('filament');
			plate.appendChild(node);
			node.setAttribute('id', filament.id);
			node.setAttribute('used_m', '0');
			node.setAttribute('used_g', '0');
		}
	}

	return new XMLSerializer().serializeToString(doc);
}

function buildJobGcodeBlocksFromJobs(jobs: ExportJob[]): string[] {
	const blocks: string[] = [];
	for (const job of jobs) {
		if (job.repeatCount <= 0) {
			continue;
		}
		for (let i = 0; i < job.repeatCount; i++) {
			blocks.push(job.gcodeContent);
		}
	}
	return blocks;
}

function md5HexForGcodeParts(parts: string[]): string {
	const spark = new SparkMD5.ArrayBuffer();
	for (const part of parts) {
		spark.append(new TextEncoder().encode(part).buffer);
	}
	return spark.end();
}

export type ExportProgressCallback = (percent: number) => void;

export async function exportFlow3mfFromPayload(
	payload: ExportPayload,
	onProgress?: ExportProgressCallback
): Promise<Blob> {
	const { baseZipArrayBuffer, projectSettingsText, sliceInfoText, jobs, loopCount } = payload;
	if (jobs.length === 0) {
		throw new Error('No files to export.');
	}

	onProgress?.(5);

	const outputZip = await JSZip.loadAsync(baseZipArrayBuffer);

	const plateGcodeFiles = outputZip.file(/plate_\d+\.gcode$/);
	if (plateGcodeFiles) {
		for (const entry of plateGcodeFiles) {
			outputZip.remove(entry.name);
		}
	}
	outputZip.remove('Metadata/custom_gcode_per_layer.xml');

	if (projectSettingsText) {
		outputZip.file('Metadata/project_settings.config', projectSettingsText);
	}

	outputZip.file('Metadata/model_settings.config', MODEL_SETTINGS_SWAP);
	outputZip.file('Metadata/slice_info.config', sliceInfoText);

	onProgress?.(25);

	const jobBlocks = buildJobGcodeBlocksFromJobs(jobs);
	const sequence = jobBlocks.map((block) => block + SWAP_GCODE_BLOCK);

	let mergedParts: string[] = [];
	for (let loop = 0; loop < loopCount; loop++) {
		mergedParts = mergedParts.concat(sequence);
	}

	if (mergedParts.length === 0) {
		throw new Error('No gcode blocks found for export.');
	}

	mergedParts = stripAmsUnloadBlocks(mergedParts);

	const md5 = md5HexForGcodeParts(mergedParts);
	outputZip.file('Metadata/plate_1.gcode', mergedParts.join(''));
	outputZip.file('Metadata/plate_1.gcode.md5', md5);

	onProgress?.(75);

	return outputZip.generateAsync(
		{
			type: 'blob',
			compression: 'DEFLATE',
			compressionOptions: { level: 3 }
		},
		(metadata) => {
			onProgress?.(75 + 0.2 * (metadata.percent ?? 0));
		}
	);
}

function findProjectSettingsZip(queue: QueueEntry[]): JSZip | undefined {
	let highestId = '';
	let zip: JSZip | undefined;

	for (const entry of queue) {
		for (const filament of entry.plate.filaments) {
			if (filament.id > highestId) {
				highestId = filament.id;
				zip = entry.zip;
			}
		}
	}
	return zip;
}

export async function buildExportPayload(
	queue: QueueEntry[],
	loopCount: number
): Promise<ExportPayload> {
	const baseZipArrayBuffer = await queue[0].zip.generateAsync({ type: 'arraybuffer' });
	const projectZip = findProjectSettingsZip(queue);
	let projectSettingsText: string | null = null;
	if (projectZip) {
		projectSettingsText =
			(await projectZip.file('Metadata/project_settings.config')?.async('text')) ?? null;
	}

	const jobs: ExportJob[] = queue.map((entry) => ({
		gcodeContent: entry.plate.gcodeContent,
		repeatCount: entry.plate.repeatCount,
		filaments: entry.plate.filaments
	}));

	const originalSliceInfo = await queue[0].zip.file('Metadata/slice_info.config')?.async('text');
	if (!originalSliceInfo) {
		throw new Error('Metadata/slice_info.config not found in export base archive.');
	}

	return {
		baseZipArrayBuffer,
		projectSettingsText,
		sliceInfoText: buildSliceInfoConfig(originalSliceInfo, collectUniqueFilamentsFromJobs(jobs)),
		jobs,
		loopCount
	};
}

export async function exportFlow3mf(
	queue: QueueEntry[],
	loopCount: number,
	onProgress?: ExportProgressCallback
): Promise<Blob> {
	const payload = await buildExportPayload(queue, loopCount);
	return exportFlow3mfFromPayload(payload, onProgress);
}

export function countSwapInsertionsFromJobs(jobs: ExportJob[], loopCount: number): number {
	return buildJobGcodeBlocksFromJobs(jobs).length * loopCount;
}

export function countSwapInsertions(queue: QueueEntry[], loopCount: number): number {
	const jobs: ExportJob[] = queue.map((entry) => ({
		gcodeContent: entry.plate.gcodeContent,
		repeatCount: entry.plate.repeatCount,
		filaments: entry.plate.filaments
	}));
	return countSwapInsertionsFromJobs(jobs, loopCount);
}
