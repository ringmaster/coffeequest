<script lang="ts">
	import { editorStore, parseTag, formatTag, isPatchStep, getPatchTarget } from '$lib/stores/editorState.svelte';
	import type { RawStep, RawStepOption, VarOptions, TextModification } from '$lib/types/game';
	import TagsEditor from './TagsEditor.svelte';
	import VariablesEditor from './VariablesEditor.svelte';
	import TextEditor from './TextEditor.svelte';
	import OptionsEditor from './OptionsEditor.svelte';

	let { step, index }: { step: RawStep; index: number } = $props();

	// Local copy for editing
	let editingStep = $state<RawStep>({ ...step, tags: [...(step.tags ?? [])], vars: step.vars ? { ...step.vars } : undefined });

	// Sync when step changes from outside
	$effect(() => {
		editingStep = { ...step, tags: [...(step.tags ?? [])], vars: step.vars ? { ...step.vars } : undefined };
	});

	function updateStep() {
		editorStore.updateStep(index, editingStep);
	}

	// Detect if this is a patch step
	let isPatch = $derived(isPatchStep(editingStep));
	let patchTarget = $derived(getPatchTarget(editingStep));

	// For patches, text is a TextModification object
	let textModification = $derived.by(() => {
		if (!isPatch) return null;
		// If text is a string, treat it as replace (legacy or simple case)
		if (typeof editingStep.text === 'string') {
			return { replace: editingStep.text } as TextModification;
		}
		return (editingStep.text as unknown as TextModification) ?? {};
	});

	function handleIdChange(e: Event) {
		const input = e.target as HTMLInputElement;
		editingStep.id = input.value;
		updateStep();
	}

	function handleTargetChange(e: Event) {
		const input = e.target as HTMLInputElement;
		editingStep.id = '@patch:' + input.value;
		updateStep();
	}

	function handleTextChange(text: string) {
		editingStep.text = text;
		updateStep();
	}

	function handleTextModChange(field: keyof TextModification, value: string) {
		const currentMod = textModification ?? {};
		const newMod = { ...currentMod };

		if (value.trim()) {
			newMod[field] = value;
		} else {
			delete newMod[field];
		}

		// Store as the text field (the build step expects text to be TextModification for patches)
		editingStep.text = newMod as unknown as string;
		updateStep();
	}

	function handleLogChange(e: Event) {
		const input = e.target as HTMLInputElement;
		editingStep.log = input.value || undefined;
		updateStep();
	}

	function handleTagsChange(tags: string[]) {
		editingStep.tags = tags;
		updateStep();
	}

	function handleVarsChange(vars: Record<string, VarOptions> | undefined) {
		editingStep.vars = vars;
		updateStep();
	}

	function handleOptionsChange(options: RawStepOption[] | string | undefined) {
		editingStep.options = options;
		updateStep();
	}

	function handleDelete() {
		if (confirm(`Delete ${isPatch ? 'patch' : 'step'} "${editingStep.id}"?`)) {
			editorStore.deleteStep(index);
		}
	}

	// Determine if this is a location step or internal step (only for non-patches)
	let isLocationStep = $derived(
		!isPatch &&
			editorStore.allLocations.some(
				(loc) => loc.id.toLowerCase() === editingStep.id.toLowerCase()
			)
	);
</script>

