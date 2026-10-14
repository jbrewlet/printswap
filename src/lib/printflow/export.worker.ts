import { exportFlow3mfFromPayload } from './export-3mf.js';
import type { ExportWorkerRequest, ExportWorkerResponse } from './export-worker.js';

self.onmessage = async (event: MessageEvent<ExportWorkerRequest>) => {
	if (event.data.type !== 'export') {
		return;
	}

	try {
		const blob = await exportFlow3mfFromPayload(event.data.payload, (percent) => {
			const progressMessage: ExportWorkerResponse = { type: 'progress', percent };
			self.postMessage(progressMessage);
		});
		const completeMessage: ExportWorkerResponse = { type: 'complete', blob };
		self.postMessage(completeMessage);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Export failed.';
		const errorMessage: ExportWorkerResponse = { type: 'error', message };
		self.postMessage(errorMessage);
	}
};

export {};
