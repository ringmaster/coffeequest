<script lang="ts">
	import { editorStore } from '$lib/stores/editorState.svelte';
	import StepEditor from '$lib/components/editor/StepEditor.svelte';
	import StepList from '$lib/components/editor/StepList.svelte';
	import Simulator from '$lib/components/editor/Simulator.svelte';
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
				<!-- Step List (Left) -->
				<aside class="nav-panel">
					<StepList />
				</aside>

				<!-- Step Editor (Center) -->
				<section class="step-panel">
					{#if editorStore.selectedStep && editorStore.selectedStepIndex !== null}
						<StepEditor step={editorStore.selectedStep} index={editorStore.selectedStepIndex} />
					{:else}
						<div class="empty-state">
							<p>Select a step from the list to edit</p>
						</div>
					{/if}
				</section>

				<!-- Simulator Panel (Right) -->
				<aside class="simulator-panel">
					<Simulator />
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
		grid-template-columns: 280px 1fr 300px;
		height: 100%;
	}

	.nav-panel {
		background: var(--color-surface);
		border-right: 1px solid var(--color-border);
		overflow: hidden;
	}

	.simulator-panel {
		background: var(--color-surface);
		border-left: 1px solid var(--color-border);
		overflow: hidden;
	}

	.step-panel {
		padding: 1rem;
		overflow-y: auto;
	}
</style>
