<script lang="ts">
	import { editorStore, isPatchStep, getPatchTarget } from '$lib/stores/editorState.svelte';
	import type { TreeNode, StepTreeGroup } from '$lib/types/editor';

	let searchQuery = $state('');
	let expandedGroups = $state<Set<string>>(new Set());
	let expandedNodes = $state<Set<number>>(new Set()); // Track by stepIndex

	// Filter tree based on search
	function matchesSearch(node: TreeNode): boolean {
		if (!searchQuery) return true;
		const query = searchQuery.toLowerCase();
		const matchesId = node.stepId.toLowerCase().includes(query);
		const matchesText = (node.step.text ?? '').toLowerCase().includes(query);
		return matchesId || matchesText;
	}

	// Check if any node in subtree matches search
	function subtreeMatchesSearch(node: TreeNode): boolean {
		if (matchesSearch(node)) return true;
		return node.children.some((child) => subtreeMatchesSearch(child));
	}

	// Filter groups based on search
	let filteredGroups = $derived.by(() => {
		if (!searchQuery) return editorStore.stepTree.groups;
		return editorStore.stepTree.groups.filter((group) =>
			group.children.some((child) => subtreeMatchesSearch(child))
		);
	});

	let filteredOrphans = $derived.by(() => {
		if (!searchQuery) return editorStore.stepTree.orphans;
		return editorStore.stepTree.orphans.filter((node) => matchesSearch(node));
	});

	let filteredPatches = $derived.by(() => {
		if (!searchQuery) return editorStore.stepTree.patches;
		return editorStore.stepTree.patches.filter((node) => matchesSearch(node));
	});

	// Toggle group expansion
	function toggleGroup(groupId: string) {
		const newExpanded = new Set(expandedGroups);
		if (newExpanded.has(groupId)) {
			newExpanded.delete(groupId);
		} else {
			newExpanded.add(groupId);
		}
		expandedGroups = newExpanded;
	}

	// Toggle node expansion (by stepIndex for uniqueness)
	function toggleNode(stepIndex: number) {
		const newExpanded = new Set(expandedNodes);
		if (newExpanded.has(stepIndex)) {
			newExpanded.delete(stepIndex);
		} else {
			newExpanded.add(stepIndex);
		}
		expandedNodes = newExpanded;
	}

	// Select a step
	function selectStep(stepIndex: number) {
		editorStore.selectStep(stepIndex);
	}

	// Jump to referenced step
	function jumpToStep(stepId: string) {
		const steps = editorStore.questFile?.steps ?? [];
		const index = steps.findIndex((s) => s.id === stepId || s.id === `@patch:${stepId}`);
		if (index >= 0) {
			editorStore.selectStep(index);
		}
	}

	// Get display icon for a node
	function getIcon(node: TreeNode): string {
		if (node.isPatch) return '🩹';
		if (node.isOrphaned) return '⚠️';
		if (node.isLocation) return '📍';
		return '➔';
	}

	// Get reference indicator
	function getRefIndicator(node: TreeNode): string {
		if (node.refType === 'back') return '↩';
		if (node.refType === 'see-above') return '↗';
		return '';
	}

	// Truncate text for preview
	function truncateText(text: string | undefined, maxLen: number = 40): string {
		if (!text) return '';
		const clean = text.replace(/\s+/g, ' ').trim();
		if (clean.length <= maxLen) return clean;
		return clean.substring(0, maxLen) + '...';
	}

	// Get key tags preview
	function getTagsPreview(node: TreeNode): string {
		const tags = node.step.tags ?? [];
		const keyTags = tags.filter((t) => t.startsWith('@') || t.startsWith('!')).slice(0, 2);
		if (keyTags.length === 0) return '';
		return `[${keyTags.join(', ')}]`;
	}

	// Expand all on search
	$effect(() => {
		if (searchQuery) {
			// Expand all groups and nodes that match
			const newExpandedGroups = new Set<string>();
			const newExpandedNodes = new Set<number>();

			for (const group of editorStore.stepTree.groups) {
				if (group.children.some((child) => subtreeMatchesSearch(child))) {
					newExpandedGroups.add(group.rootId + '-' + group.children[0]?.stepIndex);
					// Expand all matching subtrees (by stepIndex)
					function expandMatching(node: TreeNode) {
						if (subtreeMatchesSearch(node)) {
							newExpandedNodes.add(node.stepIndex);
							node.children.forEach(expandMatching);
						}
					}
					group.children.forEach(expandMatching);
				}
			}

			expandedGroups = newExpandedGroups;
			expandedNodes = newExpandedNodes;
		}
	});

	// Add new step
	function addStep() {
		const newStep = {
			id: 'new_step',
			tags: [],
			text: 'New step text here...'
		};
		const index = editorStore.addStep(newStep);
		editorStore.selectStep(index);
	}

	// Add new patch
	function addPatch() {
		const newPatch = {
			id: '@patch:',
			tags: [],
			text: {} as unknown as string
		};
		const index = editorStore.addStep(newPatch);
		editorStore.selectStep(index);
	}
