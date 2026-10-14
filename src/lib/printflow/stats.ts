import type { QueueEntry, QueueStats, SlotStat } from './types.js';

export function computeSlotStats(queue: QueueEntry[], loopCount: number): SlotStat[] {
	const bySlot = new Map<string, { meters: number; grams: number; colors: Set<string> }>();

	for (const entry of queue) {
		const repeat = entry.plate.repeatCount;
		for (const filament of entry.plate.filaments) {
			const slot = filament.id;
			if (!bySlot.has(slot)) {
				bySlot.set(slot, { meters: 0, grams: 0, colors: new Set() });
			}
			const values = bySlot.get(slot)!;
			values.meters += repeat * (parseFloat(filament.used_m) || 0);
			values.grams += repeat * (parseFloat(filament.used_g) || 0);
			values.colors.add(filament.color);
		}
	}

	return [...bySlot.entries()]
		.sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
		.map(([slot, values]) => ({
			slot,
			meters: values.meters * loopCount,
			grams: values.grams * loopCount,
			colors: values.colors
		}));
}

export function computeQueueStats(
	queue: QueueEntry[],
	loopCount: number,
	slotStats: SlotStat[]
): QueueStats {
	let totalPlates = 0;
	let totalSeconds = 0;

	for (const entry of queue) {
		totalPlates += entry.plate.repeatCount;
		totalSeconds += entry.plate.repeatCount * entry.plate.totalSeconds;
	}

	return {
		totalPlates: totalPlates * loopCount,
		totalSeconds: totalSeconds * loopCount,
		totalMaterialGrams: slotStats.reduce((sum, slot) => sum + slot.grams, 0)
	};
}
