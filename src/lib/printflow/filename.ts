/** Remove trailing `.gcode.3mf` / `.3mf` pairs, including a suffix appended twice. */
export function strip3mfBaseName(fileName: string): string {
	let stem = fileName;
	let progress = true;
	while (progress) {
		progress = false;
		if (/\.gcode\.3mf$/i.test(stem)) {
			stem = stem.slice(0, -'.gcode.3mf'.length);
			progress = true;
		} else if (/\.3mf$/i.test(stem)) {
			stem = stem.slice(0, -'.3mf'.length);
			progress = true;
		}
	}
	return stem;
}

export function swapOutputFileName(firstFileName: string): string {
	return `${strip3mfBaseName(firstFileName)}.swap.3mf`;
}

function sanitizeFileName(value: string): string {
	let cleaned = '';
	for (const char of value) {
		const code = char.codePointAt(0) ?? 0;
		if (code <= 0x1f || '\\/:*?"<>|'.includes(char)) continue;
		cleaned += char;
	}
	return cleaned.replace(/\s+/g, ' ').trim();
}

/** Keep a user-edited download name, and make sure it is a .3mf file. */
export function normalizeOutputFileName(name: string, fallback: string): string {
	const cleaned = sanitizeFileName(name);
	const base = cleaned || sanitizeFileName(fallback) || 'print.swap.3mf';
	if (/^\.3mf$/i.test(base)) return 'print.swap.3mf';
	if (/\.3mf$/i.test(base)) return base;
	return `${base}.3mf`;
}
