import dagre from '@dagrejs/dagre';
import { MarkerType, type Node, type Edge } from '@xyflow/svelte';
import type { StepTreeGroup, TreeNode } from '$lib/types/editor';
import type { RawStep, RawStepOption } from '$lib/types/game';

export interface FlowStepData extends Record<string, unknown> {
	stepId: string;
	stepIndex: number;
	text: string;
	isLocation: boolean;
	isPatch: boolean;
	isOrphaned: boolean;
	isMultiLocation?: boolean;
	refType: 'primary' | 'back' | 'see-above' | 'external' | null;
	hasSkillCheck: boolean;
	keyTags: string[];
	optionCount: number;
	// For handle spreading
	incomingHandles: string[];
	outgoingHandles: string[];
}

export interface FlowEdgeData extends Record<string, unknown> {
	edgeType: 'pass' | 'fail' | 'default';
	optionLabel: string;
	optionTags: string[];
	skillCheck?: {
		skill: string | string[];
		dc: number;
	};
}

export interface FlowData {
	nodes: Node<FlowStepData>[];
	edges: Edge<FlowEdgeData>[];
}

interface EdgeInfo {
	targetId: string;
	type: 'pass' | 'fail' | 'default';
	label?: string;
	hasSkillCheck: boolean;
	optionLabel: string;
	optionTags: string[];
	skillCheck?: {
		skill: string | string[];
		dc: number;
	};
}

/**
 * Expand options to handle presets and shorthand
 */
function expandOptions(
	options: RawStepOption[] | string | undefined,
	presets?: Record<string, RawStepOption[]>
): RawStepOption[] {
	if (!options) return [];
	if (typeof options === 'string') {
		return presets?.[options] ?? [];
	}
	return options;
}

/**
 * Parse shorthand option string to extract pass/fail targets
 */
function parseOptionTargets(option: RawStepOption): { pass: string | null; fail: string | null; hasSkillCheck: boolean } {
	if (typeof option === 'string') {
		// "Label::step_id" format
		const match = option.match(/^.+?::(.+)$/);
		return { pass: match ? match[1] : null, fail: null, hasSkillCheck: false };
	}
	return {
		pass: option.pass ?? null,
		fail: option.fail ?? null,
		hasSkillCheck: option.skill !== undefined && option.dc !== undefined
	};
}

/**
 * Get key tags from a step (@ and ! tags for display)
 */
function getKeyTags(step: RawStep): string[] {
	const keyTags: string[] = [];
	for (const rawTag of step.tags ?? []) {
		if (rawTag.startsWith('@') || rawTag.startsWith('!')) {
			keyTags.push(rawTag);
		}
	}
	return keyTags.slice(0, 3);
}

/**
 * Truncate text for node display
 */
function truncateText(text: unknown, maxLength: number = 60): string {
	if (typeof text !== 'string') return '';
	// Remove template variables for cleaner display
	const cleaned = text.replace(/\{\{[^}]+\}\}/g, '...');
	if (cleaned.length <= maxLength) return cleaned;
	return cleaned.substring(0, maxLength - 3) + '...';
}

/**
 * Get the "signature" tags from a step (@ required and ! blocked tags)
 * These define which variant of a step this is
 */
function getSignatureTags(step: RawStep): { required: Set<string>; blocked: Set<string> } {
	const required = new Set<string>();
	const blocked = new Set<string>();

	for (const rawTag of step.tags ?? []) {
		if (rawTag.startsWith('@')) {
			required.add(rawTag.substring(1).split(/[=<>]/)[0]);
		} else if (rawTag.startsWith('!')) {
			blocked.add(rawTag.substring(1).split(/[=<>]/)[0]);
		}
	}

	return { required, blocked };
}

/**
 * Get tags that a step grants (+) or consumes (-)
 */
function getMutationTags(step: RawStep): { grants: Set<string>; consumes: Set<string> } {
	const grants = new Set<string>();
	const consumes = new Set<string>();

	for (const rawTag of step.tags ?? []) {
		if (rawTag.startsWith('+')) {
			grants.add(rawTag.substring(1));
		} else if (rawTag.startsWith('-')) {
			consumes.add(rawTag.substring(1));
		}
	}

	return { grants, consumes };
}

/**
 * Check if a source step could lead to a target step based on tag compatibility
 * Returns true if the tags are compatible (or indeterminate)
 */
