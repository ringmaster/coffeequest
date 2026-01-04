import type { GameConfig, RawStep, RawStepOption } from '$lib/types/game';
import type { QuestFile, LintResult, CoverageRow, ParsedTag, StepNode, TreeNode, StepTreeGroup, TagOperator, ComparisonOperator } from '$lib/types/editor';

const PATCH_PREFIX = '@patch:';

/**
 * Check if a step is a patch (id starts with @patch:)
 */
export function isPatchStep(step: RawStep): boolean {
	return step.id.startsWith(PATCH_PREFIX);
}

/**
 * Get the target step ID from a patch step
 */
export function getPatchTarget(step: RawStep): string | null {
	if (!isPatchStep(step)) return null;
	return step.id.substring(PATCH_PREFIX.length);
}

/**
 * Parse a tag string into operator, tag name, and optional comparison
 * Examples:
 *   "@level>1" → { operator: '@', tag: 'level', comparison: '>', value: 1 }
 *   "!inv:silver=3" → { operator: '!', tag: 'inv:silver', comparison: '=', value: 3 }
 *   "+visited:market" → { operator: '+', tag: 'visited:market', comparison: null, value: null }
 *   "^quest" → { operator: '^', tag: 'quest', ... } (base step must have tag)
 *   "^!internal" → { operator: '^!', tag: 'internal', ... } (base step must NOT have tag)
 */
export function parseTag(raw: string): ParsedTag {
	let operator: TagOperator = '';
	let rest = raw;

	// Extract prefix operator (check multi-char operators first)
	if (rest.startsWith('^!')) {
		operator = '^!';
		rest = rest.slice(2);
	} else if (rest.startsWith('^')) {
		operator = '^';
		rest = rest.slice(1);
	} else if (rest.startsWith('@')) {
		operator = '@';
		rest = rest.slice(1);
	} else if (rest.startsWith('!')) {
		operator = '!';
		rest = rest.slice(1);
	} else if (rest.startsWith('+')) {
		operator = '+';
		rest = rest.slice(1);
	} else if (rest.startsWith('-')) {
		operator = '-';
		rest = rest.slice(1);
	}

	// Check for comparison operator (=, <, >) followed by a number
	const comparisonMatch = rest.match(/^(.+?)([=<>])(\d+)$/);
	if (comparisonMatch) {
		return {
			operator,
			tag: comparisonMatch[1],
			comparison: comparisonMatch[2] as ComparisonOperator,
			value: parseInt(comparisonMatch[3], 10)
		};
	}

	return { operator, tag: rest, comparison: null, value: null };
}

/**
 * Format a parsed tag back to string
 */
export function formatTag(parsed: ParsedTag): string {
	let result = parsed.operator + parsed.tag;
	if (parsed.comparison !== null && parsed.value !== null) {
		result += parsed.comparison + parsed.value;
	}
	return result;
}

/**
 * Count occurrences of each tag in a set
 */
function countTags(tags: Set<string>): Map<string, number> {
	const counts = new Map<string, number>();
	for (const tag of tags) {
		counts.set(tag, (counts.get(tag) || 0) + 1);
	}
	return counts;
}

/**
 * Evaluate a comparison condition against a tag count
 */
function evaluateComparison(count: number, comparison: ComparisonOperator, value: number | null): boolean {
	if (comparison === null || value === null) {
		return count >= 1;
	}
	switch (comparison) {
		case '=': return count === value;
		case '<': return count < value;
		case '>': return count > value;
		default: return count >= 1;
	}
}

/**
 * Check if a step matches the given location and active tags
 * Supports comparison operators: tag=N, tag<N, tag>N
 */
function stepMatchesFilters(step: RawStep, location: string, activeTags: Set<string>): boolean {
	// Patches don't match locations directly
	if (isPatchStep(step)) return false;

	// Must match location (case-insensitive)
	if (step.id.toLowerCase() !== location.toLowerCase()) return false;

	const playerCounts = countTags(activeTags);

	// Check all tag conditions
	for (const rawTag of step.tags ?? []) {
		const parsed = parseTag(rawTag);
		const playerCount = playerCounts.get(parsed.tag) || 0;

		// Skip mutation operators
		if (parsed.operator === '+' || parsed.operator === '-') {
			continue;
		}

		if (parsed.operator === '@' || parsed.operator === '') {
			// Required tag
			if (parsed.comparison !== null) {
				if (!evaluateComparison(playerCount, parsed.comparison, parsed.value)) {
					return false;
				}
			} else {
				if (playerCount < 1) return false;
			}
		} else if (parsed.operator === '!') {
			// Blocked tag
			if (parsed.comparison !== null) {
				if (evaluateComparison(playerCount, parsed.comparison, parsed.value)) {
					return false;
				}
			} else {
				if (playerCount > 0) return false;
			}
		}
	}

	return true;
}

