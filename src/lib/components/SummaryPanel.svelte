<script lang="ts">
	import { formatDuration } from '#lib/printflow/time.js';
	import type { QueueStats, SlotStat } from '#lib/printflow/types.js';

	let {
		stats,
		slots,
		loops = $bindable(1),
		outputFileName = $bindable(''),
		disabledGenerate = false,
		exporting = false,
		exportProgress = 0,
		onOutputNameEdit,
		onOutputNameCommit,
		onReset,
		onGenerate
	}: {
		stats: QueueStats;
		slots: SlotStat[];
		loops?: number;
		outputFileName?: string;
		disabledGenerate?: boolean;
		exporting?: boolean;
		exportProgress?: number;
		onOutputNameEdit?: () => void;
		onOutputNameCommit?: () => void;
		onReset: () => void;
		onGenerate: () => void;
	} = $props();

	const durationParts = $derived(
		formatDuration(stats.totalSeconds)
			.split(' ')
			.map((part) => {
				const match = /^(\d+)(\D+)$/.exec(part);
				return match ? { value: match[1], unit: match[2] } : { value: part, unit: '' };
			})
	);

	const progress = $derived(Math.min(100, Math.max(0, Math.round(exportProgress))));

	function slotShare(slot: SlotStat): number {
		return stats.totalMaterialGrams > 0 ? (slot.grams / stats.totalMaterialGrams) * 100 : 0;
	}

	function decrementLoops() {
		loops = Math.max(1, loops - 1);
	}

	function incrementLoops() {
		loops += 1;
	}
</script>

<aside
	class="overflow-hidden rounded-3xl border border-line bg-surface shadow-raised lg:sticky lg:top-24"
	aria-label="Print job"