</script>

<div class="step-list">
	<div class="step-list-header">
		<h2>Step List</h2>
		<input
			type="text"
			placeholder="Search steps..."
			bind:value={searchQuery}
			class="search-input"
		/>
	</div>

	<div class="step-tree">
		{#each filteredGroups as group, idx (group.rootId + '-' + (group.children[0]?.stepIndex ?? idx))}
			{@const groupKey = group.rootId + '-' + (group.children[0]?.stepIndex ?? idx)}
			{@const rootNode = group.children[0]}
			{@const hasChildren = rootNode?.children.length > 0}
			{@const isExpanded = expandedGroups.has(groupKey)}
			<div class="tree-group">
				<div
					class="group-header"
					class:selected={rootNode && editorStore.selectedStepIndex === rootNode.stepIndex}
				>
					{#if hasChildren}
						<button
							class="expand-btn"
							onclick={() => toggleGroup(groupKey)}
							aria-label={isExpanded ? 'Collapse' : 'Expand'}
						>
							{isExpanded ? '▼' : '▶'}
						</button>
					{:else}
						<span class="expand-placeholder"></span>
					{/if}

					<button
						class="group-content"
						onclick={() => rootNode && selectStep(rootNode.stepIndex)}
					>
						<span class="node-icon">{rootNode?.isLocation ? '📍' : '➔'}</span>
						<span class="group-label">{group.rootId}</span>
						{#if group.keyTags.length > 0}
							<span class="group-tags">[{group.keyTags.join(', ')}]</span>
						{/if}
						<span class="node-preview">{truncateText(rootNode?.step.text)}</span>
						<span class="step-count">({group.stepCount})</span>
					</button>
				</div>

				{#if isExpanded && rootNode}
					<div class="group-children">
						{#each rootNode.children as child (child.stepIndex)}
							{@render treeNode(child, 0)}
						{/each}
					</div>
				{/if}
			</div>
		{/each}

		{#if filteredOrphans.length > 0}
			<div class="tree-group orphaned-group">
				<button
					class="group-header"
					onclick={() => toggleGroup('__orphaned__')}
					aria-expanded={expandedGroups.has('__orphaned__')}
				>
					<span class="expand-icon">{expandedGroups.has('__orphaned__') ? '▼' : '▶'}</span>
					<span class="group-label">Orphaned</span>
					<span class="step-count warning">({filteredOrphans.length})</span>
				</button>

				{#if expandedGroups.has('__orphaned__')}
					<div class="group-children">
						{#each filteredOrphans as node (node.stepIndex)}
							<button
								class="tree-node orphan"
								class:selected={editorStore.selectedStepIndex === node.stepIndex}
								onclick={() => selectStep(node.stepIndex)}
							>
								<span class="node-icon">{getIcon(node)}</span>
								<span class="node-id">{node.stepId}</span>
								<span class="node-preview">{truncateText(node.step.text)}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		{#if filteredPatches.length > 0}
			<div class="tree-group">
				<button
					class="group-header"
					onclick={() => toggleGroup('__patches__')}
					aria-expanded={expandedGroups.has('__patches__')}
				>
					<span class="expand-icon">{expandedGroups.has('__patches__') ? '▼' : '▶'}</span>
					<span class="group-label">Patches</span>
					<span class="step-count">({filteredPatches.length})</span>
				</button>

				{#if expandedGroups.has('__patches__')}
					<div class="group-children">
						{#each filteredPatches as node (node.stepIndex)}
							<button
								class="tree-node"
								class:selected={editorStore.selectedStepIndex === node.stepIndex}
								onclick={() => selectStep(node.stepIndex)}
							>
								<span class="node-icon">{getIcon(node)}</span>
								<span class="node-id">{getPatchTarget(node.step)}</span>
								{#if node.step.tags?.length}
									<span class="node-tags">{getTagsPreview(node)}</span>
								{/if}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<div class="step-list-actions">
		<button class="add-step-btn" onclick={addStep}>+ Add Step</button>
		<button class="add-patch-btn" onclick={addPatch}>+ Add Patch</button>
	</div>
</div>

{#snippet treeNode(node: TreeNode, depth: number)}
	{@const hasChildren = node.children.length > 0}
	{@const isExpanded = expandedNodes.has(node.stepIndex)}
	{@const isRef = node.refType === 'back' || node.refType === 'see-above'}
	{@const matchesFilter = !searchQuery || matchesSearch(node)}

	{#if matchesFilter || subtreeMatchesSearch(node)}
		<div class="tree-node-container" style="--depth: {depth}">
			<div
				class="tree-node"
				class:selected={editorStore.selectedStepIndex === node.stepIndex}
				class:is-ref={isRef}
				class:location={node.isLocation}
			>
				{#if hasChildren && !isRef}
					<button
						class="expand-btn"
						onclick={() => toggleNode(node.stepIndex)}
						aria-label={isExpanded ? 'Collapse' : 'Expand'}
					>
						{isExpanded ? '▼' : '▶'}
					</button>
				{:else}
					<span class="expand-placeholder"></span>
				{/if}

				<button
					class="node-content"
					onclick={() => (isRef ? jumpToStep(node.stepId) : selectStep(node.stepIndex))}
				>
					{#if isRef}
						<span class="ref-indicator">{getRefIndicator(node)}</span>
					{/if}

					<span class="node-icon">{getIcon(node)}</span>
					<span class="node-id">{node.stepId}</span>

					{#if node.step.tags?.length && !isRef}
						<span class="node-tags">{getTagsPreview(node)}</span>
					{/if}

					{#if isRef}
						<span class="ref-label">({node.refType === 'back' ? 'back' : 'see above'})</span>
					{:else}
						<span class="node-preview">{truncateText(node.step.text)}</span>
					{/if}
				</button>
			</div>

			{#if hasChildren && isExpanded && !isRef}
				<div class="node-children">
					{#each node.children as child (child.stepIndex)}
						{@render treeNode(child, depth + 1)}
					{/each}
				</div>
			{/if}
		</div>
	{/if}
{/snippet}

<style>
	.step-list {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	.step-list-header {
		padding: 0.75rem;
		border-bottom: 1px solid var(--color-border);
	}

	.step-list-header h2 {
		font-size: 1rem;
		margin: 0 0 0.5rem 0;
	}

	.search-input {
		width: 100%;
		padding: 0.5rem;
		font-family: inherit;
		font-size: 0.85rem;
		border: 1px solid var(--color-border);
		border-radius: 4px;
	}

	.search-input:focus {
		outline: none;
		border-color: var(--color-accent);
	}

	.step-tree {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem;
	}

	.tree-group {
		margin-bottom: 0.25rem;
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		width: 100%;
		padding: 0.35rem 0.5rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		font-size: 0.85rem;
	}

	.group-header:hover {
		background: #f5f5f5;
		border-color: var(--color-border);
	}

	.group-header.selected {
		background: var(--color-accent);
		color: white;
		border-color: var(--color-accent);
	}

	.group-header.selected .group-tags,
	.group-header.selected .node-preview,
	.group-header.selected .step-count {
		color: rgba(255, 255, 255, 0.8);
	}

	.group-content {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex: 1;
		min-width: 0;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		font-family: inherit;
		font-size: inherit;
		color: inherit;
		text-align: left;
	}

	.group-label {
		font-weight: bold;
	}

	.group-tags {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		font-family: monospace;
	}

	.step-count {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		margin-left: auto;
	}

	.step-count.warning {
		color: var(--color-failure);
	}

	.group-children {
		padding-left: 0.5rem;
		border-left: 1px solid var(--color-border);
		margin-left: 0.75rem;
		margin-top: 0.25rem;
	}

	.tree-node-container {
		margin-bottom: 2px;
	}

	.tree-node {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		width: 100%;
		padding: 0.35rem 0.5rem;
		background: white;
		border: 1px solid transparent;
		border-radius: 4px;
		font-size: 0.8rem;
		overflow: hidden;
	}

	.tree-node:hover {
		background: var(--color-surface);
		border-color: var(--color-border);
	}

	.tree-node.selected {
		background: var(--color-accent);
		color: white;
		border-color: var(--color-accent);
	}

	.tree-node.is-ref {
		opacity: 0.7;
		font-style: italic;
	}

	.tree-node.location .node-id {
		font-weight: bold;
	}

	.tree-node.orphan {
		background: #fff8e6;
		border-color: var(--color-failure);
	}

	.node-content {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex: 1;
		min-width: 0;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		font-family: inherit;
		font-size: inherit;
		color: inherit;
		text-align: left;
	}

	.expand-btn {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		font-size: 0.65rem;
		width: 1rem;
		color: var(--color-text-secondary);
	}

	.expand-placeholder {
		width: 1rem;
	}

	.ref-indicator {
		font-size: 0.85rem;
		color: var(--color-accent);
	}

	.node-icon {
		font-size: 0.75rem;
	}

	.node-id {
		font-family: monospace;
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.node-tags {
		font-size: 0.7rem;
		color: var(--color-text-secondary);
		font-family: monospace;
		white-space: nowrap;
	}

	.tree-node.selected .node-tags {
		color: rgba(255, 255, 255, 0.8);
	}

	.node-preview {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
		min-width: 0;
	}

	.tree-node.selected .node-preview {
		color: rgba(255, 255, 255, 0.8);
	}

	.ref-label {
		font-size: 0.7rem;
		color: var(--color-text-secondary);
		font-style: italic;
	}

	.tree-node.selected .ref-label {
		color: rgba(255, 255, 255, 0.8);
	}

	.node-children {
		padding-left: 1rem;
		border-left: 1px dotted var(--color-border);
		margin-left: 0.5rem;
	}

	.orphaned-group .group-header {
		background: #fff8e6;
	}

	.step-list-actions {
		padding: 0.75rem;
		border-top: 1px solid var(--color-border);
		display: flex;
		gap: 0.5rem;
	}

	.add-step-btn,
	.add-patch-btn {
		flex: 1;
		padding: 0.5rem;
		font-family: inherit;
		font-size: 0.85rem;
		border-radius: 4px;
		cursor: pointer;
	}

	.add-step-btn {
		background: var(--color-button);
		color: var(--color-button-text);
		border: none;
	}

	.add-step-btn:hover {
		opacity: 0.9;
	}

	.add-patch-btn {
		background: #fff8e6;
		color: var(--color-accent);
		border: 1px dashed var(--color-accent);
	}

	.add-patch-btn:hover {
		background: var(--color-accent);
		color: white;
		border-style: solid;
	}
</style>
