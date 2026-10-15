import { describe, expect, it } from 'vitest';
import { buildSynthetic3mf } from './test-fixture.js';
import { isStoredSession, restoreQueue, sessionFromQueue } from './session-store.js';
import type { QueueEntry } from './types.js';
import JSZip from 'jszip';

describe('saved plate session', () => {
	it('rejects a session that is missing plate identity', () => {
		expect(
			isStoredSession({ loops: 1, outputFileName: 'a.swap.3mf', outputNameEdited: false })
		).toBe(false);
		expect(
			isStoredSession({
				loops: 2,
				outputFileName: 'night.swap.3mf',
				outputNameEdited: true,
				entries: [{ entryId: 'e1', fileId: 'f1', plateIndex: 0, repeatCount: 3 }]
			})
		).toBe(true);
	});

	it('restores repeat counts, order, and plate files', async () => {
		const bytes = await (await buildSynthetic3mf()).arrayBuffer();
		const restored = await restoreQueue(
			{
				loops: 3,
				outputFileName: 'custom.swap.3mf',
				outputNameEdited: true,
				entries: [{ entryId: 'kept-id', fileId: 'file-a', plateIndex: 0, repeatCount: 4 }]
			},
			[{ id: 'file-a', name: 'bed.gcode.3mf', bytes }]
		);

		expect(restored).toHaveLength(1);
		expect(restored[0].entryId).toBe('kept-id');
		expect(restored[0].fileName).toBe('bed.gcode.3mf');
		expect(restored[0].plate.repeatCount).toBe(4);
		expect(restored[0].plate.filaments[0].type).toBe('PETG');
		expect(restored[0].zip.file('Metadata/plate_1.gcode')).toBeTruthy();
	});

	it('snapshots the live queue for storage', () => {
		const entry: QueueEntry = {
			entryId: 'e1',
			fileKey: 'f1',
			fileName: 'bed.gcode.3mf',
			zip: new JSZip(),
			plateLabel: 'Plate 1',
			plateIndex: 0,
			plate: {
				gcodeFilePath: 'Metadata/plate_1.gcode',
				gcodeContent: '',
				plateName: 'plate_1',
				repeatCount: 2.8,
				thumbnailBlobUrl: null,
				timeString: '1m',
				totalSeconds: 60,
				filaments: []
			}
		};
		expect(sessionFromQueue([entry], 2.2, 'bed.swap.3mf', false)).toEqual({
			loops: 2,
			outputFileName: 'bed.swap.3mf',
			outputNameEdited: false,
			entries: [{ entryId: 'e1', fileId: 'f1', plateIndex: 0, repeatCount: 2 }]
		});
	});
});