>
	<div class="p-5 sm:p-6">
		<div class="flex items-center justify-between gap-3">
			<h2 class="text-[15px] font-semibold text-ink">Print job</h2>
			<span
				class="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-ink"
			>
				<span class="relative flex size-2">
					{#if exporting}
						<span
							class="absolute inline-flex size-full rounded-full bg-brand opacity-60 motion-safe:animate-ping"
						></span>
					{/if}
					<span class="relative inline-flex size-2 rounded-full bg-brand"></span>
				</span>
				{exporting ? 'Building' : 'Ready'}
			</span>
		</div>

		<div class="mt-4 w-full rounded-2xl border border-brand-line bg-brand-soft px-4 py-3">
			<div class="flex items-center justify-between gap-4">
				<label for="loops-input" class="text-sm font-semibold text-ink">Loops</label>
				<div class="stepper shrink-0 bg-surface" role="group" aria-label="Loop count">
					<button
						type="button"
						class="stepper-btn"
						disabled={loops <= 1 || exporting}
						aria-label="Decrease loops"
						onclick={decrementLoops}
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
					<input
						id="loops-input"
						data-testid="loops-input"
						type="number"
						min="1"
						class="stepper-value no-spinner w-12 rounded-md focus-visible:outline-offset-0"
						bind:value={loops}
						disabled={exporting}
						aria-describedby="loops-help"
					/>
					<button
						type="button"
						class="stepper-btn"
						disabled={exporting}
						aria-label="Increase loops"
						onclick={incrementLoops}
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
			<p id="loops-help" class="mt-1 text-xs text-ink-3">Run the whole queue again</p>
		</div>

		<p class="eyebrow mt-5">Total print time</p>
		<p
			class="mt-1.5 text-[40px] leading-none font-bold tracking-tight text-ink tabular-nums sm:text-[44px]"
		>
			{#each durationParts as part, index (index)}
				<span class={index > 0 ? 'ml-[0.22em]' : ''}
					>{part.value}<span class="ml-0.5 text-[0.5em] font-semibold tracking-normal text-ink-3"
						>{part.unit}</span
					></span
				>
			{/each}
		</p>

		<dl class="mt-5 grid grid-cols-2 gap-2">
			<div class="rounded-2xl bg-surface-2 px-4 py-3">
				<dt class="eyebrow">Plates</dt>
				<dd class="mt-1 text-2xl font-bold text-ink tabular-nums">{stats.totalPlates}</dd>
			</div>
			<div class="rounded-2xl bg-surface-2 px-4 py-3">
				<dt class="eyebrow">Material</dt>
				<dd class="mt-1 text-2xl font-bold text-ink tabular-nums">
					{stats.totalMaterialGrams.toFixed(2)}<span class="ml-1 text-sm font-semibold text-ink-3"
						>g</span
					>
				</dd>
			</div>
		</dl>
	</div>

	{#if slots.length > 0}
		<section class="border-t border-line px-5 py-4 sm:px-6" aria-labelledby="filament-heading">
			<div class="flex items-baseline justify-between">
				<h3 id="filament-heading" class="eyebrow">Filament</h3>
				<span class="text-xs text-ink-3"
					>{slots.length} {slots.length === 1 ? 'slot' : 'slots'}</span
				>
			</div>
			<ul class="mt-3 space-y-3">
				{#each slots as slot (slot.slot)}
					{@const colors = [...slot.colors]}
					<li>
						<div class="flex items-center gap-2.5 text-sm">
							<span class="flex -space-x-1.5">
								{#each colors as color (color)}
									<span
										class="size-4 rounded-full ring-2 ring-surface shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)]"
										style:background-color={color}
									></span>
								{/each}
							</span>
							<span class="font-semibold text-ink">Slot {slot.slot}</span>
							<span class="ml-auto text-ink-3 tabular-nums">{slot.meters.toFixed(2)} m</span>
							<span class="w-20 text-right font-semibold text-ink tabular-nums"
								>{slot.grams.toFixed(2)} g</span
							>
						</div>
						<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
							<div
								class="h-full rounded-full transition-[width] duration-500"
								style:width="{slotShare(slot)}%"
								style:background-color={colors[0] ?? 'var(--brand)'}
							></div>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<div class="space-y-3 border-t border-line bg-surface-2 px-5 py-5 sm:px-6">
		<div>
			<label for="output-filename" class="eyebrow">Output file</label>
			<input
				id="output-filename"
				data-testid="output-filename"
				type="text"
				spellcheck="false"
				autocomplete="off"
				class="mt-1.5 w-full overflow-x-auto rounded-xl border border-line bg-surface px-3 py-2.5 font-mono text-[13px] whitespace-nowrap text-ink disabled:cursor-not-allowed disabled:opacity-50"
				bind:value={outputFileName}
				disabled={exporting}
				oninput={() => onOutputNameEdit?.()}
				onblur={() => onOutputNameCommit?.()}
			/>
		</div>

		<button
			type="button"
			data-testid="generate-button"
			class="relative inline-flex h-14 w-full items-center justify-center overflow-hidden rounded-2xl bg-primary px-5 text-base font-semibold text-on-primary shadow-primary transition-[background-color,transform] duration-150 hover:bg-primary-hover active:bg-primary-active motion-safe:active:scale-[0.985] disabled:cursor-not-allowed"
			class:opacity-50={disabledGenerate}
			disabled={disabledGenerate || exporting}
			aria-busy={exporting}
			onclick={onGenerate}
		>
			{#if exporting}
				<span
					class="absolute inset-y-0 left-0 bg-on-primary/20 transition-[width] duration-300 ease-out"
					style:width="{progress}%"
					aria-hidden="true"
				></span>
			{/if}
			<span class="relative inline-flex items-center gap-2.5">
				{#if exporting}
					<svg
						class="size-5 motion-safe:animate-spin"
						viewBox="0 0 24 24"
						fill="none"
						aria-hidden="true"
					>
						<circle
							cx="12"
							cy="12"
							r="9"
							stroke="currentColor"
							stroke-opacity="0.3"
							stroke-width="2.5"
						/>
						<path
							d="M21 12a9 9 0 00-9-9"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
						/>
					</svg>
					<span>Building file… <span class="tabular-nums">{progress}%</span></span>
				{:else}
					<svg
						class="size-5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2.1"
							d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19h14"
						/>
					</svg>
					<span>Generate .swap.3mf</span>
				{/if}
			</span>
		</button>

		<button
			type="button"
			class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium text-ink-3 transition-colors hover:bg-surface-3 hover:text-danger disabled:pointer-events-none disabled:opacity-40"
			disabled={exporting}
			onclick={onReset}
		>
			<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5"
				/>
			</svg>
			Clear queue
		</button>
	</div>
</aside>
