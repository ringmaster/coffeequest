<script lang="ts">
	import type { VarOptions } from '$lib/types/game';

	let {
		text,
		onChange,
		vars,
		globalVars,
		onNavigateToStep
	}: {
		text: string;
		onChange: (text: string) => void;
		vars?: Record<string, VarOptions>;
		globalVars?: Map<string, { stepIndex: number; stepId: string }>;
		onNavigateToStep?: (stepIndex: number) => void;
	} = $props();

	// Extract variable names from text
	let usedVars = $derived.by(() => {
		const matches = text.matchAll(/\{\{([\w.]+)\}\}/g);
		return [...matches].map((m) => m[1]);
	});

	// Categorize variables: local (defined in this step), global (defined in other step), undefined
	let varCategories = $derived.by(() => {
		const localVars = new Set(Object.keys(vars ?? {}));
		const result: { local: string[]; global: { name: string; stepId: string; stepIndex: number }[]; undefined: string[] } = {
			local: [],
			global: [],
			undefined: []
		};

		const seen = new Set<string>();
		for (const v of usedVars) {
			const baseName = v.split('.')[0];
			if (seen.has(baseName)) continue;
			seen.add(baseName);

			if (localVars.has(v) || localVars.has(baseName)) {
				result.local.push(v);
			} else if (globalVars?.has(baseName)) {
				const def = globalVars.get(baseName)!;
				result.global.push({ name: v, stepId: def.stepId, stepIndex: def.stepIndex });
			} else {
				result.undefined.push(v);
			}
		}
		return result;
	});

	// Generate highlighted HTML
	let highlightedHtml = $derived.by(() => {
		const localVars = new Set(Object.keys(vars ?? {}));
		return text.replace(/\{\{([\w.]+)\}\}/g, (match, varName) => {
			const baseName = varName.split('.')[0];
			const isLocal = localVars.has(varName) || localVars.has(baseName);
			const isGlobal = !isLocal && globalVars?.has(baseName);
			const className = isLocal ? 'var-defined' : isGlobal ? 'var-global' : 'var-undefined';
			return `<span class="${className}">${match}</span>`;
		});
	});

	function handleInput(e: Event) {
		const textarea = e.target as HTMLTextAreaElement;
		onChange(textarea.value);
	}

	// Auto-resize textarea
	let textareaRef: HTMLTextAreaElement;

	$effect(() => {
		if (textareaRef) {
			textareaRef.style.height = 'auto';
			textareaRef.style.height = Math.max(100, textareaRef.scrollHeight) + 'px';
		}
	});
</script>

<div class="text-editor field">
	<label for="step-text">Step Text</label>

	<div class="editor-container">
		<div class="highlight-layer" aria-hidden="true">
			{@html highlightedHtml}
		</div>
		<textarea
			bind:this={textareaRef}
			id="step-text"
			value={text}
			oninput={handleInput}
			placeholder="Enter the step text here..."
			spellcheck="false"
		></textarea>
	</div>

	{#if varCategories.global.length > 0}
		<div class="info">
			<strong>Variables from other steps:</strong>
			{#each varCategories.global as v, i}
				<code>{v.name}</code>
				<button
					class="step-link"
					onclick={() => onNavigateToStep?.(v.stepIndex)}
					title="Go to step: {v.stepId}"
				>
					(from {v.stepId})
				</button>{i < varCategories.global.length - 1 ? ', ' : ''}
			{/each}
		</div>
	{/if}

	{#if varCategories.undefined.length > 0}
		<div class="warning">
			<strong>Undefined variables:</strong>
			{#each varCategories.undefined as v, i}
				<code>{v}</code>{i < varCategories.undefined.length - 1 ? ', ' : ''}
			{/each}
		</div>
	{/if}

	<div class="field-hint">
		Use <code>{'{{variable}}'}</code> syntax to reference variables. They will be randomly selected
		when the step is displayed.
	</div>
</div>

<style>
	.text-editor {
		margin-bottom: 1.25rem;
	}

	.text-editor > label {
		display: block;
		font-size: 0.85rem;
		font-weight: bold;
		margin-bottom: 0.35rem;
		color: var(--color-text);
	}

	.editor-container {
		position: relative;
		font-family: inherit;
		font-size: 0.9rem;
		line-height: 1.5;
	}

	.highlight-layer {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		padding: 0.6rem;
		border: 1px solid transparent;
		border-radius: 4px;
		white-space: pre-wrap;
		word-wrap: break-word;
		pointer-events: none;
		color: transparent;
		overflow: hidden;
	}

	.highlight-layer :global(.var-defined) {
		background: rgba(76, 175, 80, 0.2);
		border-radius: 3px;
		color: #2e7d32;
	}

	.highlight-layer :global(.var-undefined) {
		background: rgba(244, 67, 54, 0.2);
		border-radius: 3px;
		color: #c62828;
	}

	.highlight-layer :global(.var-global) {
		background: rgba(33, 150, 243, 0.2);
		border-radius: 3px;
		color: #1565c0;
	}

	textarea {
		width: 100%;
		min-height: 100px;
		padding: 0.6rem;
		font-family: inherit;
		font-size: 0.9rem;
		line-height: 1.5;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		resize: vertical;
		background: transparent;
		position: relative;
		z-index: 1;
	}

	textarea:focus {
		outline: none;
		border-color: var(--color-accent);
		box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.2);
	}

	.info {
		margin-top: 0.35rem;
		padding: 0.5rem;
		background: #e3f2fd;
		border: 1px solid #1565c0;
		border-radius: 4px;
		font-size: 0.8rem;
		color: #1565c0;
	}

	.info code {
		background: rgba(255, 255, 255, 0.5);
		padding: 0.1rem 0.25rem;
		border-radius: 3px;
	}

	.step-link {
		background: none;
		border: none;
		padding: 0;
		font-size: 0.75rem;
		color: #1565c0;
		cursor: pointer;
		text-decoration: underline;
		font-family: inherit;
	}

	.step-link:hover {
		color: #0d47a1;
	}

	.warning {
		margin-top: 0.35rem;
		padding: 0.5rem;
		background: var(--color-failure-bg);
		border: 1px solid var(--color-failure);
		border-radius: 4px;
		font-size: 0.8rem;
		color: var(--color-failure);
	}

	.warning code {
		background: rgba(255, 255, 255, 0.5);
		padding: 0.1rem 0.25rem;
		border-radius: 3px;
	}

	.field-hint {
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		margin-top: 0.35rem;
	}

	.field-hint code {
		background: #f0f0f0;
		padding: 0.1rem 0.25rem;
		border-radius: 3px;
		font-size: 0.75rem;
	}
</style>
