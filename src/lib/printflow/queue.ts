import type { ProcessedFile, QueueEntry } from './types.js';

export function entriesFromProcessedFile(processed: ProcessedFile): QueueEntry[] {
	return processed.plateDetails.map((plate, index) => ({
		entryId: `${processed.uniqueKey}-${index}-${Date.now()}-${Math.random()}`,
		fileKey: processed.uniqueKey,
		fileName: processed.fileName,
		zip: processed.file,
		plate,
		plateLabel: `Plate ${index + 1}`
	}));
}

export function moveQueueEntry(
	queue: QueueEntry[],
	entryId: string,
	direction: -1 | 1
): QueueEntry[] {
	const index = queue.findIndex((entry) => entry.entryId === entryId);
	if (index === -1) {
		return queue;
	}
	const target = index + direction;
	if (target < 0 || target >= queue.length) {
		return queue;
	}
	const next = [...queue];
	const [item] = next.splice(index, 1);
	next.splice(target, 0, item);
	return next;
}

export function removeQueueEntry(queue: QueueEntry[], entryId: string): QueueEntry[] {
	const entry = queue.find((item) => item.entryId === entryId);
	if (entry?.plate.thumbnailBlobUrl) {
		URL.revokeObjectURL(entry.plate.thumbnailBlobUrl);
	}
	return queue.filter((item) => item.entryId !== entryId);
}

export function revokeQueueThumbnails(queue: QueueEntry[]): void {
	for (const entry of queue) {
		if (entry.plate.thumbnailBlobUrl) {
			URL.revokeObjectURL(entry.plate.thumbnailBlobUrl);
		}
	}
}
