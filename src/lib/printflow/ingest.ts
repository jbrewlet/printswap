import JSZip from 'jszip';
import { strip3mfBaseName } from './filename.js';
import type { FilamentUsage, PlateDetail, ProcessedFile } from './types.js';
import { extractEstimatedTimeFromGcode } from './time.js';
import { parseXmlDocument } from './xml.js';

export class IngestError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'IngestError';
	}
}

function readElementAttributes(node: Element): Record<string, string> {
	const attributes: Record<string, string> = {};
	for (let index = 0; index < node.attributes.length; index++) {
		const attr = node.attributes.item(index);
		if (attr) {
			attributes[attr.name] = attr.value;
		}
	}
	return attributes;
}

function readFilamentsForPlate(sliceInfoDoc: Document, plateIndex: number): FilamentUsage[] {
	const indexSelector = `[key='index'][value='${plateIndex + 1}']`;
	const indexNodes = sliceInfoDoc.querySelectorAll(indexSelector);
	const filamentNodes: Element[] =
		indexNodes.length > 0
			? [...indexNodes[0].parentElement!.getElementsByTagName('filament')]
			: [
					...(sliceInfoDoc.getElementsByTagName('plate')[0]?.getElementsByTagName('filament') ?? [])
				];

	const filaments: FilamentUsage[] = [];
	for (let i = 0; i < filamentNodes.length; i++) {
		const node = filamentNodes[i];
		const color = node.getAttribute('color');
		const id = node.getAttribute('id');
		const type = node.getAttribute('type');
		const used_m = node.getAttribute('used_m');
		const used_g = node.getAttribute('used_g');
		if (color && id && type && used_m && used_g) {
			filaments.push({
				id,
				type,
				color,
				used_m,
				used_g,
				sliceAttributes: readElementAttributes(node)
			});
		}
	}
	return filaments;
}

export async function ingest3mfFile(file: File): Promise<ProcessedFile> {
	if (!file.name.endsWith('.3mf')) {
		throw new IngestError('Unsupported file type. Please upload a .3mf or .gcode.3mf file.');
	}

	let zip: JSZip;
	try {
		zip = await JSZip.loadAsync(file);
	} catch {
		throw new IngestError('Could not read file. The archive may be corrupt.');
	}

	const modelSettingsEntry = zip.file('Metadata/model_settings.config');
	if (!modelSettingsEntry) {
		throw new IngestError('Metadata/model_settings.config not found. Is this a Bambu sliced 3MF?');
	}

	const modelSettingsXml = await modelSettingsEntry.async('text');
	const modelSettingsDoc = parseXmlDocument(modelSettingsXml);
	if (!modelSettingsDoc) {
		throw new IngestError('Failed to parse Metadata/model_settings.config.');
	}

	const plateElements = modelSettingsDoc.getElementsByTagName('plate');
	if (plateElements.length === 0) {
		throw new IngestError('No plates found in this 3MF.');
	}

	if (plateElements[0].querySelectorAll("[key='gcode_file']").length === 0) {
		throw new IngestError(
			'No sliced gcode found. Export a sliced plate from Bambu Studio before using Printflow.'
		);
	}

	const sliceInfoEntry = zip.file('Metadata/slice_info.config');
	if (!sliceInfoEntry) {
		throw new IngestError('Metadata/slice_info.config not found in this 3MF.');
	}

	const sliceInfoXml = await sliceInfoEntry.async('text');
	const sliceInfoDoc = parseXmlDocument(sliceInfoXml);
	if (!sliceInfoDoc) {
		throw new IngestError('Failed to parse Metadata/slice_info.config.');
	}

	const plateDetails: PlateDetail[] = [];

	for (let plateIndex = 0; plateIndex < plateElements.length; plateIndex++) {
		const plateElement = plateElements[plateIndex];
		const gcodePath = plateElement.querySelectorAll("[key='gcode_file']")[0]?.getAttribute('value');
		if (!gcodePath) {
			continue;
		}

		const gcodeEntry = zip.file(gcodePath);
		if (!gcodeEntry) {
			throw new IngestError(`G-code file missing: ${gcodePath}`);
		}

		const gcodeContent = await gcodeEntry.async('text');
		const plateName = gcodePath.split('Metadata').join('').split('.gcode').join('');

		const thumbnailPath = plateElement
			.querySelectorAll("[key='thumbnail_file']")[0]
			?.getAttribute('value');
		let thumbnailBlobUrl: string | null = null;
		if (thumbnailPath) {
			const thumbnailEntry = zip.file(thumbnailPath);
			if (thumbnailEntry) {
				try {
					const blob = await thumbnailEntry.async('blob');
					thumbnailBlobUrl = URL.createObjectURL(blob);
				} catch {
					thumbnailBlobUrl = null;
				}
			}
		}

		const filaments = readFilamentsForPlate(sliceInfoDoc, plateIndex);
		const { timeString, totalSeconds } = extractEstimatedTimeFromGcode(gcodeContent);

		plateDetails.push({
			gcodeFilePath: gcodePath,
			gcodeContent,
			plateName,
			repeatCount: 1,
			thumbnailBlobUrl,
			filaments,
			timeString,
			totalSeconds
		});
	}

	if (plateDetails.length === 0) {
		throw new IngestError('No valid sliced plates were found in this file.');
	}

	return {
		uniqueKey: `${Date.now()}-${Math.random()}`,
		fileName: file.name,
		finalFileName: strip3mfBaseName(file.name),
		file: zip,
		plateDetails
	};
}
