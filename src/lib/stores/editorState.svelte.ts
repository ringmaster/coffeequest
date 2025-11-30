import type { GameConfig, RawStep } from '$lib/types/game';
import type { QuestFile, LintResult, CoverageRow, ParsedTag } from '$lib/types/editor';

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
 * Parse a tag string into operator and tag name
 */
export function parseTag(raw: string): ParsedTag {
	if (raw.startsWith('@')) return { operator: '@', tag: raw.slice(1) };
	if (raw.startsWith('!')) return { operator: '!', tag: raw.slice(1) };
	if (raw.startsWith('+')) return { operator: '+', tag: raw.slice(1) };
	if (raw.startsWith('-')) return { operator: '-', tag: raw.slice(1) };
	return { operator: '', tag: raw };
}

/**
 * Format a parsed tag back to string
 */
export function formatTag(parsed: ParsedTag): string {
	return parsed.operator + parsed.tag;
}

/**
 * Check if a step matches the given location and active tags
 */
function stepMatchesFilters(step: RawStep, location: string, activeTags: Set<string>): boolean {
	// Patches don't match locations directly
	if (isPatchStep(step)) return false;

	// Must match location (case-insensitive)
	if (step.id.toLowerCase() !== location.toLowerCase()) return false;

	// Check all tag conditions
	for (const rawTag of step.tags ?? []) {
		const { operator, tag } = parseTag(rawTag);

		// @ or bare: require tag
		if (operator === '@' || operator === '') {
			if (!activeTags.has(tag)) return false;
		}
		// !: forbid tag
		else if (operator === '!') {
			if (activeTags.has(tag)) return false;
		}
		// + and - are mutations, not conditions (ignore for matching)
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
		const locs = new Map<string, string>();

		// Add from _locations.json (coordinate -> name)
		for (const [coord, name] of Object.entries(this.locations)) {
			locs.set(coord.toUpperCase(), name);
		}

		// Add unique step IDs from current file (excluding patches)
		if (this.questFile) {
			for (const step of this.questFile.steps) {
				// Skip patch steps
				if (isPatchStep(step)) continue;

				const id = step.id;
				// Only add if it looks like a location (not an internal step)
				// Internal steps typically have underscores or lowercase
				if (!locs.has(id.toUpperCase()) && !id.includes('_')) {
					locs.set(id, id);
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

	// Derived: All non-patch step IDs (for patch target dropdown)
	allStepIds = $derived.by(() => {
		if (!this.questFile) return [];
		return this.questFile.steps
			.filter((s) => !isPatchStep(s))
			.map((s) => s.id)
			.sort();
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

	loadContext(locations: Record<string, string>, config: GameConfig | null): void {
		this.locations = locations;
		this.config = config;
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
