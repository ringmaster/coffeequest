<script lang="ts">
	import { editorStore } from '$lib/stores/editorState.svelte';
	import { lintQuestFile } from '$lib/editor/lint';
	import type { LintResult, LintSeverity } from '$lib/types/editor';

	let expanded = $state(false);
	let lintTimeout: ReturnType<typeof setTimeout> | null = null;

	// Lint summary
	let summary = $derived.by(() => {
		const results = editorStore.lintResults;
		return {
			errors: results.filter((r) => r.severity === 'error').length,
			warnings: results.filter((r) => r.severity === 'warning').length,
			info: results.filter((r) => r.severity === 'info').length,
			total: results.length
		};
	});

	// Group results by severity
	let groupedResults = $derived.by(() => {
		const results = editorStore.lintResults;
		return {
			errors: results.filter((r) => r.severity === 'error'),
			warnings: results.filter((r) => r.severity === 'warning'),
			info: results.filter((r) => r.severity === 'info')
		};
	});

	// Debounced lint on file change
	$effect(() => {
		if (editorStore.questFile && editorStore.isDirty) {
			if (lintTimeout) clearTimeout(lintTimeout);
			editorStore.setLintPending(true);
			lintTimeout = setTimeout(() => {
				runLint();
			}, 3000);
		}
	});

	function runLint() {
		if (!editorStore.questFile) return;
		const results = lintQuestFile(editorStore.questFile, editorStore.locations);
		editorStore.setLintResults(results);
	}

	function getSeverityIcon(severity: LintSeverity): string {
		switch (severity) {
			case 'error':
				return '✕';
			case 'warning':
				return '⚠';
			case 'info':
				return 'ℹ';
		}
	}

	function getSeverityClass(severity: LintSeverity): string {
		return `severity-${severity}`;
	}

	function navigateToStep(result: LintResult) {
		if (result.stepIndex !== undefined) {
			editorStore.selectStep(result.stepIndex);
			// Also try to select the location
			const step = editorStore.questFile?.steps[result.stepIndex];
			if (step) {
				editorStore.selectLocation(step.id);
			}
		}
	}

	function navigateToRelatedStep(result: LintResult, event: MouseEvent) {
		event.stopPropagation();
		if (result.relatedStepIndex !== undefined) {
			editorStore.selectStep(result.relatedStepIndex);
		}
	}
</script>

