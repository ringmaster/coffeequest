<script lang="ts">
	import { SvelteFlow, Background, Controls, MiniMap } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import html2canvas from 'html2canvas';
	import { jsPDF } from 'jspdf';
	import StepNode from './StepNode.svelte';
	import { editorStore } from '$lib/stores/editorState.svelte';
	import { transformTreeToFlow, type FlowStepData, type FlowEdgeData } from './flowTransform';
	import type { Node, Edge, NodeTypes } from '@xyflow/svelte';

	let { open = $bindable(false) }: { open: boolean } = $props();

	const nodeTypes: NodeTypes = {
		step: StepNode
	};

	// Track hovered node for edge highlighting
	let hoveredNodeId = $state<string | null>(null);
	let exporting = $state(false);
	let flowContainer: HTMLDivElement | null = $state(null);

	// Track hovered edge for tooltip
	let hoveredEdge = $state<{ data: FlowEdgeData; x: number; y: number } | null>(null);

	// Transform stepTree to Svelte Flow format when modal is open
	let flowData = $derived.by(() => {
		if (!open || !editorStore.questFile) {
			return { nodes: [] as Node<FlowStepData>[], edges: [] as Edge<FlowEdgeData>[] };
		}
		return transformTreeToFlow(editorStore.stepTree, editorStore.questFile.option_presets);
	});

	// Inject hover handlers into node data
	let nodes = $derived(flowData.nodes.map(node => ({
		...node,
		data: {
			...node.data,
			onHover: (nodeId: string | null) => { hoveredNodeId = nodeId; }
		}
	})));

	// Apply edge highlighting based on hovered node
	let edges = $derived.by((): Edge<FlowEdgeData>[] => {
		return flowData.edges.map(edge => {
			if (!hoveredNodeId) return edge;

			const isConnected = edge.source === hoveredNodeId || edge.target === hoveredNodeId;
			return {
				...edge,
				style: isConnected
					? `${edge.style}; stroke-width: 3px; opacity: 1;`
					: `${edge.style}; opacity: 0.15;`,
				zIndex: isConnected ? 1000 : 0
			};
		});
	});

	// Handle node click - navigate to step in editor
	function handleNodeClick({ node }: { node: Node<FlowStepData>; event: MouseEvent | TouchEvent }) {
		const stepIndex = (node.data as FlowStepData).stepIndex;
		editorStore.selectStep(stepIndex);
		open = false;
	}

	// Handle edge hover - show tooltip with option details
	function handleEdgePointerEnter({ edge, event }: { edge: Edge<FlowEdgeData>; event: PointerEvent }) {
		if (edge.data) {
			hoveredEdge = {
				data: edge.data,
				x: event.clientX,
				y: event.clientY
			};
		}
	}

	function handleEdgePointerLeave() {
		hoveredEdge = null;
	}

	// Close modal
	function closeModal() {
		open = false;
	}

	// Handle escape key
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closeModal();
		}
	}

	// Export to PDF
	async function exportToPdf() {
		if (!flowContainer || exporting) return;

		exporting = true;

		try {
			// Find the viewport element within the flow container
			const viewport = flowContainer.querySelector('.svelte-flow__viewport') as HTMLElement;
			if (!viewport) {
				throw new Error('Could not find flow viewport');
			}

			// Get the bounds of all nodes to calculate the full graph size
			const nodeElements = flowContainer.querySelectorAll('.svelte-flow__node');
			if (nodeElements.length === 0) {
				throw new Error('No nodes to export');
			}

			let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

			// Calculate bounds from node positions
			for (const node of nodes) {
				const x = node.position.x;
				const y = node.position.y;
				minX = Math.min(minX, x);
				minY = Math.min(minY, y);
				maxX = Math.max(maxX, x + 220); // node width
				maxY = Math.max(maxY, y + 100); // approximate node height
			}

			// Add padding
			const padding = 50;
			minX -= padding;
			minY -= padding;
			maxX += padding;
			maxY += padding;

			const graphWidth = maxX - minX;
			const graphHeight = maxY - minY;

			// Create a temporary container for rendering
			const tempContainer = document.createElement('div');
			tempContainer.style.position = 'absolute';
			tempContainer.style.left = '-9999px';
			tempContainer.style.top = '-9999px';
			tempContainer.style.width = `${graphWidth}px`;
			tempContainer.style.height = `${graphHeight}px`;
			tempContainer.style.background = 'white';
			tempContainer.style.overflow = 'visible';
			document.body.appendChild(tempContainer);

			// Collect computed styles from original SVG paths before cloning
			const originalEdgesSvg = viewport.querySelector('.svelte-flow__edges') as SVGElement;
			const pathStyles: Map<number, { stroke: string; strokeWidth: string; strokeDasharray: string }> = new Map();
			if (originalEdgesSvg) {
				const originalPaths = originalEdgesSvg.querySelectorAll('.svelte-flow__edge path.svelte-flow__edge-path');
				originalPaths.forEach((path, index) => {
					const computed = window.getComputedStyle(path);
					pathStyles.set(index, {
						stroke: computed.stroke || '#5a4a3a',
						strokeWidth: computed.strokeWidth || '1.5px',
						strokeDasharray: computed.strokeDasharray || 'none'
					});
				});
			}

			// Clone the viewport content
			const clone = viewport.cloneNode(true) as HTMLElement;
			clone.style.transform = `translate(${-minX}px, ${-minY}px)`;

			// Ensure edges SVG is properly visible with inlined styles
			const edgesSvg = clone.querySelector('.svelte-flow__edges') as SVGElement;
			if (edgesSvg) {
				edgesSvg.style.overflow = 'visible';
				// Apply collected styles to cloned paths
				const paths = edgesSvg.querySelectorAll('.svelte-flow__edge path.svelte-flow__edge-path');
				paths.forEach((path, index) => {
					const styles = pathStyles.get(index);
					if (styles) {
						path.setAttribute('stroke', styles.stroke);
						path.setAttribute('stroke-width', styles.strokeWidth);
						if (styles.strokeDasharray !== 'none') {
							path.setAttribute('stroke-dasharray', styles.strokeDasharray);
						}
					}
					path.setAttribute('fill', 'none');
				});
				// Handle arrow markers - inline their fills
				const markers = edgesSvg.querySelectorAll('marker');
				markers.forEach(marker => {
					const markerPath = marker.querySelector('path');
					if (markerPath) {
						const color = marker.getAttribute('fill') || '#5a4a3a';
						markerPath.setAttribute('fill', color);
					}
				});
			}

			tempContainer.appendChild(clone);

			// Render to canvas at high resolution
			const scale = 2; // 2x resolution for crisp PDF
			const canvas = await html2canvas(tempContainer, {
				scale,
				backgroundColor: '#ffffff',
				logging: false,
				width: graphWidth,
				height: graphHeight,
				useCORS: true,
				allowTaint: true,
				foreignObjectRendering: false
			});

			// Clean up temp container
			document.body.removeChild(tempContainer);

			// Create PDF with appropriate page size
			const imgWidth = canvas.width / scale;
			const imgHeight = canvas.height / scale;

			// Use landscape if wider than tall, portrait otherwise
			const orientation = imgWidth > imgHeight ? 'landscape' : 'portrait';

			// Calculate page size to fit the graph (max A3 size for readability)
			const maxPageWidth = orientation === 'landscape' ? 420 : 297; // A3 dimensions in mm
			const maxPageHeight = orientation === 'landscape' ? 297 : 420;

			const scaleToFit = Math.min(
				maxPageWidth / (imgWidth * 0.264583), // px to mm
				maxPageHeight / (imgHeight * 0.264583)
			);

			const pageWidth = Math.min(imgWidth * 0.264583 * scaleToFit, maxPageWidth);
			const pageHeight = Math.min(imgHeight * 0.264583 * scaleToFit, maxPageHeight);

			const pdf = new jsPDF({
				orientation,
				unit: 'mm',
				format: [pageWidth + 20, pageHeight + 20] // Add margins
			});

			// Add title
			pdf.setFontSize(12);
			pdf.text(`Quest Flowchart: ${editorStore.fileName}`, 10, 10);

			// Add the graph image
			const imgData = canvas.toDataURL('image/png');
			pdf.addImage(imgData, 'PNG', 10, 15, pageWidth, pageHeight);

			// Save the PDF
			const fileName = editorStore.fileName.replace(/\.(json|yaml)$/, '') || 'flowchart';
			pdf.save(`${fileName}-flowchart.pdf`);
		} catch (error) {
			console.error('Failed to export PDF:', error);
			alert('Failed to export PDF. See console for details.');
		} finally {
			exporting = false;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay" onclick={closeModal}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>Quest Flowchart</h2>
				<div class="header-info">
					{nodes.length} steps, {edges.length} connections
				</div>
				<button class="export-button" onclick={exportToPdf} disabled={exporting || nodes.length === 0}>
					{#if exporting}
						Exporting...
					{:else}
						<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
							<path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
						</svg>
						Export PDF
					{/if}
				</button>
				<button class="close-button" onclick={closeModal} aria-label="Close">
					<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
						<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
					</svg>
				</button>
			</div>

			<div class="flow-container" bind:this={flowContainer}>
				{#if nodes.length === 0}
					<div class="empty-state">
						<p>No steps to display</p>
						<p class="hint">Add some steps to your quest to see the flowchart</p>
					</div>
				{:else}
					<SvelteFlow
						{nodes}
						{edges}
						{nodeTypes}
						fitView
						minZoom={0.1}
						maxZoom={2}
						onnodeclick={handleNodeClick}
						onedgepointerenter={handleEdgePointerEnter}
						onedgepointerleave={handleEdgePointerLeave}
						class={hoveredNodeId ? 'has-hover' : ''}
					>
						<Background />
						<Controls />
						<MiniMap
							nodeColor={(node) => {
								const data = node.data as unknown as FlowStepData;
								if (data.isLocation) return '#d4af37';
								if (data.isOrphaned) return '#e6a23c';
								if (data.isPatch) return '#9c27b0';
								return '#5a4a3a';
							}}
						/>
					</SvelteFlow>
				{/if}
			</div>

			<div class="modal-footer">
				<div class="legend">
					<span class="legend-item">
						<span class="legend-color location"></span>
						Location
					</span>
					<span class="legend-item">
						<span class="legend-color internal"></span>
						Step
					</span>
					<span class="legend-item">
						<span class="legend-color multi-location"></span>
						Multi-location
					</span>
					<span class="legend-item">
						<span class="legend-color orphan"></span>
						Orphaned
					</span>
					<span class="legend-item">
						<span class="legend-color patch"></span>
						Patch
					</span>
				</div>
				<p class="tip">Hover edges for option details, click nodes to edit</p>
			</div>
		</div>

		{#if hoveredEdge}
			<div
				class="edge-tooltip"
				style="left: {hoveredEdge.x + 12}px; top: {hoveredEdge.y + 12}px;"
			>
				{#if hoveredEdge.data.optionLabel}
					<div class="tooltip-label">{hoveredEdge.data.optionLabel}</div>
				{/if}
				{#if hoveredEdge.data.skillCheck}
					<div class="tooltip-skill">
						<span class="skill-name">
							{Array.isArray(hoveredEdge.data.skillCheck.skill)
								? hoveredEdge.data.skillCheck.skill.join(' / ')
								: hoveredEdge.data.skillCheck.skill}
						</span>
						<span class="skill-dc">DC {hoveredEdge.data.skillCheck.dc}</span>
						<span class="edge-type {hoveredEdge.data.edgeType}">
							{hoveredEdge.data.edgeType === 'pass' ? 'Pass' : hoveredEdge.data.edgeType === 'fail' ? 'Fail' : ''}
						</span>
					</div>
				{/if}
				{#if hoveredEdge.data.optionTags && hoveredEdge.data.optionTags.length > 0}
					<div class="tooltip-tags">
						{#each hoveredEdge.data.optionTags as tag}
							<span class="tooltip-tag" class:grant={tag.startsWith('+')} class:consume={tag.startsWith('-')}>{tag}</span>
						{/each}
					</div>
				{/if}
				{#if !hoveredEdge.data.optionLabel && (!hoveredEdge.data.optionTags || hoveredEdge.data.optionTags.length === 0) && !hoveredEdge.data.skillCheck}
					<div class="tooltip-empty">Default transition</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
	}

	.modal-content {
		background: var(--color-background, #f5f1e8);
		border-radius: 12px;
		width: calc(100vw - 40px);
		height: calc(100vh - 40px);
		display: flex;
		flex-direction: column;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	}

	.modal-header {
		display: flex;
		align-items: center;
		padding: 16px 20px;
		border-bottom: 1px solid var(--color-border, #d4c8b8);
		gap: 16px;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 18px;
		color: var(--color-text, #2c1810);
	}

	.header-info {
		flex: 1;
		font-size: 13px;
		color: var(--color-text-secondary, #5a4a3a);
	}

	.close-button {
		background: none;
		border: none;
		cursor: pointer;
		padding: 4px;
		color: var(--color-text-secondary, #5a4a3a);
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.close-button:hover {
		background: var(--color-surface, #ebe5d8);
		color: var(--color-text, #2c1810);
	}

	.export-button {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		background: var(--color-surface, #ebe5d8);
		color: var(--color-text, #2c1810);
		border: 1px solid var(--color-border, #d4c8b8);
		border-radius: 6px;
		cursor: pointer;
		font-family: inherit;
		font-size: 13px;
	}

	.export-button:hover:not(:disabled) {
		background: var(--color-accent, #d4af37);
		color: white;
		border-color: var(--color-accent, #d4af37);
	}

	.export-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.flow-container {
		flex: 1;
		min-height: 0;
		position: relative;
		background: white;
		width: 100%;
	}

	.empty-state {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		text-align: center;
		color: var(--color-text-secondary, #5a4a3a);
	}

	.empty-state p {
		margin: 0;
	}

	.empty-state .hint {
		font-size: 13px;
		margin-top: 8px;
		opacity: 0.8;
	}

	.modal-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 20px;
		border-top: 1px solid var(--color-border, #d4c8b8);
		font-size: 12px;
	}

	.legend {
		display: flex;
		gap: 16px;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--color-text-secondary, #5a4a3a);
	}

	.legend-color {
		width: 12px;
		height: 12px;
		border-radius: 3px;
		border: 1px solid;
	}

	.legend-color.location {
		background: #fffdf5;
		border-color: var(--color-accent, #d4af37);
		border-width: 2px;
	}

	.legend-color.internal {
		background: white;
		border-color: var(--color-border, #d4c8b8);
	}

	.legend-color.multi-location {
		background: #fff3e0;
		border-color: #e65100;
		border-width: 2px;
	}

	.legend-color.orphan {
		background: #fffbeb;
		border-color: #e6a23c;
	}

	.legend-color.patch {
		background: white;
		border-color: var(--color-accent, #d4af37);
		border-style: dashed;
	}

	.tip {
		margin: 0;
		color: var(--color-text-secondary, #5a4a3a);
		font-style: italic;
	}

	/* Override Svelte Flow styles to match theme */
	:global(.svelte-flow) {
		background: #fafafa !important;
	}

	:global(.svelte-flow__controls) {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		border-radius: 6px;
		overflow: hidden;
	}

	:global(.svelte-flow__controls-button) {
		background: white;
		border-bottom: 1px solid var(--color-border, #d4c8b8);
	}

	:global(.svelte-flow__controls-button:hover) {
		background: var(--color-surface, #ebe5d8);
	}

	:global(.svelte-flow__minimap) {
		background: white;
		border-radius: 6px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	:global(.svelte-flow__edge-path) {
		stroke-width: 1.5;
	}

	:global(.svelte-flow__edge.animated path) {
		stroke-dasharray: 5;
		animation: dashdraw 0.5s linear infinite;
	}

	@keyframes dashdraw {
		from {
			stroke-dashoffset: 10;
		}
	}

	/* Edge tooltip styles */
	.edge-tooltip {
		position: fixed;
		z-index: 2000;
		background: white;
		border: 1px solid var(--color-border, #d4c8b8);
		border-radius: 6px;
		padding: 8px 12px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		max-width: 280px;
		pointer-events: none;
		font-size: 12px;
	}

	.tooltip-label {
		font-weight: 600;
		color: var(--color-text, #2c1810);
		margin-bottom: 4px;
	}

	.tooltip-skill {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 4px;
		font-size: 11px;
	}

	.skill-name {
		color: var(--color-text-secondary, #5a4a3a);
		text-transform: capitalize;
	}

	.skill-dc {
		background: var(--color-surface, #ebe5d8);
		padding: 1px 4px;
		border-radius: 3px;
		color: var(--color-text, #2c1810);
	}

	.edge-type {
		padding: 1px 4px;
		border-radius: 3px;
		font-size: 10px;
		font-weight: 600;
	}

	.edge-type.pass {
		background: #e8f5e9;
		color: #2d5016;
	}

	.edge-type.fail {
		background: #ffebee;
		color: #8b3a3a;
	}

	.tooltip-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.tooltip-tag {
		font-size: 10px;
		padding: 2px 5px;
		border-radius: 3px;
		background: var(--color-surface, #ebe5d8);
		color: var(--color-text-secondary, #5a4a3a);
	}

	.tooltip-tag.grant {
		background: #e8f5e9;
		color: #2d5016;
	}

	.tooltip-tag.consume {
		background: #ffebee;
		color: #8b3a3a;
	}

	.tooltip-empty {
		color: var(--color-text-secondary, #5a4a3a);
		font-style: italic;
	}
</style>