<div class="step-editor">
	<div class="step-header">
		<h2>
			{#if isPatch}
				<span class="step-type patch" title="Patch">🩹</span>
				Patch Editor
			{:else if isLocationStep}
				<span class="step-type location" title="Location Step">📍</span>
				Step Editor
			{:else}
				<span class="step-type internal" title="Internal Step">→</span>
				Step Editor
			{/if}
		</h2>
		<button class="delete-btn" onclick={handleDelete} title="Delete {isPatch ? 'Patch' : 'Step'}">
			Delete
		</button>
	</div>

	{#if isPatch}
		<!-- Patch-specific fields -->
		<div class="field">
			<label for="patch-target">Target Step</label>
			<input
				id="patch-target"
				type="text"
				list="patch-target-list"
				value={patchTarget ?? ''}
				oninput={handleTargetChange}
				placeholder="Enter or select target step ID..."
			/>
			<datalist id="patch-target-list">
				{#each editorStore.allGlobalStepIds as stepId}
					<option value={stepId}>{stepId}</option>
				{/each}
			</datalist>
			<div class="field-hint">The step this patch modifies when its conditions are met (can target steps in other files)</div>
		</div>

		<TagsEditor tags={editingStep.tags ?? []} onChange={handleTagsChange} />
		<div class="field-hint tags-hint">
			Use @tag/!tag for player conditions, ^tag/^!tag for base step conditions. Patch applies when all match.
		</div>

		<VariablesEditor vars={editingStep.vars} onChange={handleVarsChange} />

		<div class="field">
			<span class="field-label">Text Modification</span>
			<div class="text-mod-fields">
				<div class="text-mod-field">
					<label for="text-prepend">Prepend</label>
					<textarea
						id="text-prepend"
						value={textModification?.prepend ?? ''}
						oninput={(e) => handleTextModChange('prepend', (e.target as HTMLTextAreaElement).value)}
						placeholder="Text to add before the original..."
						rows="2"
					></textarea>
				</div>
				<div class="text-mod-field">
					<label for="text-append">Append</label>
					<textarea
						id="text-append"
						value={textModification?.append ?? ''}
						oninput={(e) => handleTextModChange('append', (e.target as HTMLTextAreaElement).value)}
						placeholder="Text to add after the original..."
						rows="2"
					></textarea>
				</div>
				<div class="text-mod-field">
					<label for="text-replace">Replace (overrides prepend/append)</label>
					<textarea
						id="text-replace"
						value={textModification?.replace ?? ''}
						oninput={(e) => handleTextModChange('replace', (e.target as HTMLTextAreaElement).value)}
						placeholder="Text to completely replace the original..."
						rows="3"
					></textarea>
				</div>
			</div>
			<div class="field-hint">Leave empty to keep original text. Replace overrides prepend/append.</div>
		</div>

		<OptionsEditor
			options={editingStep.options}
			onChange={handleOptionsChange}
			presets={editorStore.questFile?.option_presets}
		/>
		<div class="field-hint options-hint">Options are appended to the target step's options</div>
	{:else}
		<!-- Regular step fields -->
		<div class="field">
			<label for="step-id">Step ID</label>
			{#if isLocationStep}
				<select id="step-id" value={editingStep.id} onchange={handleIdChange}>
					{#each editorStore.allLocations as loc}
						<option value={loc.id}>{loc.name} ({loc.id})</option>
					{/each}
				</select>
			{:else}
				<input
					id="step-id"
					type="text"
					value={editingStep.id}
					onchange={handleIdChange}
					placeholder="Internal step ID (e.g., confront_guard)"
				/>
			{/if}
			<div class="field-hint">
				<label>
					<input
						type="checkbox"
						checked={!isLocationStep}
						onchange={() => {
							if (isLocationStep) {
								// Convert to internal step by adding underscore
								editingStep.id = editingStep.id.toLowerCase().replace(/\s+/g, '_');
							} else {
								// Convert to location step
								editingStep.id = editorStore.selectedLocation ?? editingStep.id;
							}
							updateStep();
						}}
					/>
					Internal step (not a map location)
				</label>
			</div>
		</div>

		<TagsEditor tags={editingStep.tags ?? []} onChange={handleTagsChange} />

		<VariablesEditor vars={editingStep.vars} onChange={handleVarsChange} />

		<TextEditor
			text={editingStep.text}
			onChange={handleTextChange}
			vars={editingStep.vars}
			globalVars={editorStore.globalVars}
			onNavigateToStep={(stepIndex) => editorStore.selectStep(stepIndex)}
		/>

		<OptionsEditor
			options={editingStep.options}
			onChange={handleOptionsChange}
			presets={editorStore.questFile?.option_presets}
		/>

		<div class="field">
			<label for="step-log">Log Entry (optional)</label>
			<input
				id="step-log"
				type="text"
				value={editingStep.log ?? ''}
				onchange={handleLogChange}
				placeholder="Text to add to quest log..."
			/>
			<div class="field-hint">Appears in the player's quest log when this step is completed</div>
		</div>
	{/if}
</div>

<style>
	.step-editor {
		background: white;
		border-radius: 8px;
		padding: 1.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.step-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--color-border);
	}

	.step-header h2 {
		font-size: 1.1rem;
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.step-type {
		font-size: 1rem;
	}

	.step-type.location {
		color: var(--color-success);
	}

	.step-type.internal {
		color: var(--color-text-secondary);
	}

	.step-type.patch {
		color: var(--color-accent);
	}

	.delete-btn {
		padding: 0.5rem 1rem;
		background: var(--color-failure-bg);
		color: var(--color-failure);
		border: 1px solid var(--color-failure);
		border-radius: 4px;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.85rem;
	}

	.delete-btn:hover {
		background: var(--color-failure);
		color: white;
	}

	.field {
		margin-bottom: 1.25rem;
	}

	.field label,
	.field .field-label {
		display: block;
		font-size: 0.85rem;
		font-weight: bold;
		margin-bottom: 0.35rem;
		color: var(--color-text);
	}

	.field input[type='text'],
	.field select,
	.field textarea {
		width: 100%;
		padding: 0.6rem;
		font-family: inherit;
		font-size: 0.9rem;
		border: 1px solid var(--color-border);
		border-radius: 4px;
	}

	.field input[type='text']:focus,
	.field select:focus,
	.field textarea:focus {
		outline: none;
		border-color: var(--color-accent);
		box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.2);
	}

	.field-hint {
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		margin-top: 0.35rem;
	}

	.field-hint label {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-weight: normal;
		cursor: pointer;
	}

	.field-hint input[type='checkbox'] {
		margin: 0;
	}

	.tags-hint,
	.options-hint {
		margin-top: -0.75rem;
		margin-bottom: 1rem;
	}

	.text-mod-fields {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.text-mod-field label {
		font-weight: normal;
		font-size: 0.8rem;
		color: var(--color-text-secondary);
	}

	.text-mod-field textarea {
		resize: vertical;
		min-height: 2.5rem;
	}
</style>