function areTagsCompatible(sourceStep: RawStep, targetStep: RawStep): boolean {
	const sourceSig = getSignatureTags(sourceStep);
	const targetSig = getSignatureTags(targetStep);
	const sourceMutations = getMutationTags(sourceStep);

	// If source GRANTS a tag that target BLOCKS, incompatible
	for (const granted of sourceMutations.grants) {
		if (targetSig.blocked.has(granted)) {
			return false;
		}
	}

	// If source CONSUMES a tag that target REQUIRES, incompatible
	for (const consumed of sourceMutations.consumes) {
		if (targetSig.required.has(consumed)) {
			return false;
		}
	}

	// If source BLOCKS a tag that target REQUIRES, incompatible
	// (unless source also GRANTS that tag)
	for (const blocked of sourceSig.blocked) {
		if (targetSig.required.has(blocked) && !sourceMutations.grants.has(blocked)) {
			return false;
		}
	}

	// If source REQUIRES a tag that target BLOCKS, incompatible
	// (unless source CONSUMES that tag)
	for (const required of sourceSig.required) {
		if (targetSig.blocked.has(required) && !sourceMutations.consumes.has(required)) {
			return false;
		}
	}

	return true;
}

/**
 * Get option label from raw option
 */
function getOptionLabel(option: RawStepOption): string {
	if (typeof option === 'string') {
		// "Label::step_id" format - extract the label part
		const match = option.match(/^(.+?)::.+$/);
		return match ? match[1] : option;
	}
	return option.label || '';
}

/**
 * Get option tags from raw option
 */
function getOptionTags(option: RawStepOption): string[] {
	if (typeof option === 'string') {
		return [];
	}
	return option.tags || [];
}

/**
 * Get edge info from step options
 */
function getEdgeInfoFromStep(
	step: RawStep,
	presets?: Record<string, RawStepOption[]>
): EdgeInfo[] {
	const edges: EdgeInfo[] = [];
	const options = expandOptions(step.options, presets);
	const seenTargets = new Map<string, EdgeInfo>(); // Track by target to avoid duplicates but keep info

	for (const option of options) {
		const { pass, fail, hasSkillCheck } = parseOptionTargets(option);
		const optionLabel = getOptionLabel(option);
		const optionTags = getOptionTags(option);
		const skillCheck = typeof option !== 'string' && option.skill && option.dc
			? { skill: option.skill, dc: option.dc }
			: undefined;

		if (pass && !seenTargets.has(pass)) {
			const edgeInfo: EdgeInfo = {
				targetId: pass,
				type: hasSkillCheck ? 'pass' : 'default',
				label: hasSkillCheck ? 'Pass' : undefined,
				hasSkillCheck,
				optionLabel,
				optionTags,
				skillCheck
			};
			seenTargets.set(pass, edgeInfo);
			edges.push(edgeInfo);
		}

		if (fail && !seenTargets.has(fail)) {
			const edgeInfo: EdgeInfo = {
				targetId: fail,
				type: 'fail',
				label: 'Fail',
				hasSkillCheck: true,
				optionLabel,
				optionTags,
				skillCheck
			};
			seenTargets.set(fail, edgeInfo);
			edges.push(edgeInfo);
		}
	}

	return edges;
}

/**
 * Transform stepTree to Svelte Flow format with dagre layout
 */
