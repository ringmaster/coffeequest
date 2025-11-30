<script lang="ts">
	import { editorStore } from '$lib/stores/editorState.svelte';
	import type { RawStepOption, StepOption } from '$lib/types/game';

	let {
		options,
		onChange,
		presets
	}: {
		options: RawStepOption[] | string | undefined;
		onChange: (options: RawStepOption[] | string | undefined) => void;
		presets?: Record<string, RawStepOption[]>;
	} = $props();

	let expandedIndex = $state<number | null>(null);

	// Parse shorthand options to full form for editing
	function parseOption(opt: RawStepOption): StepOption {
		if (typeof opt === 'string') {
			// Parse shorthand: "Label::step_id" or "Label"
			const match = opt.match(/^(.+?)(?:::(.+))?$/);
			if (match) {
				return {
					label: match[1],
					tags: [],
					pass: match[2] || null
				};
			}
			return { label: opt, tags: [], pass: null };
		}
		return {
			label: opt.label,
			tags: opt.tags ?? [],
			skill: opt.skill,
			dc: opt.dc,
			pass: opt.pass ?? null,
			fail: opt.fail,
			hidden: opt.hidden
		};
	}

	// Convert back to shorthand if possible
	function toRawOption(opt: StepOption): RawStepOption {
		// If it has skill check or tags or hidden, use full object
		if (opt.skill || opt.dc || (opt.tags && opt.tags.length > 0) || opt.hidden || opt.fail) {
			const result: StepOption = {
				label: opt.label,
				tags: opt.tags && opt.tags.length > 0 ? opt.tags : [],
				pass: opt.pass
			};
			if (opt.skill) result.skill = opt.skill;
			if (opt.dc) result.dc = opt.dc;
			if (opt.fail) result.fail = opt.fail;
			if (opt.hidden) result.hidden = opt.hidden;
			return result;
		}
		// Use shorthand
		if (opt.pass) {
			return `${opt.label}::${opt.pass}`;
		}
		return opt.label;
	}

	// Get parsed options array
	let parsedOptions = $derived.by(() => {
		if (typeof options === 'string') {
			// Preset reference
			return presets?.[options]?.map(parseOption) ?? [];
		}
		return options?.map(parseOption) ?? [];
	});

	let isPreset = $derived(typeof options === 'string');
	let presetName = $derived(isPreset ? (options as string) : '');

	function updateOption(index: number, updated: StepOption) {
		if (isPreset) return; // Can't edit preset
		const newOptions = [...(options as RawStepOption[])];
		newOptions[index] = toRawOption(updated);
		onChange(newOptions);
	}

	function removeOption(index: number) {
		if (isPreset) return;
		const newOptions = (options as RawStepOption[]).filter((_, i) => i !== index);
		onChange(newOptions.length > 0 ? newOptions : undefined);
	}

	function addOption() {
		const newOpt: RawStepOption = 'New option';
		const newOptions = [...((options as RawStepOption[]) ?? []), newOpt];
		onChange(newOptions);
		expandedIndex = newOptions.length - 1;
	}

	function moveOption(index: number, direction: 'up' | 'down') {
		if (isPreset) return;
		const newIndex = direction === 'up' ? index - 1 : index + 1;
		if (newIndex < 0 || newIndex >= (options as RawStepOption[]).length) return;

		const newOptions = [...(options as RawStepOption[])];
		[newOptions[index], newOptions[newIndex]] = [newOptions[newIndex], newOptions[index]];
		onChange(newOptions);
		expandedIndex = newIndex;
	}

	function convertToArray() {
		if (!isPreset) return;
		const expanded = presets?.[options as string] ?? [];
		onChange(expanded);
	}

	// Collect all step IDs for autocomplete
	let allStepIds = $derived.by(() => {
		if (!editorStore.questFile) return [];
		return [...new Set(editorStore.questFile.steps.map((s) => s.id))].sort();
	});

	// Navigate to a step by ID
	function navigateToStep(stepId: string) {
		if (!editorStore.questFile) return;
		const index = editorStore.questFile.steps.findIndex((s) => s.id === stepId);
		if (index >= 0) {
			editorStore.selectStep(index);
		}
	}

	// Check if a step exists
	function stepExists(stepId: string | null | undefined): boolean {
		if (!stepId || !editorStore.questFile) return false;
		return editorStore.questFile.steps.some((s) => s.id === stepId);
	}
</script>