{#if editorStore.questFile}
	<div class="lint-panel">
		<div class="lint-header">
			<button class="lint-toggle" onclick={() => (expanded = !expanded)}>
				<div class="lint-status">
					{#if editorStore.lintPending}
						<span class="pending">Checking...</span>
					{:else if summary.errors > 0}
						<span class="status-icon error">✕</span>
						<span class="status-text">{summary.errors} error{summary.errors > 1 ? 's' : ''}</span>
					{:else if summary.warnings > 0}
						<span class="status-icon warning">⚠</span>
						<span class="status-text">{summary.warnings} warning{summary.warnings > 1 ? 's' : ''}</span>
					{:else if summary.info > 0}
						<span class="status-icon info">ℹ</span>
						<span class="status-text">{summary.info} suggestion{summary.info > 1 ? 's' : ''}</span>
					{:else}
						<span class="status-icon ok">✓</span>
						<span class="status-text">No issues</span>
					{/if}
				</div>
				<span class="expand-icon">{expanded ? '▼' : '▲'}</span>
			</button>

			<div class="lint-actions">
				<button class="run-lint-btn" onclick={() => runLint()}>
					Run Lint
				</button>
			</div>
		</div>

		{#if expanded && summary.total > 0}
			<div class="lint-content">
				{#if groupedResults.errors.length > 0}
					<div class="lint-group">
						<h3 class="group-header error">Errors ({groupedResults.errors.length})</h3>
						<ul class="lint-list">
							{#each groupedResults.errors as result}
								<li class="lint-item error">
									<button class="lint-button" onclick={() => navigateToStep(result)}>
										<span class="lint-icon">{getSeverityIcon(result.severity)}</span>
										<span class="lint-message">{result.message}</span>
										{#if result.stepId}
											<span class="lint-location">{result.stepId}</span>
										{/if}
									</button>
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if groupedResults.warnings.length > 0}
					<div class="lint-group">
						<h3 class="group-header warning">Warnings ({groupedResults.warnings.length})</h3>
						<ul class="lint-list">
							{#each groupedResults.warnings as result}
								<li class="lint-item warning">
									<button class="lint-button" onclick={() => navigateToStep(result)}>
										<span class="lint-icon">{getSeverityIcon(result.severity)}</span>
										<span class="lint-message">{result.message}</span>
										{#if result.stepId}
											<span class="lint-location">{result.stepId}</span>
										{/if}
									</button>
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if groupedResults.info.length > 0}
					<div class="lint-group">
						<h3 class="group-header info">Suggestions ({groupedResults.info.length})</h3>
						<ul class="lint-list">
							{#each groupedResults.info as result}
								<li class="lint-item info">
									<div class="lint-row">
										<button class="lint-button" onclick={() => navigateToStep(result)}>
											<span class="lint-icon">{getSeverityIcon(result.severity)}</span>
											<span class="lint-message">{result.message}</span>
											{#if result.stepId}
												<span class="lint-location">{result.stepId}</span>
											{/if}
										</button>
										{#if result.relatedStepId !== undefined}
											<button
												class="related-step-link"
												onclick={(e) => navigateToRelatedStep(result, e)}
												title="Go to step: {result.relatedStepId}"
											>
												→ {result.relatedStepId}
											</button>
										{/if}
									</div>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.lint-panel {
		background: var(--color-surface);
		border-top: 1px solid var(--color-border);
		position: sticky;
		bottom: 0;
	}

	.lint-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 1rem 0 0;
	}

	.lint-toggle {
		flex: 1;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 1rem;
		background: none;
		border: none;
		cursor: pointer;
		font-family: inherit;
	}

	.lint-toggle:hover {
		background: rgba(0, 0, 0, 0.03);
	}

	.lint-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
	}

	.status-icon {
		font-weight: bold;
	}

	.status-icon.error {
		color: var(--color-failure);
	}

	.status-icon.warning {
		color: #e65100;
	}

	.status-icon.info {
		color: #1565c0;
	}

	.status-icon.ok {
		color: var(--color-success);
	}

	.pending {
		color: var(--color-text-secondary);
		font-style: italic;
	}

	.lint-actions {
		display: flex;
		align-items: center;
	}

	.run-lint-btn {
		padding: 0.25rem 0.5rem;
		background: white;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		font-family: inherit;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.run-lint-btn:hover {
		background: var(--color-surface);
	}

	.expand-icon {
		font-size: 0.7rem;
		color: var(--color-text-secondary);
	}

	.lint-content {
		max-height: 250px;
		overflow-y: auto;
		border-top: 1px solid var(--color-border);
		padding: 0.5rem;
	}

	.lint-group {
		margin-bottom: 0.5rem;
	}

	.lint-group:last-child {
		margin-bottom: 0;
	}

	.group-header {
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.25rem 0.5rem;
		margin: 0 0 0.25rem 0;
		border-radius: 3px;
	}

	.group-header.error {
		background: var(--color-failure-bg);
		color: var(--color-failure);
	}

	.group-header.warning {
		background: #fff3e0;
		color: #e65100;
	}

	.group-header.info {
		background: #e3f2fd;
		color: #1565c0;
	}

	.lint-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.lint-item {
		margin-bottom: 0.15rem;
	}

	.lint-button {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		width: 100%;
		padding: 0.35rem 0.5rem;
		background: white;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.8rem;
		text-align: left;
	}

	.lint-button:hover {
		background: var(--color-surface);
	}

	.lint-icon {
		flex-shrink: 0;
	}

	.lint-item.error .lint-icon {
		color: var(--color-failure);
	}

	.lint-item.warning .lint-icon {
		color: #e65100;
	}

	.lint-item.info .lint-icon {
		color: #1565c0;
	}

	.lint-message {
		flex: 1;
		line-height: 1.3;
	}

	.lint-location {
		flex-shrink: 0;
		font-family: monospace;
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		background: var(--color-surface);
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
	}

	.lint-row {
		display: flex;
		align-items: stretch;
		gap: 0.25rem;
	}

	.lint-row .lint-button {
		flex: 1;
	}

	.related-step-link {
		flex-shrink: 0;
		padding: 0.35rem 0.5rem;
		background: #e3f2fd;
		border: 1px solid #1565c0;
		border-radius: 4px;
		cursor: pointer;
		font-family: monospace;
		font-size: 0.75rem;
		color: #1565c0;
		white-space: nowrap;
	}

	.related-step-link:hover {
		background: #1565c0;
		color: white;
	}
</style>