export function transformTreeToFlow(
	stepTree: { groups: StepTreeGroup[]; orphans: TreeNode[]; patches: TreeNode[] },
	presets?: Record<string, RawStepOption[]>
): FlowData {
	const nodes: Node<FlowStepData>[] = [];
	const edges: Edge<FlowEdgeData>[] = [];
	const processedIndices = new Set<number>();
	const stepIndexToNodeId = new Map<number, string>();

	// Collect all steps and their indices
	// Build a map from step ID to all indices with that ID
	const stepIdToIndices = new Map<string, number[]>();

	// Track which nodes belong to which group (for grouped layout)
	const locationGroups = new Map<string, Set<string>>();
	let currentGroupId = '';

	function collectStepIndices(node: TreeNode): void {
		if (processedIndices.has(node.stepIndex)) return;

		processedIndices.add(node.stepIndex);
		const nodeId = `node-${node.stepIndex}`;
		stepIndexToNodeId.set(node.stepIndex, nodeId);

		// Track ID -> indices mapping
		const indices = stepIdToIndices.get(node.stepId) ?? [];
		indices.push(node.stepIndex);
		stepIdToIndices.set(node.stepId, indices);

		// Add to current group
		if (currentGroupId) {
			const groupNodes = locationGroups.get(currentGroupId) ?? new Set();
			groupNodes.add(nodeId);
			locationGroups.set(currentGroupId, groupNodes);
		}

		// Create node
		const options = expandOptions(node.step.options, presets);
		const hasSkillCheck = options.some((opt) => {
			if (typeof opt === 'string') return false;
			return opt.skill !== undefined && opt.dc !== undefined;
		});

		nodes.push({
			id: nodeId,
			type: 'step',
			position: { x: 0, y: 0 }, // Will be set by dagre
			data: {
				stepId: node.stepId,
				stepIndex: node.stepIndex,
				text: truncateText(node.step.text),
				isLocation: node.isLocation,
				isPatch: node.isPatch,
				isOrphaned: node.isOrphaned,
				refType: node.refType,
				hasSkillCheck,
				keyTags: getKeyTags(node.step),
				optionCount: options.length,
				incomingHandles: [],
				outgoingHandles: []
			}
		});

		// Recurse to children (skip back-refs to avoid infinite loop)
		for (const child of node.children) {
			if (child.refType !== 'back') {
				collectStepIndices(child);
			}
		}
	}

	// Process all groups - each group becomes a location cluster
	for (const group of stepTree.groups) {
		currentGroupId = `group-${group.rootId}`;
		for (const rootNode of group.children) {
			collectStepIndices(rootNode);
		}
	}

	// Process orphans as a separate group
	if (stepTree.orphans.length > 0) {
		currentGroupId = 'orphans';
		for (const orphan of stepTree.orphans) {
			collectStepIndices(orphan);
		}
	}

	// Process patches as a separate group
	if (stepTree.patches.length > 0) {
		currentGroupId = 'patches';
		for (const patch of stepTree.patches) {
			collectStepIndices(patch);
		}
	}

	// Reset for edge creation
	processedIndices.clear();

	// Build a map of nodeId -> node for updating handle arrays
	const nodeById = new Map(nodes.map(n => [n.id, n]));

	// Build a map of stepIndex -> step for tag compatibility checking
	const stepByIndex = new Map<number, RawStep>();
	function collectSteps(node: TreeNode): void {
		stepByIndex.set(node.stepIndex, node.step);
		for (const child of node.children) {
			if (child.refType !== 'back') {
				collectSteps(child);
			}
		}
	}
	for (const group of stepTree.groups) {
		for (const rootNode of group.children) {
			collectSteps(rootNode);
		}
	}
	for (const orphan of stepTree.orphans) {
		collectSteps(orphan);
	}
	for (const patch of stepTree.patches) {
		collectSteps(patch);
	}

	// Track handle counters per node
	const outgoingHandleCount = new Map<string, number>();
	const incomingHandleCount = new Map<string, number>();

	// Create edges based on step options
	function createEdgesFromNode(node: TreeNode): void {
		if (processedIndices.has(node.stepIndex)) return;
		processedIndices.add(node.stepIndex);

		const sourceNodeId = stepIndexToNodeId.get(node.stepIndex);
		if (!sourceNodeId) return;

		const edgeInfos = getEdgeInfoFromStep(node.step, presets);

		for (const edgeInfo of edgeInfos) {
			// Find target indices (there may be multiple steps with same ID)
			const targetIndices = stepIdToIndices.get(edgeInfo.targetId) ?? [];

			for (const targetIndex of targetIndices) {
				const targetNodeId = stepIndexToNodeId.get(targetIndex);
				if (!targetNodeId) continue;

				// Check tag compatibility - skip edges to incompatible steps
				const targetStep = stepByIndex.get(targetIndex);
				if (targetStep && !areTagsCompatible(node.step, targetStep)) {
					continue;
				}

				// Assign unique handles for this edge
				const sourceHandleIdx = outgoingHandleCount.get(sourceNodeId) ?? 0;
				const targetHandleIdx = incomingHandleCount.get(targetNodeId) ?? 0;
				outgoingHandleCount.set(sourceNodeId, sourceHandleIdx + 1);
				incomingHandleCount.set(targetNodeId, targetHandleIdx + 1);

				const sourceHandleId = `source-${sourceHandleIdx}`;
				const targetHandleId = `target-${targetHandleIdx}`;

				// Track handles on nodes
				const sourceNode = nodeById.get(sourceNodeId);
				const targetNode = nodeById.get(targetNodeId);
				if (sourceNode && !sourceNode.data.outgoingHandles.includes(sourceHandleId)) {
					sourceNode.data.outgoingHandles.push(sourceHandleId);
				}
				if (targetNode && !targetNode.data.incomingHandles.includes(targetHandleId)) {
					targetNode.data.incomingHandles.push(targetHandleId);
				}

				const edgeId = `edge-${node.stepIndex}-${targetIndex}-${edgeInfo.type}`;

				edges.push({
					id: edgeId,
					source: sourceNodeId,
					target: targetNodeId,
					sourceHandle: sourceHandleId,
					targetHandle: targetHandleId,
					label: edgeInfo.label,
					type: 'default',
					animated: edgeInfo.type === 'fail',
					style: getEdgeStyle(edgeInfo.type),
					markerEnd: {
						type: MarkerType.ArrowClosed,
						color: getEdgeColor(edgeInfo.type)
					},
					data: {
						edgeType: edgeInfo.type,
						optionLabel: edgeInfo.optionLabel,
						optionTags: edgeInfo.optionTags,
						skillCheck: edgeInfo.skillCheck
					} as FlowEdgeData
				});
			}
		}

		// Recurse to children
		for (const child of node.children) {
			if (child.refType !== 'back') {
				createEdgesFromNode(child);
			}
		}
	}

	// Create edges from all groups
	processedIndices.clear();
	for (const group of stepTree.groups) {
		for (const rootNode of group.children) {
			createEdgesFromNode(rootNode);
		}
	}

	// Detect nodes reachable from multiple location groups (warning state)
	const nodeToGroups = new Map<string, Set<string>>();
	for (const [groupId, nodeIds] of locationGroups) {
		if (groupId === 'orphans' || groupId === 'patches') continue;
		for (const nodeId of nodeIds) {
			const groups = nodeToGroups.get(nodeId) ?? new Set();
			groups.add(groupId);
			nodeToGroups.set(nodeId, groups);
		}
	}

	// Mark nodes reachable from multiple locations
	for (const node of nodes) {
		const groups = nodeToGroups.get(node.id);
		if (groups && groups.size > 1) {
			node.data.isMultiLocation = true;
		}
	}

	// Apply dagre layout with location grouping
	const layoutResult = applyDagreLayout(nodes, edges, locationGroups);

	// Reorder handles based on target positions to minimize crossings
	return reorderHandlesToMinimizeCrossings(layoutResult);
}

