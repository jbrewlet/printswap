import { describe, expect, it } from 'vitest';
import { buildExportPayload } from './export-3mf.js';
import {
	assertStructuredCloneable,
	cloneExportPayloadForWorker,
	plainFilament
} from './export-serialize.js';
import { buildWorkerExportPayload } from './export-worker.js';
import { entriesFromProcessedFile } from './queue.js';
import { buildSyntheticFile } from './test-fixture.js';
import { ingest3mfFile } from './ingest.js';
import type { FilamentUsage } from './types.js';

describe('worker export payload', () => {
	it('plainFilament copies proxy-like filament objects', () => {
		const raw: FilamentUsage = {
			id: '1',
			type: 'PETG',
			color: '#f80',
			used_m: '1.2',
			used_g: '3.4'
		};
		const proxy = new Proxy(raw, {
			get(target, prop, receiver) {
				return Reflect.get(target, prop, receiver);
			}
		});
		const plain = plainFilament(proxy);
		expect(() => structuredClone(plain)).not.toThrow();
	});

	it('buildWorkerExportPayload is structured-cloneable', async () => {
		const file = await buildSyntheticFile();
		const processed = await ingest3mfFile(file);
		const queue = entriesFromProcessedFile(processed);
		const payload = await buildWorkerExportPayload(queue, 2);
		expect(() => assertStructuredCloneable(payload)).not.toThrow();
		expect(payload.sliceInfoText).toContain('tray_info_idx="GFG99"');
		expect(payload.sliceInfoText).toContain('type="PETG"');
		expect(payload.sliceInfoText).toContain('used_m="21.00"');
		expect(payload.sliceInfoText).toContain('used_g="64.20"');
		expect(payload.modelSettingsText).toBeDefined();
	});

	it('cloneExportPayloadForWorker fixes non-cloneable job arrays', async () => {
		const file = await buildSyntheticFile();
		const processed = await ingest3mfFile(file);
		const queue = entriesFromProcessedFile(processed);
		const raw = await buildExportPayload(queue, 1);
		const broken = {
			...raw,
			jobs: [{ ...raw.jobs[0], onProgress: () => undefined }]
		};
		expect(() => structuredClone(broken)).toThrow();
		const fixed = cloneExportPayloadForWorker(raw);
		expect(() => structuredClone(fixed)).not.toThrow();
	});
});