<div class="options-editor field">
	<div class="options-header">
		<span class="field-label">Options</span>
		{#if !isPreset}
			<button class="add-btn" onclick={addOption}>+ Add Option</button>
		{/if}
	</div>

	{#if isPreset}
		<div class="preset-notice">
			Using preset: <code>{presetName}</code>
			<button onclick={convertToArray}>Expand to edit</button>
		</div>
	{/if}

	<div class="options-list">
		{#if parsedOptions.length === 0}
			<div class="empty">No options (step ends interaction)</div>
		{:else}
			{#each parsedOptions as opt, index}
				<div class="option-item" class:expanded={expandedIndex === index}>
					<div class="option-header">
						<div class="option-controls">
							{#if !isPreset}
								<button
									class="move-btn"
									onclick={() => moveOption(index, 'up')}
									disabled={index === 0}
									title="Move up"
								>
									↑
								</button>
								<button
									class="move-btn"
									onclick={() => moveOption(index, 'down')}
									disabled={index === parsedOptions.length - 1}
									title="Move down"
								>
									↓
								</button>
							{/if}
						</div>

						<button
							class="option-summary"
							onclick={() => (expandedIndex = expandedIndex === index ? null : index)}
							disabled={isPreset}
						>
							<span class="option-label">{opt.label}</span>
							{#if opt.pass}
								<span class="option-target">→ {opt.pass}</span>
							{:else}
								<span class="option-target end">→ (end)</span>
							{/if}
							{#if opt.skill}
								<span class="option-badge skill">
									{Array.isArray(opt.skill) ? opt.skill.join('/') : opt.skill}
									{opt.dc}
								</span>
							{/if}
							{#if opt.hidden}
								<span class="option-badge hidden">Hidden</span>
							{/if}
							{#if opt.tags && opt.tags.length > 0}
								<span class="option-badge tags">{opt.tags.length} tags</span>
							{/if}
						</button>

						<!-- Navigation buttons to pass/fail targets -->
						<div class="nav-buttons">
							{#if opt.pass && stepExists(opt.pass)}
								<button
									class="nav-btn pass"
									onclick={() => navigateToStep(opt.pass!)}
									title="Go to pass target: {opt.pass}"
								>
									→
								</button>
							{/if}
							{#if opt.fail && stepExists(opt.fail)}
								<button
									class="nav-btn fail"
									onclick={() => navigateToStep(opt.fail!)}
									title="Go to fail target: {opt.fail}"
								>
									✗→
								</button>
							{/if}
						</div>

						{#if !isPreset}
							<button class="remove-btn" onclick={() => removeOption(index)} title="Remove option">
								&times;
							</button>
						{/if}
					</div>

					{#if expandedIndex === index && !isPreset}
						<div class="option-form">
							<div class="form-row">
								<label>
									Label
									<input
										type="text"
										value={opt.label}
										onchange={(e) => updateOption(index, { ...opt, label: (e.target as HTMLInputElement).value })}
									/>
								</label>
							</div>

							<div class="form-row two-col">
								<label>
									Pass Target
									<input
										type="text"
										value={opt.pass ?? ''}
										onchange={(e) => {
											const val = (e.target as HTMLInputElement).value.trim();
											updateOption(index, { ...opt, pass: val || null });
										}}
										list="step-ids"
										placeholder="Step ID or leave empty"
									/>
								</label>
								<label>
									Fail Target
									<input
										type="text"
										value={opt.fail ?? ''}
										onchange={(e) => {
											const val = (e.target as HTMLInputElement).value.trim();
											updateOption(index, { ...opt, fail: val || undefined });
										}}
										list="step-ids"
										placeholder="For skill check failures"
									/>
								</label>
							</div>

							<div class="form-row two-col">
								<label>
									Skill Check
									<select
										value={Array.isArray(opt.skill) ? opt.skill[0] : opt.skill ?? ''}
										onchange={(e) => {
											const val = (e.target as HTMLSelectElement).value;
											updateOption(index, { ...opt, skill: val || undefined });
										}}
									>
										<option value="">None</option>
										<option value="might">Might</option>
										<option value="guile">Guile</option>
										<option value="magic">Magic</option>
									</select>
								</label>
								<label>
									Difficulty (DC)
									<input
										type="number"
										min="1"
										max="20"
										value={opt.dc ?? ''}
										onchange={(e) => {
											const val = parseInt((e.target as HTMLInputElement).value);
											updateOption(index, { ...opt, dc: isNaN(val) ? undefined : val });
										}}
										disabled={!opt.skill}
									/>
								</label>
							</div>

							<div class="form-row">
								<label>
									Required Tags (comma-separated)
									<input
										type="text"
										value={opt.tags?.join(', ') ?? ''}
										onchange={(e) => {
											const val = (e.target as HTMLInputElement).value;
											const tags = val
												.split(',')
												.map((t) => t.trim())
												.filter((t) => t);
											updateOption(index, { ...opt, tags });
										}}
										placeholder="e.g., inv:key, ally:guard"
									/>
								</label>
							</div>

							<div class="form-row checkbox">
								<label>
									<input
										type="checkbox"
										checked={opt.hidden ?? false}
										onchange={(e) => {
											updateOption(index, {
												...opt,
												hidden: (e.target as HTMLInputElement).checked || undefined
											});
										}}
									/>
									Hidden (only show when requirements met)
								</label>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>

	<datalist id="step-ids">
		{#each allStepIds as id}
			<option value={id}>{id}</option>
		{/each}
	</datalist>

	<div class="field-hint">
		Options define player choices. Use skill checks for challenging actions with pass/fail outcomes.
	</div>
</div>

<style>
	.options-editor {
		margin-bottom: 1.25rem;
	}

	.options-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.35rem;
	}

	.options-header .field-label {
		font-size: 0.85rem;
		font-weight: bold;
		color: var(--color-text);
	}

	.add-btn {
		padding: 0.25rem 0.5rem;
		background: var(--color-button);
		color: var(--color-button-text);
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.8rem;
	}

	.preset-notice {
		padding: 0.5rem;
		background: #e3f2fd;
		border: 1px solid #2196f3;
		border-radius: 4px;
		font-size: 0.85rem;
		margin-bottom: 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.preset-notice code {
		background: rgba(255, 255, 255, 0.5);
		padding: 0.15rem 0.35rem;
		border-radius: 3px;
	}

	.preset-notice button {
		margin-left: auto;
		padding: 0.25rem 0.5rem;
		background: white;
		border: 1px solid #2196f3;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.8rem;
	}

	.options-list {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		padding: 0.5rem;
	}

	.empty {
		color: var(--color-text-secondary);
		font-size: 0.85rem;
		padding: 0.5rem;
		text-align: center;
	}

	.option-item {
		background: white;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		margin-bottom: 0.35rem;
	}

	.option-item:last-child {
		margin-bottom: 0;
	}

	.option-item.expanded {
		border-color: var(--color-accent);
	}

	.option-header {
		display: flex;
		align-items: center;
	}

	.option-controls {
		display: flex;
		flex-direction: column;
		padding: 0.25rem;
	}

	.move-btn {
		padding: 0.1rem 0.35rem;
		background: none;
		border: 1px solid var(--color-border);
		border-radius: 3px;
		cursor: pointer;
		font-size: 0.7rem;
		line-height: 1;
	}

	.move-btn:first-child {
		border-bottom-left-radius: 0;
		border-bottom-right-radius: 0;
	}

	.move-btn:last-child {
		border-top-left-radius: 0;
		border-top-right-radius: 0;
		margin-top: -1px;
	}

	.move-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.move-btn:not(:disabled):hover {
		background: var(--color-surface);
	}

	.option-summary {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: none;
		border: none;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.85rem;
		text-align: left;
	}

	.option-summary:hover {
		background: var(--color-surface);
	}

	.option-summary:disabled {
		cursor: default;
	}

	.option-label {
		font-weight: 500;
	}

	.option-target {
		color: var(--color-text-secondary);
		font-family: monospace;
		font-size: 0.8rem;
	}

	.option-target.end {
		font-style: italic;
	}

	.option-badge {
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		font-size: 0.7rem;
		font-weight: 500;
	}

	.option-badge.skill {
		background: #e8f5e9;
		color: #2e7d32;
	}

	.option-badge.hidden {
		background: #fff3e0;
		color: #e65100;
	}

	.option-badge.tags {
		background: #e3f2fd;
		color: #1565c0;
	}

	.nav-buttons {
		display: flex;
		gap: 0.25rem;
		padding: 0 0.25rem;
	}

	.nav-btn {
		padding: 0.25rem 0.4rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 3px;
		cursor: pointer;
		font-size: 0.75rem;
		line-height: 1;
		color: var(--color-text-secondary);
	}

	.nav-btn:hover {
		background: var(--color-button);
		color: var(--color-button-text);
		border-color: var(--color-button);
	}

	.nav-btn.pass {
		color: var(--color-success);
	}

	.nav-btn.pass:hover {
		background: var(--color-success);
		color: white;
		border-color: var(--color-success);
	}

	.nav-btn.fail {
		color: var(--color-failure);
	}

	.nav-btn.fail:hover {
		background: var(--color-failure);
		color: white;
		border-color: var(--color-failure);
	}

	.remove-btn {
		padding: 0.5rem;
		background: none;
		border: none;
		cursor: pointer;
		font-size: 1.1rem;
		line-height: 1;
		color: var(--color-text-secondary);
	}

	.remove-btn:hover {
		color: var(--color-failure);
	}

	.option-form {
		padding: 0.75rem;
		border-top: 1px solid var(--color-border);
		background: #fafafa;
	}

	.form-row {
		margin-bottom: 0.75rem;
	}

	.form-row:last-child {
		margin-bottom: 0;
	}

	.form-row.two-col {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.form-row label {
		display: block;
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		margin-bottom: 0.25rem;
	}

	.form-row input[type='text'],
	.form-row input[type='number'],
	.form-row select {
		width: 100%;
		padding: 0.4rem 0.5rem;
		font-family: inherit;
		font-size: 0.85rem;
		border: 1px solid var(--color-border);
		border-radius: 4px;
	}

	.form-row input:focus,
	.form-row select:focus {
		outline: none;
		border-color: var(--color-accent);
	}

	.form-row.checkbox label {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		cursor: pointer;
	}

	.form-row.checkbox input {
		margin: 0;
	}

	.field-hint {
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		margin-top: 0.35rem;
	}
</style>
