<script lang="ts">
	let {
		variant = 'hero',
		disabled = false,
		onFiles
	}: {
		variant?: 'hero' | 'compact';
		disabled?: boolean;
		onFiles: (files: FileList | File[]) => void | Promise<void>;
	} = $props();

	let inputEl: HTMLInputElement | undefined = $state();
	let dragDepth = $state(0);

	const hero = $derived(variant === 'hero');
	const dragging = $derived(dragDepth > 0 && !disabled);

	async function handleFiles(fileList: FileList | null) {
		if (!fileList || fileList.length === 0 || disabled) {
			return;
		}
		await onFiles(fileList);
		if (inputEl) {
			inputEl.value = '';
		}
	}
</script>

<div
	role="region"
	aria-label="Upload 3MF files"
	class="group relative cursor-pointer border-2 border-dashed transition-[border-color,background-color,box-shadow] duration-200 has-[:focus-visible]:border-brand has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand/25 {hero
		? 'rounded-3xl'
		: 'rounded-2xl'} {dragging
		? 'border-brand bg-brand-soft shadow-[0_0_0_6px_var(--brand-soft)]'
		: hero
			? 'border-line-strong bg-surface hover:border-brand hover:bg-brand-soft/60'
			: 'border-line-strong bg-surface/60 hover:border-brand hover:bg-brand-soft/60'}"
	class:opacity-50={disabled}
	class:pointer-events-none={disabled}
	ondragenter={(event) => {
		event.preventDefault();
		dragDepth += 1;
	}}
	ondragleave={() => {
		dragDepth = Math.max(0, dragDepth - 1);
	}}
	ondragover={(event) => event.preventDefault()}
	ondrop={(event) => {
		event.preventDefault();
		dragDepth = 0;
		void handleFiles(event.dataTransfer?.files ?? null);
	}}
>
	<label
		class="flex w-full cursor-pointer {hero
			? 'flex-col items-center gap-1 px-6 py-10 text-center sm:py-14'
			: 'items-center gap-3.5 px-4 py-3.5'}"
	>
		<input
			bind:this={inputEl}
			data-testid="file-input"
			type="file"
			accept=".3mf"
			multiple
			class="sr-only"
			{disabled}
			onchange={(event) => handleFiles(event.currentTarget.files)}
		/>

		{#if hero}
			<svg
				class="mb-5 h-32 w-auto transition-transform duration-300 motion-safe:group-hover:-translate-y-1 {dragging
					? 'motion-safe:-translate-y-1.5'
					: ''}"
				viewBox="0 0 200 140"
				fill="none"
				aria-hidden="true"
			>
				<ellipse cx="100" cy="128" rx="58" ry="8" class="fill-ink/6" />
				<g class="fill-surface-3 stroke-line-strong" stroke-width="1.25" stroke-linejoin="round">
					<path d="M50 102 L100 124 L150 102 L150 107 L100 129 L50 107 Z" />
					<path d="M100 80 L150 102 L100 124 L50 102 Z" />
					<path d="M50 86 L100 108 L150 86 L150 91 L100 113 L50 91 Z" />
					<path d="M100 64 L150 86 L100 108 L50 86 Z" />
				</g>
				<g stroke-width="1.25" stroke-linejoin="round" style="stroke: var(--pei-edge)">
					<path
						d="M50 70 L100 92 L150 70 L150 75 L100 97 L50 75 Z"
						style="fill: var(--pei-base); filter: brightness(0.82)"
					/>
					<path d="M100 48 L150 70 L100 92 L50 70 Z" style="fill: var(--pei-base)" />
				</g>
				<g stroke-linejoin="round">
					<path d="M100 53 L116 61 L100 69 L84 61 Z" class="fill-brand" />
					<path
						d="M84 61 L100 69 L100 80 L84 72 Z"
						class="fill-brand"
						style="filter: brightness(0.8)"
					/>
					<path
						d="M100 69 L116 61 L116 72 L100 80 Z"
						class="fill-brand"
						style="filter: brightness(0.65)"
					/>
				</g>
				<path
					d="M160 72 C178 80 178 100 160 108"
					class="stroke-brand"
					stroke-width="3"
					stroke-linecap="round"
				/>
				<path
					d="M167 109 L159 108.5 L162 101"
					class="stroke-brand"
					stroke-width="3"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
				<path
					d="M100 8 V36 M90 27 L100 37 L110 27"
					class="stroke-brand transition-transform duration-300 motion-safe:group-hover:translate-y-1"
					stroke-width="3.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
			<p class="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
				{dragging ? 'Release to add plates' : 'Drop your sliced files here'}
			</p>
			<p class="text-sm text-ink-3 sm:text-[15px]">
				Bambu Studio <span class="font-mono text-[0.92em] text-ink-2">.gcode.3mf</span>, one or many
			</p>
			<span
				class="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-surface shadow-card transition-transform duration-150 group-hover:shadow-raised motion-safe:group-active:scale-[0.98]"
			>
				<svg
					class="size-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2.1"
						d="M3.5 7.5A2 2 0 015.5 5.5h4l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2h-13a2 2 0 01-2-2v-10z"
					/>
				</svg>
				Browse files
			</span>
			<p class="mt-4 inline-flex items-center gap-1.5 text-xs text-ink-3">
				<svg
					class="size-3.5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					aria-hidden="true"
				>
					<rect x="5" y="11" width="14" height="9" rx="2" stroke-width="2" />
					<path stroke-linecap="round" stroke-width="2" d="M8 11V8a4 4 0 018 0v3" />
				</svg>
				Files never leave this browser
			</p>
		{:else}
			<span
				class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 {dragging
					? 'bg-primary text-on-primary'
					: 'bg-brand-soft text-brand-ink group-hover:bg-primary group-hover:text-on-primary'}"
			>
				<svg
					class="size-5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					aria-hidden="true"
				>
					<path stroke-linecap="round" stroke-width="2.25" d="M12 5v14M5 12h14" />
				</svg>
			</span>
			<span class="min-w-0">
				<span class="block text-sm font-semibold text-ink">
					{dragging ? 'Release to add plates' : 'Add more sliced files'}
				</span>
				<span class="block text-xs text-ink-3">Drop here or click to browse</span>
			</span>
		{/if}
	</label>
</div>
