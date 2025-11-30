<script lang="ts">
	import { editorStore, parseTag, formatTag } from '$lib/stores/editorState.svelte';
	import type { ParsedTag } from '$lib/types/editor';

	let { tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void } = $props();

	// Parse all tags for display
	let parsedTags = $derived(tags.map((t) => ({ raw: t, parsed: parseTag(t) })));

	let editingIndex = $state<number | null>(null);
	let newTagInput = $state('');

	function getOperatorLabel(op: ParsedTag['operator']): string {
		switch (op) {
			case '@':
				return 'Require';
			case '!':
				return 'Forbid';
			case '+':
				return 'Add';
			case '-':
				return 'Remove';
			default:
				return 'Require';
		}
	}

	function getOperatorClass(op: ParsedTag['operator']): string {
		switch (op) {
			case '@':
			case '':
				return 'require';
			case '!':
				return 'forbid';
			case '+':
				return 'add';
			case '-':
				return 'remove';
			default:
				return 'require';
		}
	}

	function updateTag(index: number, operator: ParsedTag['operator'], tag: string) {
		const newTags = [...tags];
		newTags[index] = formatTag({ operator, tag });
		onChange(newTags);
	}

	function removeTag(index: number) {
		const newTags = tags.filter((_, i) => i !== index);
		onChange(newTags);
	}

	function addTag() {
		const trimmed = newTagInput.trim();
		if (!trimmed) return;

		// Parse the input to extract operator if provided
		const parsed = parseTag(trimmed);
		const formatted = formatTag(parsed);

		onChange([...tags, formatted]);
		newTagInput = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addTag();
		}
	}
</script>

<div class="tags-editor field">
	<span class="field-label">Tags</span>

	<div class="tags-list">
		{#each parsedTags as { raw, parsed }, index}
			<div class="tag-item {getOperatorClass(parsed.operator)}">
				{#if editingIndex === index}
					<select
						value={parsed.operator || '@'}
						onchange={(e) => {
							const op = (e.target as HTMLSelectElement).value as ParsedTag['operator'];
							updateTag(index, op, parsed.tag);
						}}
					>
						<option value="@">@ Require</option>
						<option value="!">! Forbid</option>
						<option value="+">+ Add</option>
						<option value="-">- Remove</option>
					</select>
					<input
						type="text"
						value={parsed.tag}
						onchange={(e) => {
							updateTag(index, parsed.operator || '@', (e.target as HTMLInputElement).value);
						}}
						onblur={() => (editingIndex = null)}
						list="all-tags"
					/>
				{:else}
					<button class="tag-button" onclick={() => (editingIndex = index)} title="Click to edit">
						<span class="operator">{parsed.operator || '@'}</span>
						<span class="tag-name">{parsed.tag}</span>
					</button>
				{/if}
				<button class="remove-btn" onclick={() => removeTag(index)} title="Remove tag">
					&times;
				</button>
			</div>
		{/each}

		<div class="tag-add">
			<input
				type="text"
				bind:value={newTagInput}
				onkeydown={handleKeydown}
				placeholder="Add tag (e.g., @quest, !done:x, +inv:key)"
				list="all-tags"
			/>
			<button onclick={addTag} disabled={!newTagInput.trim()}>Add</button>
		</div>
	</div>

	<datalist id="all-tags">
		{#each editorStore.allTags as tag}
			<option value={tag}>{tag}</option>
		{/each}
	</datalist>

	<div class="field-hint">
		<strong>@</strong> require &bull; <strong>!</strong> forbid &bull; <strong>+</strong> add &bull;
		<strong>-</strong> remove
	</div>
</div>

<style>
	.tags-editor {
		margin-bottom: 1.25rem;
	}

	.tags-editor .field-label {
		display: block;
		font-size: 0.85rem;
		font-weight: bold;
		margin-bottom: 0.35rem;
		color: var(--color-text);
	}

	.tags-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		padding: 0.5rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		min-height: 42px;
	}

	.tag-item {
		display: inline-flex;
		align-items: center;
		border-radius: 4px;
		font-size: 0.85rem;
		overflow: hidden;
	}

	.tag-item.require {
		background: #e3f2fd;
		border: 1px solid #2196f3;
	}

	.tag-item.forbid {
		background: #ffebee;
		border: 1px solid #f44336;
	}

	.tag-item.add {
		background: #e8f5e9;
		border: 1px solid #4caf50;
	}

	.tag-item.remove {
		background: #fff3e0;
		border: 1px solid #ff9800;
	}

	.tag-button {
		display: flex;
		align-items: center;
		gap: 0.15rem;
		padding: 0.25rem 0.5rem;
		background: none;
		border: none;
		cursor: pointer;
		font-family: inherit;
		font-size: inherit;
	}

	.tag-button:hover {
		background: rgba(0, 0, 0, 0.05);
	}

	.operator {
		font-weight: bold;
		opacity: 0.7;
	}

	.tag-name {
		font-family: monospace;
	}

	.tag-item select {
		padding: 0.2rem;
		font-size: 0.75rem;
		border: none;
		background: rgba(255, 255, 255, 0.8);
	}

	.tag-item input {
		width: 120px;
		padding: 0.2rem 0.35rem;
		font-size: 0.8rem;
		border: none;
		background: rgba(255, 255, 255, 0.8);
		font-family: monospace;
	}

	.remove-btn {
		padding: 0.25rem 0.35rem;
		background: none;
		border: none;
		cursor: pointer;
		font-size: 1rem;
		line-height: 1;
		opacity: 0.5;
	}

	.remove-btn:hover {
		opacity: 1;
		background: rgba(0, 0, 0, 0.1);
	}

	.tag-add {
		display: flex;
		gap: 0.25rem;
		flex: 1;
		min-width: 200px;
	}

	.tag-add input {
		flex: 1;
		padding: 0.35rem 0.5rem;
		font-size: 0.85rem;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		font-family: monospace;
	}

	.tag-add button {
		padding: 0.35rem 0.75rem;
		background: var(--color-button);
		color: var(--color-button-text);
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.85rem;
	}

	.tag-add button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.field-hint {
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		margin-top: 0.35rem;
	}
</style>
