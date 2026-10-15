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
	modelSettingsText?: string;
	sliceInfoText: string;
	jobs: ExportJob[];
	loopCount: number;
};

const FILAMENT_ATTRIBUTE_ORDER = [
	'id',
	'tray_info_idx',
	'type',
	'color',
	'used_m',
	'used_g'
] as const;

const MODEL_FILAMENT_MAP_KEYS = [
	'filament_map_mode',
	'filament_maps',
	'filament_volume_maps',
	'limit_filament_maps'
] as const;

export function formatFilamentAmount(value: number): string {
	if (!Number.isFinite(value)) {
		return '0.00';
	}
	return value.toFixed(2);
}

/** Merge filaments by slot and scale usage by each plate's repeat count and the loop count. */
export function collectExportFilaments(jobs: ExportJob[], loopCount: number): FilamentUsage[] {
	const byId = new Map<string, { filament: FilamentUsage; meters: number; grams: number }>();
	const loops = Math.max(0, loopCount);

	for (const job of jobs) {
		if (job.repeatCount <= 0 || loops === 0) {
			continue;
		}
		const scale = job.repeatCount * loops;
		for (const filament of job.filaments) {
			const meters = (parseFloat(filament.used_m) || 0) * scale;
			const grams = (parseFloat(filament.used_g) || 0) * scale;
			const existing = byId.get(filament.id);
			if (!existing) {
				byId.set(filament.id, { filament, meters, grams });
			} else {
				existing.meters += meters;
				existing.grams += grams;
			}
		}
	}

	return [...byId.values()].map(({ filament, meters, grams }) => ({
		...filament,
		used_m: formatFilamentAmount(meters),
		used_g: formatFilamentAmount(grams)
	}));
}

function filamentAttributes(filament: FilamentUsage): Record<string, string> {
	const attributes: Record<string, string> = { ...(filament.sliceAttributes ?? {}) };
	attributes.id = filament.id;
	if (filament.type) {
		attributes.type = filament.type;
	}
	if (filament.color) {
		attributes.color = filament.color;
	}
	attributes.used_m = formatFilamentAmount(parseFloat(filament.used_m) || 0);
	attributes.used_g = formatFilamentAmount(parseFloat(filament.used_g) || 0);
	return attributes;
}

function escapeXmlAttribute(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

/**
 * Keep the single SWAP plate, and copy the source plate's filament map.
 * Send uses that map to offer AMS Lite slots. Print can recover it from the gcode header.
 */
export function buildSwapModelSettings(originalXml: string | null | undefined): string {
	if (!originalXml) {
		return MODEL_SETTINGS_SWAP;
	}
	const doc = parseXmlDocument(originalXml);
	const plate = doc?.getElementsByTagName('plate')[0];
	if (!plate) {
		return MODEL_SETTINGS_SWAP;
	}

	const lines: string[] = [];
	for (const key of MODEL_FILAMENT_MAP_KEYS) {
		const value = plate.querySelector(`[key='${key}']`)?.getAttribute('value');
		if (!value) {
			continue;
		}
		lines.push(`    <metadata key="${key}" value="${escapeXmlAttribute(value)}"/>`);
	}
	if (lines.length === 0) {
		return MODEL_SETTINGS_SWAP;
	}

	const anchor = '    <metadata key="locked" value="false"/>\n';
	if (!MODEL_SETTINGS_SWAP.includes(anchor)) {
		return MODEL_SETTINGS_SWAP;
	}
	return MODEL_SETTINGS_SWAP.replace(anchor, `${anchor}${lines.join('\n')}\n`);
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
		const weightMeta = plate.querySelector("[key='weight']");
		if (weightMeta && filaments.length > 0) {
			const totalGrams = filaments.reduce(
				(sum, filament) => sum + (parseFloat(filament.used_g) || 0),
				0
			);
			weightMeta.setAttribute('value', formatFilamentAmount(totalGrams));
		}

		for (const filament of filaments) {
			const node = doc.createElement('filament');
			const attributes = filamentAttributes(filament);
			const ordered = [
				...FILAMENT_ATTRIBUTE_ORDER.filter((key) => key in attributes),
				...Object.keys(attributes).filter(
					(key) =>
						!FILAMENT_ATTRIBUTE_ORDER.includes(key as (typeof FILAMENT_ATTRIBUTE_ORDER)[number])
				)
			];
			for (const key of ordered) {
				node.setAttribute(key, attributes[key]);
			}
			plate.appendChild(node);
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
	const modelSettingsText = payload.modelSettingsText ?? MODEL_SETTINGS_SWAP;
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

	outputZip.file('Metadata/model_settings.config', modelSettingsText);
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
	const originalModelSettings =
		(await queue[0].zip.file('Metadata/model_settings.config')?.async('text')) ?? null;

	return {
		baseZipArrayBuffer,
		projectSettingsText,
		modelSettingsText: buildSwapModelSettings(originalModelSettings),
		sliceInfoText: buildSliceInfoConfig(originalSliceInfo, collectExportFilaments(jobs, loopCount)),
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
