import type JSZip from 'jszip';

export type FilamentUsage = {
	id: string;
	type: string;
	color: string;
	used_m: string;
	used_g: string;
};

export type PlateDetail = {
	gcodeFilePath: string;
	gcodeContent: string;
	plateName: string;
	repeatCount: number;
	thumbnailBlobUrl: string | null;
	filaments: FilamentUsage[];
	timeString: string;
	totalSeconds: number;
};

export type ProcessedFile = {
	uniqueKey: string;
	fileName: string;
	finalFileName: string;
	file: JSZip;
	plateDetails: PlateDetail[];
};

/** One plate in the global print queue (order matters for export). */
export type QueueEntry = {
	entryId: string;
	fileKey: string;
	fileName: string;
	zip: JSZip;
	plate: PlateDetail;
	plateLabel: string;
};

export type SlotStat = {
	slot: string;
	meters: number;
	grams: number;
	colors: Set<string>;
};

export type QueueStats = {
	totalPlates: number;
	totalSeconds: number;
	totalMaterialGrams: number;
};
