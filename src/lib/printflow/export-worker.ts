import { buildExportPayload, exportFlow3mfFromPayload } from './export-3mf.js';
import type { ExportPayload } from './export-3mf.js';
import {
	assertStructuredCloneable,
	cloneExportPayloadForWorker,
	plainJobsFromQueue
} from './export-serialize.js';
import type { QueueEntry } from './types.js';

export type ExportWorkerRequest = {
	type: 'export';
	payload: ExportPayload;
};

export type ExportWorkerResponse =
	| { type: 'progress'; percent: number }
	| { type: 'complete'; blob: Blob }
	| { type: 'error'; message: string };

export async function buildWorkerExportPayload(
	queue: QueueEntry[],
	loopCount: number
): Promise<ExportPayload> {
	const partial = await buildExportPayload(queue, loopCount);
	return cloneExportPayloadForWorker({
		...partial,
		jobs: plainJobsFromQueue(queue)
	});
}

export async function runExportInWorker(
	queue: QueueEntry[],
	loopCount: number,
	onProgress: (percent: number) => void
): Promise<Blob> {
	const workerPayload = await buildWorkerExportPayload(queue, loopCount);
	assertStructuredCloneable(workerPayload);

	if (typeof Worker === 'undefined') {
		return exportFlow3mfFromPayload(workerPayload, onProgress);
	}

	return new Promise((resolve, reject) => {
		const worker = new Worker(new URL('./export.worker.ts', import.meta.url), { type: 'module' });
		const transferBuffer = workerPayload.baseZipArrayBuffer.slice(0);
		const messagePayload: ExportPayload = {
			...workerPayload,
			baseZipArrayBuffer: transferBuffer
		};

		worker.onmessage = (event: MessageEvent<ExportWorkerResponse>) => {
			const message = event.data;
			if (message.type === 'progress') {
				onProgress(message.percent);
			} else if (message.type === 'complete') {
				worker.terminate();
				resolve(message.blob);
			} else if (message.type === 'error') {
				worker.terminate();
				reject(new Error(message.message));
			}
		};

		worker.onerror = (error) => {
			worker.terminate();
			reject(error);
		};

		worker.postMessage({ type: 'export', payload: messagePayload } satisfies ExportWorkerRequest, [
			transferBuffer
		]);
	});
}