/**
 * Reorder handles based on connected node positions to minimize edge crossings
 */
function reorderHandlesToMinimizeCrossings(flowData: FlowData): FlowData {
	const { nodes, edges } = flowData;

	// Build position map
	const nodePositions = new Map<string, { x: number; y: number }>();
	for (const node of nodes) {
		nodePositions.set(node.id, node.position);
	}

	// Group edges by source and target
	const edgesBySource = new Map<string, Edge[]>();
	const edgesByTarget = new Map<string, Edge[]>();

	for (const edge of edges) {
		const sourceEdges = edgesBySource.get(edge.source) ?? [];
		sourceEdges.push(edge);
		edgesBySource.set(edge.source, sourceEdges);

		const targetEdges = edgesByTarget.get(edge.target) ?? [];
		targetEdges.push(edge);
		edgesByTarget.set(edge.target, targetEdges);
	}

	// Reorder outgoing handles: sort by target x-position
	for (const [sourceId, sourceEdges] of edgesBySource) {
		if (sourceEdges.length <= 1) continue;

		// Sort edges by target x-position
		sourceEdges.sort((a, b) => {
			const posA = nodePositions.get(a.target);
			const posB = nodePositions.get(b.target);
			return (posA?.x ?? 0) - (posB?.x ?? 0);
		});

		// Reassign source handles in order
		sourceEdges.forEach((edge, i) => {
			edge.sourceHandle = `source-${i}`;
		});

		// Update node's outgoing handles array
		const node = nodes.find(n => n.id === sourceId);
		if (node) {
			node.data.outgoingHandles = sourceEdges.map((_, i) => `source-${i}`);
		}
	}

	// Reorder incoming handles: sort by source x-position
	for (const [targetId, targetEdges] of edgesByTarget) {
		if (targetEdges.length <= 1) continue;

		// Sort edges by source x-position
		targetEdges.sort((a, b) => {
			const posA = nodePositions.get(a.source);
			const posB = nodePositions.get(b.source);
			return (posA?.x ?? 0) - (posB?.x ?? 0);
		});

		// Reassign target handles in order
		targetEdges.forEach((edge, i) => {
			edge.targetHandle = `target-${i}`;
		});

		// Update node's incoming handles array
		const node = nodes.find(n => n.id === targetId);
		if (node) {
			node.data.incomingHandles = targetEdges.map((_, i) => `target-${i}`);
		}
	}

	return { nodes, edges };
}

