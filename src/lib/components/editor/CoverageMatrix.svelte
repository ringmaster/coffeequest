<script lang="ts">
	import { editorStore } from '$lib/stores/editorState.svelte';
	import type { CoverageRow } from '$lib/types/editor';

	let expanded = $state(false);

	// Get relevant tags for the coverage matrix
	let relevantTags = $derived.by(() => {
		const matrix = editorStore.coverageMatrix;
		if (matrix.length === 0) return [];
		// Extract tag names from first row
		return Object.keys(matrix[0].tagValues);
	});

	// Summary stats
	let stats = $derived.by(() => {
		const matrix = editorStore.coverageMatrix;
		return {
			total: matrix.length,
			single: matrix.filter((r) => r.status === 'single').length,
			none: matrix.filter((r) => r.status === 'none').length,
			ambiguous: matrix.filter((r) => r.status === 'ambiguous').length
		};
	});

	function setTagsFromRow(row: CoverageRow) {
		const tags = new Set<string>();
		for (const [tag, value] of Object.entries(row.tagValues)) {
			if (value === true) {
				tags.add(tag);
			}
		}
		editorStore.setActiveTags(tags);
	}

	function getStatusClass(status: CoverageRow['status']): string {
		switch (status) {
			case 'single':
				return 'status-single';
			case 'none':
				return 'status-none';
			case 'ambiguous':
				return 'status-ambiguous';
			default:
				return 'status-default';
		}
	}

	function getStatusLabel(row: CoverageRow): string {
		switch (row.status) {
			case 'single':
				return row.matches[0];
			case 'none':
				return 'No match';
			case 'ambiguous':
				return `${row.matches.length} steps`;
			default:
				return 'Default';
		}
	}
</script>

{#if editorStore.selectedLocation && relevantTags.length > 0}
	<div class="coverage-matrix">
		<button class="matrix-header" onclick={() => (expanded = !expanded)}>
			<span class="expand-icon">{expanded ? '▼' : '▶'}</span>
			<span class="title">Coverage Matrix</span>
			<span class="stats">
				{#if stats.none > 0}
					<span class="stat-badge gap">{stats.none} gaps</span>
				{/if}
				{#if stats.ambiguous > 0}
					<span class="stat-badge ambiguous">{stats.ambiguous} ambiguous</span>
				{/if}
				{#if stats.none === 0 && stats.ambiguous === 0}
					<span class="stat-badge ok">All covered</span>
				{/if}
			</span>
		</button>

		{#if expanded}
			<div class="matrix-content">
				<p class="matrix-hint">
					Click a row to set those tags as your current filter state.
				</p>

				<div class="matrix-scroll">
					<table>
						<thead>
							<tr>
								{#each relevantTags as tag}
									<th class="tag-col">{tag}</th>
								{/each}
								<th class="status-col">Match</th>
							</tr>
						</thead>
						<tbody>
							{#each editorStore.coverageMatrix as row, index}
								<tr
									class={getStatusClass(row.status)}
									onclick={() => setTagsFromRow(row)}
									role="button"
									tabindex="0"
									onkeydown={(e) => e.key === 'Enter' && setTagsFromRow(row)}
								>
									{#each relevantTags as tag}
										<td class="tag-value">
											{#if row.tagValues[tag] === true}
												<span class="has-tag">✓</span>
											{:else if row.tagValues[tag] === false}
												<span class="no-tag">✗</span>
											{:else}
												<span class="any-tag">−</span>
											{/if}
										</td>
									{/each}
									<td class="status-value">
										{getStatusLabel(row)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="matrix-legend">
					<span class="legend-item">
						<span class="legend-color single"></span> Single match
					</span>
					<span class="legend-item">
						<span class="legend-color none"></span> No match (gap)
					</span>
					<span class="legend-item">
						<span class="legend-color ambiguous"></span> Multiple matches
					</span>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.coverage-matrix {
		background: white;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		margin-top: 1rem;
	}

	.matrix-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.75rem;
		background: none;
		border: none;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.9rem;
		text-align: left;
	}

	.matrix-header:hover {
		background: var(--color-surface);
	}

	.expand-icon {
		font-size: 0.7rem;
		color: var(--color-text-secondary);
	}

	.title {
		font-weight: bold;
	}

	.stats {
		margin-left: auto;
		display: flex;
		gap: 0.35rem;
	}

	.stat-badge {
		padding: 0.15rem 0.35rem;
		border-radius: 3px;
		font-size: 0.7rem;
		font-weight: 500;
	}

	.stat-badge.gap {
		background: var(--color-failure-bg);
		color: var(--color-failure);
	}

	.stat-badge.ambiguous {
		background: #fff3e0;
		color: #e65100;
	}

	.stat-badge.ok {
		background: var(--color-success-bg);
		color: var(--color-success);
	}

	.matrix-content {
		border-top: 1px solid var(--color-border);
		padding: 0.75rem;
	}

	.matrix-hint {
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		margin-bottom: 0.75rem;
	}

	.matrix-scroll {
		overflow-x: auto;
		max-height: 300px;
		overflow-y: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8rem;
	}

	th {
		text-align: left;
		padding: 0.35rem 0.5rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		font-weight: 500;
		position: sticky;
		top: 0;
	}

	.tag-col {
		font-family: monospace;
		font-size: 0.75rem;
		white-space: nowrap;
	}

	.status-col {
		min-width: 80px;
	}

	td {
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--color-border);
	}

	tbody tr {
		cursor: pointer;
	}

	tbody tr:hover {
		background: var(--color-surface);
	}

	.tag-value {
		text-align: center;
	}

	.has-tag {
		color: var(--color-success);
		font-weight: bold;
	}

	.no-tag {
		color: var(--color-text-secondary);
	}

	.any-tag {
		color: var(--color-text-secondary);
	}

	.status-value {
		font-family: monospace;
		font-size: 0.75rem;
	}

	/* Row status styling */
	.status-single {
		background: var(--color-success-bg);
	}

	.status-none {
		background: var(--color-failure-bg);
	}

	.status-none .status-value {
		color: var(--color-failure);
		font-weight: bold;
	}

	.status-ambiguous {
		background: #fff3e0;
	}

	.status-ambiguous .status-value {
		color: #e65100;
	}

	.matrix-legend {
		display: flex;
		gap: 1rem;
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--color-border);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.legend-color {
		width: 12px;
		height: 12px;
		border-radius: 2px;
	}

	.legend-color.single {
		background: var(--color-success-bg);
		border: 1px solid var(--color-success);
	}

	.legend-color.none {
		background: var(--color-failure-bg);
		border: 1px solid var(--color-failure);
	}

	.legend-color.ambiguous {
		background: #fff3e0;
		border: 1px solid #e65100;
	}
</style>
