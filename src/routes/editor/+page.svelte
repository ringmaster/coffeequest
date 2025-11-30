<script lang="ts">
	import { editorStore, isPatchStep, getPatchTarget } from '$lib/stores/editorState.svelte';
	import StepEditor from '$lib/components/editor/StepEditor.svelte';
	import CoverageMatrix from '$lib/components/editor/CoverageMatrix.svelte';
	import LintPanel from '$lib/components/editor/LintPanel.svelte';
	import type { PageData } from './$types';
	import type { QuestFile } from '$lib/types/editor';

	let { data }: { data: PageData } = $props();

	// Initialize store with server data
	$effect(() => {
		editorStore.setFileList(data.files);
		editorStore.loadContext(data.locations, data.config);
	});

	let selectedFile = $state<string>('');
	let loading = $state(false);
	let errorMessage = $state<string | null>(null);
	let stepFilter = $state('');

	// All steps with their indices, filtered by search
	let filteredSteps = $derived.by(() => {
		if (!editorStore.questFile) return [];
		const filter = stepFilter.toLowerCase();
		return editorStore.questFile.steps
			.map((step, index) => ({ step, index }))
			.filter(({ step }) => !filter || step.id.toLowerCase().includes(filter));
	});

	async function loadFile(filename: string) {
		if (!filename) return;
		loading = true;
		errorMessage = null;

		try {
			const response = await fetch(`/editor/api/file/${encodeURIComponent(filename)}`);
			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.message || 'Failed to load file');
			}
			const { name, content } = await response.json();
			editorStore.loadFile(name, content as QuestFile);
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Failed to load file';
		} finally {
			loading = false;
		}
	}

	async function saveFile() {
		if (!editorStore.questFile || !editorStore.fileName) return;
		loading = true;
		errorMessage = null;

		try {
			const response = await fetch(`/editor/api/file/${encodeURIComponent(editorStore.fileName)}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(editorStore.questFile)
			});
			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.message || 'Failed to save file');
			}
			const result = await response.json();
			// Update filename if it changed (e.g., json -> yaml)
			if (result.name && result.name !== editorStore.fileName) {
				editorStore.fileName = result.name;
			}
			editorStore.markClean();
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Failed to save file';
		} finally {
			loading = false;
		}
	}

	function handleFileSelect(e: Event) {
		const select = e.target as HTMLSelectElement;
		selectedFile = select.value;
		if (selectedFile) {
			loadFile(selectedFile);
		}
	}

	// Keyboard shortcut for save
	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 's') {
			e.preventDefault();
			if (editorStore.isDirty) {
				saveFile();
			}
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="editor">
	<header class="editor-header">
		<div class="header-left">
			<h1>Quest Editor</h1>

			<select value={selectedFile} onchange={handleFileSelect} disabled={loading}>
				<option value="">Select a quest file...</option>
				{#each data.files as file}
					<option value={file}>{file}</option>
				{/each}
			</select>

			{#if editorStore.fileName}
				<span class="current-file">
					{editorStore.fileName}
					{#if editorStore.isDirty}
						<span class="dirty-indicator">*</span>
					{/if}
				</span>
			{/if}
		</div>

		<div class="header-right">
			{#if editorStore.questFile}
				<button onclick={saveFile} disabled={loading || !editorStore.isDirty} class="save-button">
					{loading ? 'Saving...' : 'Save'}
				</button>
			{/if}
		</div>
	</header>

	{#if errorMessage}
		<div class="error-banner">
			{errorMessage}
			<button onclick={() => (errorMessage = null)}>Dismiss</button>
		</div>
	{/if}

	<main class="editor-main">
		{#if !editorStore.questFile}
			<div class="empty-state">
				<p>Select a quest file to begin editing</p>
				<p class="hint">Files are loaded from the <code>quests/</code> directory</p>
			</div>
		{:else}
			<div class="editor-layout">
				<!-- Navigation Panel (Left) -->
				<aside class="nav-panel">
					<h2>Steps</h2>

					<div class="field">
						<label for="step-search">Search</label>
						<input
							id="step-search"
							type="text"
							placeholder="Filter steps by ID..."
							bind:value={stepFilter}
						/>
					</div>

					<div class="field">
						<span class="field-label">All Steps ({filteredSteps.length})</span>
						<ul class="step-list">
							{#each filteredSteps as { step, index }}
								<li>
									<button
										class="step-link"
										class:selected={editorStore.selectedStepIndex === index}
										class:is-patch={isPatchStep(step)}
										onclick={() => editorStore.selectStep(index)}
									>
										{#if isPatchStep(step)}
											<span class="step-icon patch" title="Patch">🩹</span>
											<span class="step-id">{getPatchTarget(step)}</span>
										{:else}
											<span class="step-id">{step.id}</span>
										{/if}
										{#if step.tags?.length}
											<small class="step-tags">({step.tags.length} tags)</small>
										{/if}
									</button>
								</li>
							{/each}
							{#if filteredSteps.length === 0}
								<li class="no-match">No steps match filter</li>
							{/if}
						</ul>
					</div>

					<button
						class="add-patch-button"
						onclick={() => {
							const newPatch = {
								id: '@patch:',
								tags: [],
								text: {} as unknown as string // Patches use TextModification object, not string
							};
							const index = editorStore.addStep(newPatch);
							editorStore.selectStep(index);
						}}
					>
						+ Add Patch
					</button>

					<hr class="divider" />

					<h3>Tag Filter (optional)</h3>
					<p class="hint">Set hypothetical tags to find matching location steps</p>

					<div class="field">
						<label for="location-select">Location</label>
						<select
							id="location-select"
							value={editorStore.selectedLocation ?? ''}
							onchange={(e) => editorStore.selectLocation((e.target as HTMLSelectElement).value || null)}
						>
							<option value="">Select location...</option>
							{#each editorStore.allLocations as loc}
								<option value={loc.id}>{loc.name} ({loc.id})</option>
							{/each}
						</select>
					</div>

					{#if editorStore.selectedLocation}
						<div class="field">
							<span class="field-label">Active Tags</span>
							<div class="tag-list">
								{#each [...editorStore.activeTags] as tag}
									<span class="tag-chip">
										{tag}
										<button onclick={() => editorStore.removeTag(tag)} aria-label="Remove {tag}">
											&times;
										</button>
									</span>
								{/each}
							</div>
							<div class="tag-add">
								<input
									type="text"
									placeholder="Add tag..."
									list="tag-suggestions"
									onkeydown={(e) => {
										if (e.key === 'Enter') {
											const input = e.target as HTMLInputElement;
											if (input.value.trim()) {
												editorStore.addTag(input.value.trim());
												input.value = '';
											}
										}
									}}
								/>
								<datalist id="tag-suggestions">
									{#each editorStore.allTags as tag}
										<option value={tag}>{tag}</option>
									{/each}
								</datalist>
							</div>
						</div>

						<div class="field">
							<span class="field-label">Matching: {editorStore.matchingSteps.length}</span>
							<ul class="step-list compact">
								{#each editorStore.matchingSteps as { step, index }}
									<li>
										<button
											class="step-link"
											class:selected={editorStore.selectedStepIndex === index}
											onclick={() => editorStore.selectStep(index)}
										>
											{step.id}
										</button>
									</li>
								{/each}
								{#if editorStore.matchingSteps.length === 0}
									<li class="no-match">No steps match</li>
								{/if}
							</ul>
						</div>
					{/if}
				</aside>

				<!-- Step Editor (Center) -->
				<section class="step-panel">
					{#if editorStore.selectedStep && editorStore.selectedStepIndex !== null}
						<StepEditor step={editorStore.selectedStep} index={editorStore.selectedStepIndex} />
					{:else if editorStore.selectedLocation}
						<div class="empty-state">
							<p>Select a step from the list or add a new one</p>
							<button
								class="add-step-button"
								onclick={() => {
									const newStep = {
										id: editorStore.selectedLocation!,
										tags: [],
										text: 'New step text here...'
									};
									const index = editorStore.addStep(newStep);
									editorStore.selectStep(index);
								}}
							>
								+ Add Step for {editorStore.selectedLocation}
							</button>
						</div>
					{:else}
						<div class="empty-state">
							<p>Select a location to view steps</p>
						</div>
					{/if}
				</section>

				<!-- Info Panel (Right) -->
				<aside class="info-panel">
					<h2>File Info</h2>
					<dl>
						<dt>Steps</dt>
						<dd>{editorStore.questFile.steps.length}</dd>
						<dt>Presets</dt>
						<dd>{Object.keys(editorStore.questFile.option_presets ?? {}).length}</dd>
						<dt>Unique Locations</dt>
						<dd>{new Set(editorStore.questFile.steps.map((s) => s.id)).size}</dd>
					</dl>

					<CoverageMatrix />
				</aside>
			</div>
		{/if}
	</main>

	<LintPanel />
</div>

<style>
	.editor {
		display: flex;
		flex-direction: column;
		height: 100vh;
	}

	.editor-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
		gap: 1rem;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.header-left h1 {
		font-size: 1.25rem;
		margin: 0;
	}

	.header-left select {
		padding: 0.5rem;
		font-family: inherit;
		font-size: 0.9rem;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		background: white;
	}

	.current-file {
		font-size: 0.9rem;
		color: var(--color-text-secondary);
	}

	.dirty-indicator {
		color: var(--color-failure);
		font-weight: bold;
	}

	.header-right {
		display: flex;
		gap: 0.5rem;
	}

	.save-button {
		padding: 0.5rem 1rem;
		background: var(--color-button);
		color: var(--color-button-text);
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-family: inherit;
	}

	.save-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.save-button:not(:disabled):hover {
		opacity: 0.9;
	}

	.error-banner {
		background: var(--color-failure-bg);
		color: var(--color-failure);
		padding: 0.75rem 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.error-banner button {
		background: none;
		border: 1px solid var(--color-failure);
		color: var(--color-failure);
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		cursor: pointer;
		font-family: inherit;
	}

	.editor-main {
		flex: 1;
		overflow: hidden;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--color-text-secondary);
		gap: 0.5rem;
	}

	.empty-state code {
		background: var(--color-surface);
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
	}

	.hint {
		font-size: 0.85rem;
		color: var(--color-text-secondary);
	}

	.editor-layout {
		display: grid;
		grid-template-columns: 280px 1fr 240px;
		height: 100%;
	}

	.nav-panel,
	.info-panel {
		padding: 1rem;
		background: var(--color-surface);
		border-right: 1px solid var(--color-border);
		overflow-y: auto;
	}

	.info-panel {
		border-right: none;
		border-left: 1px solid var(--color-border);
	}

	.nav-panel h2,
	.info-panel h2 {
		font-size: 1rem;
		margin-bottom: 1rem;
		color: var(--color-text);
	}

	.nav-panel h3 {
		font-size: 0.9rem;
		margin-bottom: 0.5rem;
		color: var(--color-text);
	}

	.nav-panel .hint {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		margin-bottom: 0.75rem;
	}

	.divider {
		border: none;
		border-top: 1px solid var(--color-border);
		margin: 1rem 0;
	}

	.step-id {
		font-family: monospace;
		font-size: 0.8rem;
	}

	.step-tags {
		opacity: 0.6;
		margin-left: 0.25rem;
	}

	.step-list.compact .step-link {
		padding: 0.35rem 0.5rem;
		font-size: 0.8rem;
	}

	.field {
		margin-bottom: 1rem;
	}

	.field label,
	.field-label {
		display: block;
		font-size: 0.85rem;
		margin-bottom: 0.25rem;
		color: var(--color-text-secondary);
	}

	.field select,
	.field input {
		width: 100%;
		padding: 0.5rem;
		font-family: inherit;
		font-size: 0.9rem;
		border: 1px solid var(--color-border);
		border-radius: 4px;
	}

	.tag-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-bottom: 0.5rem;
	}

	.tag-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		background: var(--color-button);
		color: var(--color-button-text);
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		font-size: 0.8rem;
	}

	.tag-chip button {
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		padding: 0;
		font-size: 1rem;
		line-height: 1;
	}

	.tag-add input {
		font-size: 0.85rem;
	}

	.step-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.step-link {
		display: block;
		width: 100%;
		text-align: left;
		padding: 0.5rem;
		background: white;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.85rem;
		margin-bottom: 0.25rem;
	}

	.step-link:hover {
		background: var(--color-surface);
	}

	.step-link.selected {
		background: var(--color-accent);
		color: white;
		border-color: var(--color-accent);
	}

	.step-link small {
		opacity: 0.7;
	}

	.step-link.is-patch {
		background: #fff8e6;
		border-color: var(--color-accent);
	}

	.step-link.is-patch.selected {
		background: var(--color-accent);
	}

	.step-icon.patch {
		font-size: 0.85rem;
		margin-right: 0.25rem;
	}

	.add-patch-button {
		width: 100%;
		padding: 0.5rem;
		background: #fff8e6;
		border: 1px dashed var(--color-accent);
		color: var(--color-accent);
		border-radius: 4px;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.85rem;
		margin-top: 0.5rem;
	}

	.add-patch-button:hover {
		background: var(--color-accent);
		color: white;
		border-style: solid;
	}

	.no-match {
		color: var(--color-text-secondary);
		font-size: 0.85rem;
		padding: 0.5rem;
	}

	.step-panel {
		padding: 1rem;
		overflow-y: auto;
	}

	.add-step-button {
		margin-top: 1rem;
		padding: 0.75rem 1.5rem;
		background: var(--color-button);
		color: var(--color-button-text);
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-family: inherit;
	}

	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.25rem 0.5rem;
		font-size: 0.85rem;
	}

	dt {
		color: var(--color-text-secondary);
	}

	dd {
		margin: 0;
		font-weight: bold;
	}
</style>
