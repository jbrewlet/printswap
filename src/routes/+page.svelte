<script lang="ts">
	import DropZone from '#lib/components/DropZone.svelte';
	import PlateCard from '#lib/components/PlateCard.svelte';
	import SummaryPanel from '#lib/components/SummaryPanel.svelte';
	import { flowOutputFileName, normalizeOutputFileName } from '#lib/printflow/filename.js';
	import { runExportInWorker } from '#lib/printflow/export-worker.js';
	import { IngestError, ingest3mfFile } from '#lib/printflow/ingest.js';
	import {
		entriesFromProcessedFile,
		moveQueueEntry,
		removeQueueEntry,
		revokeQueueThumbnails
	} from '#lib/printflow/queue.js';
	import { computeQueueStats, computeSlotStats } from '#lib/printflow/stats.js';
	import type { QueueEntry } from '#lib/printflow/types.js';

	let queue = $state<QueueEntry[]>([]);
	let loops = $state(1);
	let outputFileName = $state('');
	let outputNameEdited = $state(false);
	let exporting = $state(false);
	let exportProgress = $state(0);
	let errorMessage = $state('');

	const slotStats = $derived(computeSlotStats(queue, Math.max(1, loops)));
	const queueStats = $derived(computeQueueStats(queue, Math.max(1, loops), slotStats));
	const suggestedOutputFileName = $derived(
		queue.length > 0 ? flowOutputFileName(queue[0].fileName) : ''
	);
	const hasQueue = $derived(queue.length > 0);

	$effect(() => {
		if (queue.length === 0) {
			outputFileName = '';
			outputNameEdited = false;
			return;
		}
		if (!outputNameEdited) {
			outputFileName = suggestedOutputFileName;
		}
	});

	const steps = [
		{ title: 'Slice in Bambu Studio', body: 'Export each plate as a sliced .gcode.3mf.' },
		{ title: 'Drop it here', body: 'Set repeats per plate and loops for the queue.' },
		{ title: 'Generate & print', body: 'Open the .flow.3mf in Bambu Studio and send it.' }
	];

	async function addFiles(files: FileList | File[]) {
		errorMessage = '';
		for (const file of files) {
			try {
				const processed = await ingest3mfFile(file);
				queue = [...queue, ...entriesFromProcessedFile(processed)];
			} catch (error) {
				errorMessage = error instanceof IngestError ? error.message : 'Failed to read file.';
			}
		}
	}

	function resetQueue() {
		if (queue.length === 0) {
			return;
		}
		if (!globalThis.confirm('Clear the entire plate queue?')) {
			return;
		}
		revokeQueueThumbnails(queue);
		queue = [];
		loops = 1;
		outputFileName = '';
		outputNameEdited = false;
		errorMessage = '';
	}

	function markOutputNameEdited() {
		outputNameEdited = true;
	}

	function commitOutputFileName(): string {
		const suggestion = suggestedOutputFileName || 'print.flow.3mf';
		const normalized = normalizeOutputFileName(outputFileName, suggestion);
		outputFileName = normalized;
		outputNameEdited = normalized !== suggestion;
		return normalized;
	}

	function dismissError() {
		errorMessage = '';
	}

	async function generateFlow() {
		if (queue.length === 0 || exporting) {
			return;
		}
		exporting = true;
		exportProgress = 0;
		errorMessage = '';

		try {
			const loopCount = Math.max(1, Math.floor(loops));
			const fileName = commitOutputFileName();
			const blob = await runExportInWorker(queue, loopCount, (percent) => {
				exportProgress = percent;
			});

			const url = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = fileName;
			document.body.appendChild(anchor);
			anchor.click();
			document.body.removeChild(anchor);
			URL.revokeObjectURL(url);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Export failed.';
		} finally {
			exporting = false;
			exportProgress = 0;
		}
	}
</script>

