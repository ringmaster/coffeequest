<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import type { FlowStepData } from './flowTransform';

	let { id, data, selected }: { id: string; data: FlowStepData & { onHover?: (id: string | null) => void }; selected?: boolean } = $props();

	// Calculate handle positions spread across the node width
	function getHandleOffset(index: number, total: number): number {
		if (total <= 1) return 50; // Center
		const padding = 15; // % from edges
		const range = 100 - (padding * 2);
		return padding + (index / (total - 1)) * range;
	}

	function handleMouseEnter() {
		data.onHover?.(id);
	}

	function handleMouseLeave() {
		data.onHover?.(null);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="step-node"
	class:location={data.isLocation}
	class:orphan={data.isOrphaned}
	class:patch={data.isPatch}
	class:back-ref={data.refType === 'back'}
	class:multi-location={data.isMultiLocation}
	class:selected
	onmouseenter={handleMouseEnter}
	onmouseleave={handleMouseLeave}
>
	<!-- Incoming handles spread across top -->
	{#if data.incomingHandles.length === 0}
		<Handle type="target" position={Position.Top} />
	{:else}
		{#each data.incomingHandles as handleId, i}
			<Handle
				type="target"
				position={Position.Top}
				id={handleId}
				style="left: {getHandleOffset(i, data.incomingHandles.length)}%"
			/>
		{/each}
	{/if}

	<div class="node-header">
		<span class="node-icon">
			{#if data.isLocation}
				<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
					<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
				</svg>
			{:else if data.isPatch}
				<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
					<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14h-2v-4H6v-2h4V7h2v4h4v2h-4v4z"/>
				</svg>
			{:else if data.isOrphaned}
				<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
					<path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
				</svg>
			{:else if data.refType === 'back'}
				<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
					<path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
				</svg>
			{:else}
				<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
					<path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
				</svg>
			{/if}
		</span>
		<span class="step-id">{data.stepId}</span>
		{#if data.hasSkillCheck}
			<span class="skill-badge" title="Has skill check">
				<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
					<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM7.5 18c-.83 0-1.5-.67-1.5-1.5S6.67 15 7.5 15s1.5.67 1.5 1.5S8.33 18 7.5 18zm0-9C6.67 9 6 8.33 6 7.5S6.67 6 7.5 6 9 6.67 9 7.5 8.33 9 7.5 9zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm0-9c-.83 0-1.5-.67-1.5-1.5S15.67 6 16.5 6s1.5.67 1.5 1.5S17.33 9 16.5 9z"/>
				</svg>
			</span>
		{/if}
	</div>

	{#if data.text}
		<div class="node-preview">{data.text}</div>
	{/if}

	{#if data.keyTags.length > 0}
		<div class="node-tags">
			{#each data.keyTags as tag}
				<span class="tag" class:required={tag.startsWith('@')} class:blocked={tag.startsWith('!')}>
					{tag}
				</span>
			{/each}
		</div>
	{/if}

	<!-- Outgoing handles spread across bottom -->
	{#if data.outgoingHandles.length === 0}
		<Handle type="source" position={Position.Bottom} />
	{:else}
		{#each data.outgoingHandles as handleId, i}
			<Handle
				type="source"
				position={Position.Bottom}
				id={handleId}
				style="left: {getHandleOffset(i, data.outgoingHandles.length)}%"
			/>
		{/each}
	{/if}
</div>

<style>
	.step-node {
		background: white;
		border: 1px solid var(--color-border, #d4c8b8);
		border-radius: 8px;
		padding: 10px 12px;
		min-width: 180px;
		max-width: 220px;
		font-family: system-ui, -apple-system, sans-serif;
		font-size: 12px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		transition: box-shadow 0.2s, border-color 0.2s;
	}

	.step-node:hover {
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
	}

	.step-node.selected {
		border-color: var(--color-accent, #d4af37);
		box-shadow: 0 0 0 2px var(--color-accent, #d4af37);
	}

	.step-node.location {
		border-color: var(--color-accent, #d4af37);
		border-width: 2px;
		background: linear-gradient(to bottom, #fffdf5, white);
	}

	.step-node.orphan {
		border-color: #e6a23c;
		background: #fffbeb;
	}

	.step-node.patch {
		border-style: dashed;
		border-color: var(--color-accent, #d4af37);
	}

	.step-node.back-ref {
		border-style: dotted;
		opacity: 0.7;
		background: #f9f9f9;
	}

	.step-node.multi-location {
		border-color: #e65100;
		border-width: 2px;
		background: linear-gradient(to bottom, #fff3e0, white);
		box-shadow: 0 0 0 3px rgba(230, 81, 0, 0.2);
	}

	.node-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 6px;
	}

	.node-icon {
		display: flex;
		align-items: center;
		color: var(--color-text-secondary, #5a4a3a);
	}

	.location .node-icon {
		color: var(--color-accent, #d4af37);
	}

	.orphan .node-icon {
		color: #e6a23c;
	}

	.step-id {
		font-weight: 600;
		color: var(--color-text, #2c1810);
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.skill-badge {
		display: flex;
		align-items: center;
		padding: 2px 4px;
		background: var(--color-surface, #ebe5d8);
		border-radius: 4px;
		color: var(--color-text-secondary, #5a4a3a);
	}

	.node-preview {
		color: var(--color-text-secondary, #5a4a3a);
		font-size: 11px;
		line-height: 1.4;
		overflow: hidden;
		display: -webkit-box;
		line-clamp: 2;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		margin-bottom: 6px;
	}

	.node-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
	}

	.tag {
		font-size: 9px;
		padding: 1px 4px;
		border-radius: 3px;
		background: var(--color-surface, #ebe5d8);
		color: var(--color-text-secondary, #5a4a3a);
	}

	.tag.required {
		background: #e8f5e9;
		color: #2d5016;
	}

	.tag.blocked {
		background: #ffebee;
		color: #8b3a3a;
	}

	:global(.svelte-flow .svelte-flow__handle) {
		width: 8px;
		height: 8px;
		background: var(--color-border, #d4c8b8);
		border: 2px solid white;
	}

	:global(.svelte-flow .svelte-flow__handle-top) {
		top: -4px;
	}

	:global(.svelte-flow .svelte-flow__handle-bottom) {
		bottom: -4px;
	}
</style>
