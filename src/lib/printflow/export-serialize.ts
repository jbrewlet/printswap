import type { ExportJob, ExportPayload } from './export-3mf.js';
import type { FilamentUsage, QueueEntry } from './types.js';

export function plainFilament(filament: FilamentUsage): FilamentUsage {
	return {
		id: String(filament.id),
		type: String(filament.type),
		color: String(filament.color),
		used_m: String(filament.used_m),
		used_g: String(filament.used_g)
	};
}

export function plainExportJob(job: ExportJob): ExportJob {
	return {
		gcodeContent: String(job.gcodeContent),
		repeatCount: Math.max(1, Math.floor(Number(job.repeatCount))),
		filaments: job.filaments.map(plainFilament)
	};
}

/** Deep plain copy safe for Worker postMessage / structuredClone. */
export function cloneExportPayloadForWorker(payload: ExportPayload): ExportPayload {
	return {
		baseZipArrayBuffer: payload.baseZipArrayBuffer.slice(0),
		projectSettingsText: payload.projectSettingsText,
		sliceInfoText: payload.sliceInfoText,
		loopCount: payload.loopCount,
		jobs: payload.jobs.map(plainExportJob)
	};
}

export function plainJobsFromQueue(queue: QueueEntry[]): ExportJob[] {
	return queue.map((entry) => ({
		gcodeContent: String(entry.plate.gcodeContent),
		repeatCount: Math.max(1, Math.floor(Number(entry.plate.repeatCount))),
		filaments: [...entry.plate.filaments].map(plainFilament)
	}));
}

export function assertStructuredCloneable(payload: ExportPayload): void {
	structuredClone(payload);
}