/**
 * Collect all tags referenced in conditions for a location
 */
function collectRelevantTags(steps: RawStep[], location: string): Set<string> {
	const tags = new Set<string>();
	for (const step of steps) {
		if (step.id.toLowerCase() !== location.toLowerCase()) continue;
		for (const rawTag of step.tags ?? []) {
			const { operator, tag } = parseTag(rawTag);
			// Only @ ! and bare tags are conditions
			if (operator === '@' || operator === '!' || operator === '') {
				tags.add(tag);
			}
		}
	}
	return tags;
}

/**
 * Generate coverage matrix for a location
 */
function generateCoverageMatrix(steps: RawStep[], location: string): CoverageRow[] {
	const relevantTags = Array.from(collectRelevantTags(steps, location));
	if (relevantTags.length === 0) return [];

	// Limit to prevent explosion (max 6 tags = 64 combinations)
	const tagsToUse = relevantTags.slice(0, 6);

	// Generate all combinations
	const combinations: CoverageRow[] = [];
	const numCombos = Math.pow(2, tagsToUse.length);

	for (let i = 0; i < numCombos; i++) {
		const tagValues: Record<string, boolean> = {};
		const activeSet = new Set<string>();

		for (let j = 0; j < tagsToUse.length; j++) {
			const hasTag = (i & (1 << j)) !== 0;
			tagValues[tagsToUse[j]] = hasTag;
			if (hasTag) activeSet.add(tagsToUse[j]);
		}

		// Find matching steps
		const matches = steps
			.filter((s) => stepMatchesFilters(s, location, activeSet))
			.map((s) => s.id);

		let status: CoverageRow['status'];
		if (matches.length === 1) status = 'single';
		else if (matches.length > 1) status = 'ambiguous';
		else status = 'none';

		combinations.push({ tagValues, matches, status });
	}

	return combinations;
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
function parseOptionTargets(option: RawStepOption): { pass: string | null; fail: string | null } {
	if (typeof option === 'string') {
		// "Label::step_id" format
		const match = option.match(/^.+?::(.+)$/);
		return { pass: match ? match[1] : null, fail: null };
	}
	return {
		pass: option.pass ?? null,
		fail: option.fail ?? null
	};
}

/**
 * Build a step graph from quest file steps
 * Creates nodes for ALL steps (keyed by index), handles multiple steps with same ID
 */
function buildStepGraph(
	steps: RawStep[],
	presets?: Record<string, RawStepOption[]>
): { nodesByIndex: Map<number, StepNode>; stepsByIdMap: Map<string, number[]> } {
	const nodesByIndex = new Map<number, StepNode>();
	const stepsByIdMap = new Map<string, number[]>(); // ID -> [indices]

	// Create nodes for ALL non-patch steps (keyed by index for uniqueness)
	steps.forEach((step, index) => {
		if (!isPatchStep(step)) {
			nodesByIndex.set(index, { step, stepIndex: index, children: [], parents: [] });

			// Track all indices for each ID
			const indices = stepsByIdMap.get(step.id) ?? [];
			indices.push(index);
			stepsByIdMap.set(step.id, indices);
		}
	});

	// Build edges from options
	// When an option targets an ID, link to ALL steps with that ID
	for (const [index, node] of nodesByIndex) {
		const options = expandOptions(node.step.options, presets);
		const addedEdges = new Set<number>(); // Track by index to avoid duplicates

		for (const option of options) {
			const { pass, fail } = parseOptionTargets(option);

			// Link to all steps with the target ID
			if (pass) {
				const targetIndices = stepsByIdMap.get(pass) ?? [];
				for (const targetIndex of targetIndices) {
					if (!addedEdges.has(targetIndex)) {
						const child = nodesByIndex.get(targetIndex)!;
						node.children.push(child);
						child.parents.push(node);
						addedEdges.add(targetIndex);
					}
				}
			}
			if (fail) {
				const targetIndices = stepsByIdMap.get(fail) ?? [];
				for (const targetIndex of targetIndices) {
					if (!addedEdges.has(targetIndex)) {
						const child = nodesByIndex.get(targetIndex)!;
						node.children.push(child);
						child.parents.push(node);
						addedEdges.add(targetIndex);
					}
				}
			}
		}
	}

	return { nodesByIndex, stepsByIdMap };
}

/**
 * Find root nodes in the step graph
 * Roots are: location steps, or steps with no incoming edges
 */
function findRoots(nodesByIndex: Map<number, StepNode>, locationIds: Set<string>): StepNode[] {
	const roots: StepNode[] = [];

	for (const node of nodesByIndex.values()) {
		const isLocation = locationIds.has(node.step.id);
		const noParents = node.parents.length === 0;

		if (isLocation || noParents) {
			roots.push(node);
		}
	}

	return roots;
}

/**
 * Get key tags for a step (@ and ! tags, for display)
 */
function getKeyTags(step: RawStep): string[] {
	const keyTags: string[] = [];
	for (const rawTag of step.tags ?? []) {
		const { operator, tag } = parseTag(rawTag);
		if (operator === '@' || operator === '!') {
			keyTags.push(rawTag);
		}
	}
	return keyTags.slice(0, 3); // Limit to 3 for display
}

/**
 * Build tree structure from step graph, handling cycles and multiple parents
 * Uses step index for uniqueness (not ID) to handle multiple steps with same ID
 */
function buildTreeFromGraph(
	roots: StepNode[],
	nodesByIndex: Map<number, StepNode>,
	locationIds: Set<string>
): { groups: StepTreeGroup[]; orphans: TreeNode[]; patches: TreeNode[] } {
	const groups: StepTreeGroup[] = [];
	const visited = new Set<number>(); // Track which steps appear in any tree (for orphan detection)

	// Build tree recursively with cycle detection
	// ancestors tracked by index to properly detect cycles
	// Note: We always fully expand subtrees - no "see above" references
	// This ensures every step is visible and editable somewhere in the tree
	function buildSubtree(node: StepNode, ancestors: Set<number>): TreeNode {
		const isLocation = locationIds.has(node.step.id);

		// Check for back-reference (cycle) - by index
		if (ancestors.has(node.stepIndex)) {
			return {
				stepId: node.step.id,
				stepIndex: node.stepIndex,
				step: node.step,
				children: [],
				isLocation,
				isPatch: false,
				isOrphaned: false,
				refType: 'back',
				refTarget: node.step.id
			};
		}

		// Track that this step appears in the tree (for orphan detection)
		visited.add(node.stepIndex);

		const newAncestors = new Set(ancestors);
		newAncestors.add(node.stepIndex);

		// Build children recursively - always fully expand
		const children: TreeNode[] = [];
		for (const child of node.children) {
			children.push(buildSubtree(child, newAncestors));
		}

		return {
			stepId: node.step.id,
			stepIndex: node.stepIndex,
			step: node.step,
			children,
			isLocation,
			isPatch: false,
			isOrphaned: false,
			refType: 'primary'
		};
	}

	// Count total steps in a tree
	function countSteps(node: TreeNode): number {
		if (node.refType === 'back') {
			return 0; // Don't double count back-references (cycles)
		}
		return 1 + node.children.reduce((sum, child) => sum + countSteps(child), 0);
	}

	// Build groups from roots
	for (const root of roots) {
		const keyTags = getKeyTags(root.step);

		const rootTree = buildSubtree(root, new Set());
		const stepCount = countSteps(rootTree);

		// Create group label - include tags to differentiate same-ID roots
		let rootLabel = root.step.id;
		if (keyTags.length > 0) {
			rootLabel += ` [${keyTags.join(', ')}]`;
		}
		if (rootTree.children.length > 0 && keyTags.length === 0) {
			// Find first child for the "→ child" part of label (only if no tags shown)
			const firstLeafId = rootTree.children[0]?.stepId;
			if (firstLeafId) {
				rootLabel += ` → ${firstLeafId}`;
			}
		}

		groups.push({
			rootId: root.step.id,
			rootLabel,
			keyTags,
			children: [rootTree],
			stepCount
		});
	}

	// Find orphans (no parents AND no children)
	const orphans: TreeNode[] = [];
	for (const node of nodesByIndex.values()) {
		if (node.parents.length === 0 && node.children.length === 0 && !locationIds.has(node.step.id)) {
			// Check if it was already included as a root
			if (!visited.has(node.stepIndex)) {
				orphans.push({
					stepId: node.step.id,
					stepIndex: node.stepIndex,
					step: node.step,
					children: [],
					isLocation: false,
					isPatch: false,
					isOrphaned: true,
					refType: 'primary'
				});
			}
		}
	}

	return { groups, orphans, patches: [] };
}

class EditorStore {
	// File State
	questFile = $state<QuestFile | null>(null);
	fileName = $state<string>('');
	isDirty = $state<boolean>(false);

	// Project Context (loaded from server)
	locations = $state<Record<string, string>>({});
	config = $state<GameConfig | null>(null);
	allQuestFiles = $state<string[]>([]);
	externalTags = $state<Set<string>>(new Set());

	// Merged steps from ALL quest files (for simulator)
	allSteps = $state<RawStep[]>([]);
	allPresets = $state<Record<string, RawStepOption[]>>({});

	// Navigation State
	selectedLocation = $state<string | null>(null);
	activeTags = $state<Set<string>>(new Set());

	// Editing State
	selectedStepIndex = $state<number | null>(null);

	// Lint State
	lintResults = $state<LintResult[]>([]);
	lintPending = $state<boolean>(false);

	// Derived: All locations from current file + _locations.json
	allLocations = $derived.by(() => {
		const locs = new Map<string, string>(); // id -> name
		const knownNames = new Set<string>(); // Track names to avoid duplicates

		// Add from _locations.json (coordinate -> name)
		for (const [coord, name] of Object.entries(this.locations)) {
			locs.set(coord.toUpperCase(), name);
			knownNames.add(name.toUpperCase());
		}

		// Add unique step IDs from current file (excluding patches)
		// Only add if the step ID isn't already a known location name
		if (this.questFile) {
			for (const step of this.questFile.steps) {
				// Skip patch steps
				if (isPatchStep(step)) continue;

				const id = step.id;
				// Only add if:
				// - Not already in locations map by ID
				// - Not already in locations map by name (avoids "Market" duplicate when B2->Market exists)
				// - Doesn't contain underscore (internal steps)
				if (
					!locs.has(id.toUpperCase()) &&
					!knownNames.has(id.toUpperCase()) &&
					!id.includes('_')
				) {
					locs.set(id, id);
					knownNames.add(id.toUpperCase());
				}
			}
		}

		// Convert to sorted array
		return Array.from(locs.entries())
			.map(([id, name]) => ({ id, name }))
			.sort((a, b) => a.name.localeCompare(b.name));
	});

	// Derived: All tags used in current file
	allTags = $derived.by(() => {
		const tags = new Set<string>();
		if (!this.questFile) return Array.from(tags);

		for (const step of this.questFile.steps) {
			for (const rawTag of step.tags ?? []) {
				const { tag } = parseTag(rawTag);
				tags.add(tag);
			}
			// Also check option tags
			if (Array.isArray(step.options)) {
				for (const opt of step.options) {
					if (typeof opt === 'object' && opt.tags) {
						for (const rawTag of opt.tags) {
							const { tag } = parseTag(rawTag);
							tags.add(tag);
						}
					}
				}
			}
		}

		return Array.from(tags).sort();
	});

	// Derived: All non-patch step IDs from current file
	allStepIds = $derived.by(() => {
		if (!this.questFile) return [];
		return this.questFile.steps
			.filter((s) => !isPatchStep(s))
			.map((s) => s.id)
			.sort();
	});

	// Derived: All step IDs from ALL quest files (for patch target dropdown)
	// Includes steps from external files, deduplicated and sorted
	allGlobalStepIds = $derived.by(() => {
		const ids = new Set<string>();

		// Add from all loaded steps (merged from all quest files)
		for (const step of this.allSteps) {
			if (!isPatchStep(step)) {
				ids.add(step.id);
			}
		}

		// Also include current file steps (in case file hasn't been saved yet)
		if (this.questFile) {
			for (const step of this.questFile.steps) {
				if (!isPatchStep(step)) {
					ids.add(step.id);
				}
			}
		}

		return Array.from(ids).sort();
	});

	// Derived: All variables defined across all steps (for cross-step variable reference)
	globalVars = $derived.by(() => {
		const varMap = new Map<string, { stepIndex: number; stepId: string }>();
		if (!this.questFile) return varMap;

		this.questFile.steps.forEach((step, stepIndex) => {
			if (step.vars) {
				for (const varName of Object.keys(step.vars)) {
					if (!varMap.has(varName)) {
						varMap.set(varName, { stepIndex, stepId: step.id });
					}
				}
			}
		});

		return varMap;
	});

	// Derived: Steps matching current location + active tags
	matchingSteps = $derived.by(() => {
		if (!this.questFile || !this.selectedLocation) return [];

		return this.questFile.steps
			.map((step, index) => ({ step, index }))
			.filter(({ step }) => stepMatchesFilters(step, this.selectedLocation!, this.activeTags));
	});

	// Derived: Currently selected step
	selectedStep = $derived.by(() => {
		if (this.selectedStepIndex === null || !this.questFile) return null;
		return this.questFile.steps[this.selectedStepIndex] ?? null;
	});

	// Derived: Coverage matrix for current location
	coverageMatrix = $derived.by(() => {
		if (!this.questFile || !this.selectedLocation) return [];
		return generateCoverageMatrix(this.questFile.steps, this.selectedLocation);
	});

	// Derived: Location IDs set for quick lookup
	// Includes both coordinate IDs (e.g., "B2") and location names (e.g., "Market")
	// so step ID matching works when steps use location names
	locationIdSet = $derived.by(() => {
		const ids = new Set<string>();
		for (const loc of this.allLocations) {
			ids.add(loc.id);
			ids.add(loc.name);
		}
		return ids;
	});

	// Derived: Step graph and tree structure
	stepTree = $derived.by((): { groups: StepTreeGroup[]; orphans: TreeNode[]; patches: TreeNode[] } => {
		if (!this.questFile) return { groups: [], orphans: [], patches: [] };

		const steps = this.questFile.steps;
		const presets = this.questFile.option_presets;

		// Build graph (now returns nodesByIndex and stepsByIdMap)
		const { nodesByIndex } = buildStepGraph(steps, presets);

		// Find roots
		const roots = findRoots(nodesByIndex, this.locationIdSet);

		// Build tree from graph
		const { groups, orphans } = buildTreeFromGraph(roots, nodesByIndex, this.locationIdSet);

		// Collect patches separately
		const patches: TreeNode[] = [];
		steps.forEach((step, index) => {
			if (isPatchStep(step)) {
				patches.push({
					stepId: step.id,
					stepIndex: index,
					step,
					children: [],
					isLocation: false,
					isPatch: true,
					isOrphaned: false,
					refType: 'primary'
				});
			}
		});

		return { groups, orphans, patches };
	});

	// Actions
	loadFile(name: string, content: QuestFile): void {
		this.questFile = content;
		this.fileName = name;
		this.isDirty = false;
		this.selectedLocation = null;
		this.selectedStepIndex = null;
		this.activeTags = new Set();
		this.lintResults = [];
	}

	loadContext(
		locations: Record<string, string>,
		config: GameConfig | null,
		allSteps?: RawStep[],
		allPresets?: Record<string, RawStepOption[]>
	): void {
		this.locations = locations;
		this.config = config;
		if (allSteps) this.allSteps = allSteps;
		if (allPresets) this.allPresets = allPresets;
	}

	setFileList(files: string[]): void {
		this.allQuestFiles = files;
	}

	selectLocation(location: string | null): void {
		this.selectedLocation = location;
		this.selectedStepIndex = null;
		this.activeTags = new Set();
	}

	addTag(tag: string): void {
		this.activeTags = new Set([...this.activeTags, tag]);
	}

	removeTag(tag: string): void {
		const newTags = new Set(this.activeTags);
		newTags.delete(tag);
		this.activeTags = newTags;
	}

	setActiveTags(tags: Set<string>): void {
		this.activeTags = new Set(tags);
	}

	selectStep(index: number | null): void {
		this.selectedStepIndex = index;
	}

	// Mark file as dirty when edited
	markDirty(): void {
		this.isDirty = true;
	}

	markClean(): void {
		this.isDirty = false;
	}

	// Update a step in the file
	updateStep(index: number, step: RawStep): void {
		if (!this.questFile) return;
		this.questFile.steps[index] = step;
		this.isDirty = true;
	}

	// Add a new step
	addStep(step: RawStep): number {
		if (!this.questFile) {
			this.questFile = { steps: [] };
		}
		this.questFile.steps.push(step);
		this.isDirty = true;
		return this.questFile.steps.length - 1;
	}

	// Delete a step
	deleteStep(index: number): void {
		if (!this.questFile) return;
		this.questFile.steps.splice(index, 1);
		if (this.selectedStepIndex === index) {
			this.selectedStepIndex = null;
		} else if (this.selectedStepIndex !== null && this.selectedStepIndex > index) {
			this.selectedStepIndex--;
		}
		this.isDirty = true;
	}

	// Set lint results
	setLintResults(results: LintResult[]): void {
		this.lintResults = results;
		this.lintPending = false;
	}

	setLintPending(pending: boolean): void {
		this.lintPending = pending;
	}
}

export const editorStore = new EditorStore();