<div class="page-glow flex min-h-screen flex-col">
	<header class="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur-md">
		<div class="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
			<svg class="size-9 shrink-0" viewBox="0 0 32 32" aria-hidden="true">
				<rect width="32" height="32" rx="9" class="fill-primary" />
				<path d="M16 6.5l9 4.6-9 4.6-9-4.6 9-4.6z" class="fill-on-primary" />
				<path
					d="M7 15.6l9 4.6 9-4.6M7 20.1l9 4.6 9-4.6"
					fill="none"
					class="stroke-on-primary"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-opacity="0.7"
				/>
			</svg>
			<div class="min-w-0">
				<h1 class="text-[17px] leading-tight font-bold tracking-tight text-ink">Printflow</h1>
				<p class="truncate text-xs text-ink-3">Plate-swap queues for Bambu Lab A1</p>
			</div>
			<span
				class="ml-auto hidden items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-2 sm:inline-flex"
			>
				<span class="size-1.5 rounded-full bg-brand"></span>
				Runs locally
			</span>
		</div>
	</header>

	<main class="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
		{#if errorMessage}
			<div
				class="mb-5 flex items-start gap-3 rounded-2xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-ink"
				role="alert"
			>
				<svg
					class="mt-0.5 size-5 shrink-0 text-danger"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					aria-hidden="true"
				>
					<circle cx="12" cy="12" r="9" stroke-width="2" />
					<path stroke-linecap="round" stroke-width="2.25" d="M12 7.5v5.5m0 3.2v.1" />
				</svg>
				<div class="min-w-0 flex-1">
					<p class="font-semibold">Something went wrong</p>
					<p class="mt-0.5 break-words text-ink-2">{errorMessage}</p>
				</div>
				<button
					type="button"
					class="shrink-0 rounded-lg px-2 py-1 font-semibold text-danger hover:bg-danger-soft"
					onclick={dismissError}
				>
					Dismiss
				</button>
			</div>
		{/if}

		{#if !hasQueue}
			<section class="mx-auto max-w-3xl pt-4 text-center sm:pt-10">
				<span
					class="inline-flex items-center gap-2 rounded-full border border-brand-line bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-ink"
				>
					<span class="size-1.5 rounded-full bg-brand"></span>
					A1 + mechanical plate changer
				</span>
				<h2
					class="mt-4 text-[32px] leading-[1.1] font-bold tracking-tight text-balance text-ink sm:text-5xl"
				>
					Stack the queue. <span class="text-brand-ink">Keep printing.</span>
				</h2>
				<p class="mx-auto mt-4 max-w-xl text-base text-pretty text-ink-2 sm:text-lg">
					Merge sliced plates into one job with a plate swap after every print, so your A1 runs
					back-to-back without you.
				</p>

				<div class="mt-8 sm:mt-10">
					<DropZone variant="hero" disabled={exporting} onFiles={addFiles} />
				</div>

				<ol class="mt-6 grid gap-3 text-left sm:grid-cols-3" aria-label="How it works">
					{#each steps as step, index (step.title)}
						<li class="flex gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
							<span
								class="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-ink tabular-nums"
							>
								{index + 1}
							</span>
							<div class="min-w-0">
								<p class="text-sm font-semibold text-ink">{step.title}</p>
								<p class="mt-0.5 text-[13px] leading-snug text-ink-3">{step.body}</p>
							</div>
						</li>
					{/each}
				</ol>
			</section>
		{:else}
			<div class="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">
				<section class="min-w-0 space-y-3" aria-labelledby="queue-heading">
					<div class="pb-1">
						<div class="flex items-center gap-2.5">
							<h2 id="queue-heading" class="text-xl font-bold tracking-tight text-ink">
								Plate queue
							</h2>
							<span
								class="rounded-full bg-surface-3 px-2.5 py-0.5 text-xs font-semibold text-ink-2 tabular-nums"
							>
								{queue.length}
								{queue.length === 1 ? 'item' : 'items'}
							</span>
						</div>
						<p class="mt-0.5 text-[13px] text-ink-3">
							Prints top to bottom, with a plate swap after each one.
						</p>
					</div>
					<ul class="space-y-3" aria-label="Plate queue">
						{#each queue as entry, index (entry.entryId)}
							<li>
								<PlateCard
									position={index + 1}
									{entry}
									canMoveUp={index > 0}
									canMoveDown={index < queue.length - 1}
									onRemove={() => {
										queue = removeQueueEntry(queue, entry.entryId);
									}}
									onMoveUp={() => {
										queue = moveQueueEntry(queue, entry.entryId, -1);
									}}
									onMoveDown={() => {
										queue = moveQueueEntry(queue, entry.entryId, 1);
									}}
								/>
							</li>
						{/each}
					</ul>
					<DropZone variant="compact" disabled={exporting} onFiles={addFiles} />
				</section>

				<div class="mt-8 lg:mt-0">
					<SummaryPanel
						stats={queueStats}
						slots={slotStats}
						bind:loops
						bind:outputFileName
						onOutputNameEdit={markOutputNameEdited}
						onOutputNameCommit={commitOutputFileName}
						disabledGenerate={!hasQueue}
						{exporting}
						{exportProgress}
						onReset={resetQueue}
						onGenerate={generateFlow}
					/>
				</div>
			</div>
		{/if}
	</main>
</div>