/**
 * Get edge color based on type
 */
function getEdgeColor(type: 'pass' | 'fail' | 'default'): string {
	switch (type) {
		case 'pass':
			return '#2d5016';
		case 'fail':
			return '#8b3a3a';
		default:
			return '#5a4a3a';
	}
}

/**
 * Get edge style based on type
 */
function getEdgeStyle(type: 'pass' | 'fail' | 'default'): string {
	switch (type) {
		case 'pass':
			return 'stroke: #2d5016; stroke-width: 2px;';
		case 'fail':
			return 'stroke: #8b3a3a; stroke-width: 2px; stroke-dasharray: 5,5;';
		default:
			return 'stroke: #5a4a3a; stroke-width: 1.5px;';
	}
}

/**
 * Apply dagre layout to position nodes, grouping by location
 */
function applyDagreLayout(
	nodes: Node<FlowStepData>[],
	edges: Edge<FlowEdgeData>[],
	groups?: Map<string, Set<string>>
): FlowData {
	if (nodes.length === 0) {
		return { nodes: [], edges: [] };
	}

	const nodeWidth = 220;
	const nodeHeight = 90;

	// If no groups provided, layout all nodes together
	if (!groups || groups.size === 0) {
		return layoutSingleGraph(nodes, edges, nodeWidth, nodeHeight);
	}

	// Layout each group separately, then position groups side by side
	const layoutedNodes: Node<FlowStepData>[] = [];
	const nodeMap = new Map(nodes.map(n => [n.id, n]));
	const edgesBySource = new Map<string, Edge[]>();

	for (const edge of edges) {
		const existing = edgesBySource.get(edge.source) ?? [];
		existing.push(edge);
		edgesBySource.set(edge.source, existing);
	}

	let xOffset = 0;
	const groupGap = 100;

	// Process location groups first, then orphans/patches
	for (const [groupId, nodeIds] of groups) {
		const groupNodes = [...nodeIds].map(id => nodeMap.get(id)).filter((n): n is Node<FlowStepData> => n !== undefined);
		if (groupNodes.length === 0) continue;

		// Get edges within this group
		const groupEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

		// Layout this group
		const dagreGraph = new dagre.graphlib.Graph();
		dagreGraph.setDefaultEdgeLabel(() => ({}));
		dagreGraph.setGraph({
			rankdir: 'TB',
			ranksep: 80,
			nodesep: 40,
			marginx: 20,
			marginy: 20
		});

		for (const node of groupNodes) {
			dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
		}

		for (const edge of groupEdges) {
			dagreGraph.setEdge(edge.source, edge.target);
		}

		dagre.layout(dagreGraph);

		// Find bounds of this group
		let minX = Infinity, maxX = -Infinity;
		for (const node of groupNodes) {
			const dagreNode = dagreGraph.node(node.id);
			minX = Math.min(minX, dagreNode.x - nodeWidth / 2);
			maxX = Math.max(maxX, dagreNode.x + nodeWidth / 2);
		}

		// Apply positions with offset
		for (const node of groupNodes) {
			const dagreNode = dagreGraph.node(node.id);
			layoutedNodes.push({
				...node,
				position: {
					x: xOffset + (dagreNode.x - minX),
					y: dagreNode.y - nodeHeight / 2
				}
			});
		}

		xOffset += (maxX - minX) + groupGap;
	}

	return { nodes: layoutedNodes, edges };
}

/**
 * Layout all nodes in a single graph (fallback)
 */
function layoutSingleGraph(
	nodes: Node<FlowStepData>[],
	edges: Edge<FlowEdgeData>[],
	nodeWidth: number,
	nodeHeight: number
): FlowData {
	const dagreGraph = new dagre.graphlib.Graph();
	dagreGraph.setDefaultEdgeLabel(() => ({}));
	dagreGraph.setGraph({
		rankdir: 'TB',
		ranksep: 100,
		nodesep: 60,
		marginx: 50,
		marginy: 50
	});

	for (const node of nodes) {
		dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
	}

	for (const edge of edges) {
		dagreGraph.setEdge(edge.source, edge.target);
	}

	dagre.layout(dagreGraph);

	const layoutedNodes = nodes.map((node) => {
		const dagreNode = dagreGraph.node(node.id);
		return {
			...node,
			position: {
				x: dagreNode.x - nodeWidth / 2,
				y: dagreNode.y - nodeHeight / 2
			}
		};
	});

	return { nodes: layoutedNodes, edges };
}
