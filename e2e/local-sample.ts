import { existsSync } from 'node:fs';

const SAMPLE_ENV = 'PRINTSWAP_SAMPLE_3MF';

function configuredSamplePath(): string {
	const existing = process.env[SAMPLE_ENV]?.trim();
	if (existing) return existing;
	if (existsSync('.env')) process.loadEnvFile('.env');
	return process.env[SAMPLE_ENV]?.trim() ?? '';
}

/** Optional local sliced plate for manual tests. Empty when unset or missing. */
export function localSample3mfPath(): string {
	const path = configuredSamplePath();
	if (!path || !existsSync(path)) return '';
	return path;
}
