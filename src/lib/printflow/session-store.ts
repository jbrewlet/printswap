import { ingest3mfFile } from './ingest.js';
import type { QueueEntry } from './types.js';

const DB_NAME = 'printswap';
const DB_VERSION = 1;
const SESSION_KEY = 'state';

export type StoredFile = {
	id: string;
	name: string;
	bytes: ArrayBuffer;
};

export type StoredEntry = {
	entryId: string;
	fileId: string;
	plateIndex: number;
	repeatCount: number;
};

export type StoredSession = {
	loops: number;
	outputFileName: string;
	outputNameEdited: boolean;
	entries: StoredEntry[];
};

export function sessionFromQueue(
	queue: QueueEntry[],
	loops: number,
	outputFileName: string,
	outputNameEdited: boolean
): StoredSession {
	return {
		loops: Math.max(1, Math.floor(loops) || 1),
		outputFileName,
		outputNameEdited,
		entries: queue.map((entry) => ({
			entryId: entry.entryId,
			fileId: entry.fileKey,
			plateIndex: entry.plateIndex,
			repeatCount: Math.max(1, Math.floor(entry.plate.repeatCount) || 1)
		}))
	};
}

function isStoredEntry(value: unknown): value is StoredEntry {
	if (!value || typeof value !== 'object') return false;
	const entry = value as StoredEntry;
	return (
		typeof entry.entryId === 'string' &&
		typeof entry.fileId === 'string' &&
		Number.isInteger(entry.plateIndex) &&
		entry.plateIndex >= 0 &&
		typeof entry.repeatCount === 'number'
	);
}

export function isStoredSession(value: unknown): value is StoredSession {
	if (!value || typeof value !== 'object') return false;
	const session = value as StoredSession;
	return (
		typeof session.loops === 'number' &&
		typeof session.outputFileName === 'string' &&
		typeof session.outputNameEdited === 'boolean' &&
		Array.isArray(session.entries) &&
		session.entries.every(isStoredEntry)
	);
}

function isStoredFile(value: unknown): value is StoredFile {
	if (!value || typeof value !== 'object') return false;
	const file = value as StoredFile;
	return (
		typeof file.id === 'string' &&
		typeof file.name === 'string' &&
		file.bytes instanceof ArrayBuffer
	);
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('Plate storage failed.'));
	});
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onabort = () =>
			reject(transaction.error ?? new Error('Plate storage was aborted.'));
		transaction.onerror = () => reject(transaction.error ?? new Error('Plate storage failed.'));
	});
}

function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains('files')) {
				db.createObjectStore('files', { keyPath: 'id' });
			}
			if (!db.objectStoreNames.contains('session')) {
				db.createObjectStore('session');
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('Could not open plate storage.'));
	});
}

export async function putStoredFile(id: string, name: string, bytes: ArrayBuffer): Promise<void> {
	const db = await openDatabase();
	try {
		const tx = db.transaction('files', 'readwrite');
		tx.objectStore('files').put({ id, name, bytes } satisfies StoredFile);
		await transactionDone(tx);
	} finally {
		db.close();
	}
}

export async function readSession(): Promise<{
	session: StoredSession;
	files: StoredFile[];
} | null> {
	if (typeof indexedDB === 'undefined') return null;
	const db = await openDatabase();
	try {
		const tx = db.transaction(['files', 'session'], 'readonly');
		const sessionRequest = tx.objectStore('session').get(SESSION_KEY);
		const filesRequest = tx.objectStore('files').getAll();
		const [session, files] = await Promise.all([
			requestResult(sessionRequest),
			requestResult(filesRequest),
			transactionDone(tx)
		]);
		if (!isStoredSession(session)) return null;
		const storedFiles = Array.isArray(files) ? files.filter(isStoredFile) : [];
		return { session, files: storedFiles };
	} finally {
		db.close();
	}
}

export async function writeSession(session: StoredSession): Promise<void> {
	const db = await openDatabase();
	try {
		const tx = db.transaction(['files', 'session'], 'readwrite');
		const files = tx.objectStore('files');
		const keep = new Set(session.entries.map((entry) => entry.fileId));
		const cursorRequest = files.openCursor();
		cursorRequest.onsuccess = () => {
			const cursor = cursorRequest.result;
			if (!cursor) return;
			if (!keep.has(String(cursor.key))) cursor.delete();
			cursor.continue();
		};
		tx.objectStore('session').put(sessionFromQueueValues(session), SESSION_KEY);
		await transactionDone(tx);
	} finally {
		db.close();
	}
}

function sessionFromQueueValues(session: StoredSession): StoredSession {
	return {
		loops: Math.max(1, Math.floor(session.loops) || 1),
		outputFileName: session.outputFileName,
		outputNameEdited: session.outputNameEdited,
		entries: session.entries.map((entry) => ({
			entryId: entry.entryId,
			fileId: entry.fileId,
			plateIndex: entry.plateIndex,
			repeatCount: Math.max(1, Math.floor(entry.repeatCount) || 1)
		}))
	};
}

export async function clearSession(): Promise<void> {
	if (typeof indexedDB === 'undefined') return;
	const db = await openDatabase();
	try {
		const tx = db.transaction(['files', 'session'], 'readwrite');
		tx.objectStore('files').clear();
		tx.objectStore('session').delete(SESSION_KEY);
		await transactionDone(tx);
	} finally {
		db.close();
	}
}

/** Rebuild the queue from stored plate files. Skips entries whose file can no longer be read. */
export async function restoreQueue(
	session: StoredSession,
	files: StoredFile[]
): Promise<QueueEntry[]> {
	const byId = new Map(files.map((file) => [file.id, file]));
	const opened = new Map<string, Awaited<ReturnType<typeof ingest3mfFile>>>();
	const entries: QueueEntry[] = [];

	for (const saved of session.entries) {
		let processed = opened.get(saved.fileId);
		if (!processed) {
			const stored = byId.get(saved.fileId);
			if (!stored) continue;
			try {
				processed = await ingest3mfFile(
					new File([stored.bytes], stored.name, { type: 'application/zip' })
				);
			} catch {
				continue;
			}
			opened.set(saved.fileId, processed);
		}

		const plate = processed.plateDetails[saved.plateIndex];
		if (!plate) continue;
		plate.repeatCount = Math.max(1, Math.floor(saved.repeatCount) || 1);
		entries.push({
			entryId: saved.entryId,
			fileKey: saved.fileId,
			fileName: processed.fileName,
			zip: processed.file,
			plate,
			plateLabel: `Plate ${saved.plateIndex + 1}`,
			plateIndex: saved.plateIndex
		});
	}

	return entries;
}
