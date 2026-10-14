import { M620_SEARCH } from '#lib/constants/swap-gcode.js';

/** Comment out the `M` at position `index` (Printflow Gi). */
export function commentOutM620Line(gcode: string, index: number): string {
	if (index > gcode.length - 1) {
		return gcode;
	}
	return gcode.substring(0, index) + ';' + gcode.substring(index + 1);
}

/** Replace an AMS unload block with a padded SWAP comment (Printflow Wi). */
export function replaceAmsBlockWithSwapComment(gcode: string, index: number): string {
	if (index > gcode.length - 1) {
		return gcode;
	}
	const segmentLength = gcode.substring(index).search(/\n[^\s]/);
	if (segmentLength === -1) {
		return gcode;
	}
	let comment = ';SWAP - AMS block removed';
	while (comment.length < segmentLength - 1) {
		comment += '/';
	}
	comment += '\n';
	return gcode.substring(0, index) + comment + gcode.substring(index + segmentLength);
}

export function stripAmsUnloadBlocks(gcodeParts: string[]): string[] {
	const parts = [...gcodeParts];
	const positions: number[] = [];
	const partIndexes: number[] = [];
	const slots: string[] = [];

	for (let partIndex = 0; partIndex < parts.length; partIndex++) {
		let found = parts[partIndex].indexOf(M620_SEARCH);
		while (found !== -1) {
			positions.push(found + 1);
			partIndexes.push(partIndex);
			let slot = parts[partIndex].substring(found + 7, found + 10);
			if (slot[2] === '\n' || slot[2] === ' ') {
				slot = slot.substring(0, 2);
			}
			slots.push(slot);
			found = parts[partIndex].indexOf(M620_SEARCH, found + 1);
		}
	}

	for (let i = 0; i < slots.length - 1; i++) {
		if (slots[i] === '255' && slots[i - 1] === slots[i + 1]) {
			const unloadPart = partIndexes[i];
			const loadPart = partIndexes[i + 1];
			parts[unloadPart] = commentOutM620Line(parts[unloadPart], positions[i]);
			parts[loadPart] = replaceAmsBlockWithSwapComment(parts[loadPart], positions[i + 1]);
		}
	}

	return parts;
}
