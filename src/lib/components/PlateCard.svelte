<script lang="ts">
	import { formatDuration } from '#lib/printflow/time.js';
	import type { QueueEntry } from '#lib/printflow/types.js';

	let {
		position,
		entry,
		canMoveUp = false,
		canMoveDown = false,
		onRemove,
		onMoveUp,
		onMoveDown,
		onRepeatChange
	}: {
		position: number;
		entry: QueueEntry;
		canMoveUp?: boolean;
		canMoveDown?: boolean;
		onRemove: () => void;
		onMoveUp: () => void;
		onMoveDown: () => void;
		onRepeatChange?: () => void;
	} = $props();

	const fileNameParts = $derived(entry.fileName.split(/(?<=[.\-_ ])/));

	const repeatTotal = $derived(
		entry.plate.repeatCount > 1 && entry.plate.totalSeconds > 0
			? formatDuration(entry.plate.totalSeconds * entry.plate.repeatCount)
			: ''
	);

	function decrementRepeat() {
		entry.plate.repeatCount = Math.max(1, entry.plate.repeatCount - 1);
		onRepeatChange?.();
	}

	function incrementRepeat() {
		entry.plate.repeatCount += 1;
		onRepeatChange?.();
	}
</script>

<article
	class="plate-card group rounded-2xl border border-line bg-surface p-3 shadow-card transition-[border-color,box-shadow] duration-200 hover:border-line-strong hover:shadow-raised sm:p-4"
>
	<div
		class="rail flex items-center gap-0.5 self-start rounded-full border border-line bg-surface-2 p-1 sm:flex-col"
		role="group"
		aria-label="Queue position {position}"
	>
		<button
			type="button"
			class="stepper-btn"
			disabled={!canMoveUp}
			aria-label="Move plate up"
			onclick={onMoveUp}
		>
			<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2.25"
					d="M6 15l6-6 6 6"
				/>
			</svg>
		</button>
		<span
			class="inline-flex size-8 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-surface tabular-nums"
			aria-hidden="true"
		>
			{position}
		</span>
		<button
			type="button"
			class="stepper-btn"
			disabled={!canMoveDown}
			aria-label="Move plate down"
			onclick={onMoveDown}
		>
			<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.25" d="M6 9l6 6 6-6" />
			</svg>
		</button>
	</div>

	<div class="thumb pei relative size-24 shrink-0 overflow-hidden rounded-xl sm:size-32">
		{#if entry.plate.thumbnailBlobUrl}
			<img
				class="size-full object-contain p-2 drop-shadow-[0_3px_4px_rgb(0_0_0/0.22)] transition-transform duration-300 motion-safe:group-hover:scale-[1.04]"
				src={entry.plate.thumbnailBlobUrl}
				alt="Preview of {entry.plateLabel}"
			/>
		{:else}
			<div
				class="flex size-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-ink-3"
			>
				<svg
					class="size-6 opacity-70"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.75"
						d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zm0 0v18m8-13.5L12 12 4 7.5"
					/>
				</svg>
				No preview
			</div>
		{/if}
	</div>

	<div class="info min-w-0 self-center">
		<h3
			class="text-[15px] leading-snug font-semibold break-words text-ink sm:text-base"
			title={entry.fileName}
		>
			{#each fileNameParts as part, index (index)}{part}<wbr />{/each}
		</h3>
		<div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-3">
			<span class="inline-flex items-center gap-1.5 font-medium text-ink-2">
				<svg
					class="size-3.5 text-brand-ink"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 4l9 5-9 5-9-5 9-5zm-9 9l9 5 9-5"
					/>
				</svg>
				{entry.plateLabel}
			</span>
			<span class="inline-flex items-center gap-1.5 tabular-nums">
				<svg
					class="size-3.5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					aria-hidden="true"
				>
					<circle cx="12" cy="12" r="8.5" stroke-width="2" />
					<path stroke-linecap="round" stroke-width="2" d="M12 7.5V12l3 2" />
				</svg>
				{entry.plate.timeString || '—'}
			</span>
			{#if repeatTotal}
				<span class="tabular-nums">
					×{entry.plate.repeatCount} = <span class="font-medium text-ink-2">{repeatTotal}</span>
				</span>
			{/if}
		</div>

		{#if entry.plate.filaments.length > 0}
			<ul class="mt-3 flex flex-wrap gap-1.5" aria-label="Filaments">
				{#each entry.plate.filaments as filament (filament.id)}
					<li
						class="inline-flex h-7 items-center gap-2 rounded-full border border-line bg-surface-2 pr-2.5 pl-1 text-xs"
						title="Slot {filament.id}"
					>
						<span
							class="size-5 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15),inset_0_2px_3px_rgb(255_255_255/0.35)]"
							style:background-color={filament.color}
						></span>
						<span class="font-semibold text-ink">{filament.type}</span>
						<span class="text-ink-3 tabular-nums">{filament.used_g} g</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div
		class="side flex items-center justify-end gap-2 sm:flex-col sm:items-end sm:justify-between sm:self-stretch"
	>
		<button
			type="button"
			class="icon-btn hover:text-danger max-sm:order-last"
			aria-label="Remove plate"
			onclick={onRemove}
		>
			<svg
				class="size-[18px]"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				aria-hidden="true"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1.9"
					d="M4.5 7h15M10 11v6m4-6v6M6.5 7l.8 11.2A2 2 0 009.3 20h5.4a2 2 0 002-1.8L17.5 7M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2"
				/>
			</svg>
		</button>

		<div class="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-1">
			<span class="eyebrow hidden sm:inline" aria-hidden="true">Repeat</span>
			<div class="stepper" role="group" aria-label="Repeat count">
				<button
					type="button"
					class="stepper-btn"
					onclick={decrementRepeat}
					disabled={entry.plate.repeatCount <= 1}
					aria-label="Decrease repeat count"
				>
					<svg
						class="size-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						aria-hidden="true"
					>
						<path stroke-linecap="round" stroke-width="2.25" d="M6 12h12" />
					</svg>
				</button>
				<span class="stepper-value" aria-live="polite">
					<span class="text-ink-3">×</span>{entry.plate.repeatCount}
				</span>
				<button
					type="button"
					class="stepper-btn"
					onclick={incrementRepeat}
					aria-label="Increase repeat count"
				>
					<svg
						class="size-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						aria-hidden="true"
					>
						<path stroke-linecap="round" stroke-width="2.25" d="M12 6v12M6 12h12" />
					</svg>
				</button>
			</div>
		</div>
	</div>
</article>

<style>
	.plate-card {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		grid-template-areas:
			'thumb info info'
			'rail side side';
		column-gap: 0.875rem;
		row-gap: 0.75rem;
	}

	.rail {
		grid-area: rail;
	}

	.thumb {
		grid-area: thumb;
	}

	.info {
		grid-area: info;
	}

	.side {
		grid-area: side;
	}

	@media (min-width: 40rem) {
		.plate-card {
			grid-template-columns: auto auto minmax(0, 1fr) auto;
			grid-template-areas: 'rail thumb info side';
			column-gap: 1rem;
		}
	}
</style>
