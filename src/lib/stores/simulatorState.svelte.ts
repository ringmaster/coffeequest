import type { RawStep, RawStepOption } from '$lib/types/game';
import { editorStore, parseTag, isPatchStep, getPatchTarget } from './editorState.svelte';

export interface HistoryEntry {
	location: string;
	stepId: string;
	stepIndex: number;
	optionLabel: string;
	optionTarget: string | null;
	skillCheck?: { skill: string; dc: number; outcome: 'pass' | 'fail' };
	tagsBefore: string[];
	tagsAfter: string[];
	tagsAdded: string[];
	tagsRemoved: string[];
}

export interface ResolvedOption {
	label: string;
	tags: string[];
	pass: string | null;
	fail?: string;
	skill?: string;
	dc?: number;
	hidden?: boolean;
	// Computed for display
	available: boolean;
	missingTags: string[];
	mutations: { add: string[]; remove: string[] };
}

/**
 * Expand option shorthand to full object
 */
function expandOption(opt: RawStepOption): {
	label: string;
	tags: string[];
	pass: string | null;
	fail?: string;
	skill?: string;
	dc?: number;
	hidden?: boolean;
} {
	if (typeof opt === 'string') {
		// "Label::step_id" or "Label"
		const match = opt.match(/^(.+?)::(.+)$/);
		if (match) {
			return { label: match[1], tags: [], pass: match[2] };
		}
		return { label: opt, tags: [], pass: null };
	}
	// Handle skill which can be string or string[] - take first if array
	const skill = Array.isArray(opt.skill) ? opt.skill[0] : opt.skill;
	return {
		label: opt.label,
		tags: opt.tags ?? [],
		pass: opt.pass ?? null,
		fail: opt.fail,
		skill,
		dc: opt.dc,
		hidden: opt.hidden
	};
}

/**
 * Expand options from step, handling presets
 */
function expandStepOptions(
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
 * Count occurrences of each tag in a set (converts Set to counts Map)
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
function evaluateComparison(count: number, comparison: '=' | '<' | '>' | null, value: number | null): boolean {
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
 * Check if option requirements are met
 * Supports comparison operators: tag=N, tag<N, tag>N
 */
function checkOptionRequirements(
	optionTags: string[],
	playerTags: Set<string>
): { available: boolean; missingTags: string[] } {
	const missingTags: string[] = [];
	const playerCounts = countTags(playerTags);

	for (const rawTag of optionTags) {
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
					missingTags.push(rawTag);
				}
			} else {
				if (playerCount < 1) {
					missingTags.push(parsed.tag);
				}
			}
		} else if (parsed.operator === '!') {
			// Blocked tag
			if (parsed.comparison !== null) {
				if (evaluateComparison(playerCount, parsed.comparison, parsed.value)) {
					missingTags.push(rawTag);
				}
			} else {
				if (playerCount > 0) {
					missingTags.push(`!${parsed.tag}`);
				}
			}
		}
	}

	return { available: missingTags.length === 0, missingTags };
}

/**
 * Extract mutations from option tags
 */
function extractMutations(optionTags: string[]): { add: string[]; remove: string[] } {
	const add: string[] = [];
	const remove: string[] = [];

	for (const rawTag of optionTags) {
		const { operator, tag } = parseTag(rawTag);
		if (operator === '+') add.push(tag);
		else if (operator === '-') remove.push(tag);
	}

	return { add, remove };
}

/**
 * Find the best matching step for a location and tag state
 * Supports comparison operators: tag=N, tag<N, tag>N
 */
function findMatchingStep(
	steps: RawStep[],
	location: string,
	tags: Set<string>
): { step: RawStep; index: number } | null {
	const matches: { step: RawStep; index: number; score: number }[] = [];
	const playerCounts = countTags(tags);

	for (let i = 0; i < steps.length; i++) {
		const step = steps[i];
		if (isPatchStep(step)) continue;
		if (step.id.toLowerCase() !== location.toLowerCase()) continue;

		let match = true;
		let score = 0;

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
						match = false;
						break;
					}
				} else {
					if (playerCount < 1) {
						match = false;
						break;
					}
				}
				score++;
			} else if (parsed.operator === '!') {
				// Blocked tag
				if (parsed.comparison !== null) {
					if (evaluateComparison(playerCount, parsed.comparison, parsed.value)) {
						match = false;
						break;
					}
				} else {
					if (playerCount > 0) {
						match = false;
						break;
					}
				}
				score++;
			}
		}

		if (match) {
			matches.push({ step, index: i, score });
		}
	}

	if (matches.length === 0) return null;

	// Return highest scoring match
	matches.sort((a, b) => b.score - a.score);
	return { step: matches[0].step, index: matches[0].index };
}

/**
 * Apply patches to a step based on current tags
 * Supports comparison operators: tag=N, tag<N, tag>N
 */
function applyPatches(
	baseStep: RawStep,
	steps: RawStep[],
	tags: Set<string>,
	presets?: Record<string, RawStepOption[]>
): RawStep {
	// Find applicable patches
	const patches: RawStep[] = [];
	const playerCounts = countTags(tags);

	for (const step of steps) {
		if (!isPatchStep(step)) continue;
		const target = getPatchTarget(step);
		if (target !== baseStep.id) continue;

		// Check patch conditions
		let applies = true;
		for (const rawTag of step.tags ?? []) {
			const parsed = parseTag(rawTag);
			const playerCount = playerCounts.get(parsed.tag) || 0;

			// Skip mutation operators (they're processed during execution)
			if (parsed.operator === '+' || parsed.operator === '-') {
				continue;
			}

			if (parsed.operator === '@' || parsed.operator === '') {
				// Required tag
				if (parsed.comparison !== null) {
					if (!evaluateComparison(playerCount, parsed.comparison, parsed.value)) {
						applies = false;
						break;
					}
				} else {
					if (playerCount < 1) {
						applies = false;
						break;
					}
				}
			} else if (parsed.operator === '!') {
				// Blocked tag
				if (parsed.comparison !== null) {
					if (evaluateComparison(playerCount, parsed.comparison, parsed.value)) {
						applies = false;
						break;
					}
				} else {
					if (playerCount > 0) {
						applies = false;
						break;
					}
				}
			}
		}

		if (applies) {
			patches.push(step);
		}
	}

	if (patches.length === 0) return baseStep;

	// Clone and apply patches
	const result = { ...baseStep, tags: [...(baseStep.tags ?? [])] };
	const prepends: string[] = [];
	const appends: string[] = [];
	let replacement: string | null = null;

	for (const patch of patches) {
		// Add mutation tags from patch to step tags (will be processed during simulation)
		for (const rawTag of patch.tags ?? []) {
			const { operator } = parseTag(rawTag);
			if (operator === '+' || operator === '-') {
				result.tags.push(rawTag);
			}
		}

		// Text modifications
		if (typeof patch.text === 'object' && patch.text !== null) {
			const textMod = patch.text as { prepend?: string; append?: string; replace?: string };
			if (textMod.prepend) prepends.push(textMod.prepend);
			if (textMod.append) appends.push(textMod.append);
			if (textMod.replace) replacement = textMod.replace;
		}

		// Options: append
		if (patch.options) {
			const baseOptions = expandStepOptions(result.options, presets);
			const patchOptions = expandStepOptions(patch.options, presets);
			result.options = [...baseOptions, ...patchOptions];
		}

		// Vars: merge
		if (patch.vars) {
			result.vars = { ...result.vars, ...patch.vars };
		}
	}

	// Apply text modifications
	if (replacement !== null) {
		result.text = replacement;
	} else if (prepends.length > 0 || appends.length > 0) {
		result.text = prepends.join('') + result.text + appends.join('');
	}

	return result;
}

class SimulatorStore {
	// State
	active = $state(false);
	location = $state<string>('');
	tags = $state<Set<string>>(new Set());
	resolvedVars = $state<Record<string, unknown>>({});
	history = $state<HistoryEntry[]>([]);
	historyIndex = $state(-1);
	selectedOutcome = $state<'pass' | 'fail'>('pass');

	// Derived: Current step matching location + tags (uses ALL steps from ALL quest files)
	currentStep = $derived.by((): { step: RawStep; index: number } | null => {
		if (!this.active || !this.location || editorStore.allSteps.length === 0) return null;
		return findMatchingStep(editorStore.allSteps, this.location, this.tags);
	});

	// Derived: Current step with patches applied
	patchedStep = $derived.by((): RawStep | null => {
		if (!this.currentStep || editorStore.allSteps.length === 0) return null;
		return applyPatches(
			this.currentStep.step,
			editorStore.allSteps,
			this.tags,
			editorStore.allPresets
		);
	});

	// Derived: Available options for current step
	availableOptions = $derived.by((): ResolvedOption[] => {
		if (!this.patchedStep || editorStore.allSteps.length === 0) return [];

		const rawOptions = expandStepOptions(
			this.patchedStep.options,
			editorStore.allPresets
		);

		return rawOptions.map((opt) => {
			const expanded = expandOption(opt);
			const { available, missingTags } = checkOptionRequirements(expanded.tags, this.tags);
			const mutations = extractMutations(expanded.tags);

			// Also include mutations from target step's tags
			if (expanded.pass && !expanded.skill) {
				const targetMatch = findMatchingStep(
					editorStore.allSteps,
					expanded.pass,
					this.tags
				);
				if (targetMatch) {
					for (const rawTag of targetMatch.step.tags ?? []) {
						const { operator, tag } = parseTag(rawTag);
						if (operator === '+') mutations.add.push(tag);
						else if (operator === '-') mutations.remove.push(tag);
					}
				}
			}

			return {
				...expanded,
				available,
				missingTags,
				mutations
			};
		});
	});

	// Actions
	start(): void {
		this.active = true;
		this.tags = new Set(editorStore.activeTags);
		this.history = [];
		this.historyIndex = -1;
		this.resolvedVars = {};

		// Default to first location
		if (editorStore.allLocations.length > 0) {
			this.location = editorStore.allLocations[0].id;
		}
	}

	stop(): void {
		this.active = false;
	}

	setLocation(location: string): void {
		const previousLocation = this.location;
		this.location = location;

		// Record history for arriving at a new location (after setting location so currentStep updates)
		if (location && location !== previousLocation) {
			// Need to wait for derived state to update
			// Use queueMicrotask to let Svelte reactivity settle
			queueMicrotask(() => {
				if (this.currentStep) {
					const entry: HistoryEntry = {
						location: location,
						stepId: this.currentStep.step.id,
						stepIndex: this.currentStep.index,
						optionLabel: previousLocation ? '(traveled)' : '(started)',
						optionTarget: null,
						tagsBefore: Array.from(this.tags),
						tagsAfter: Array.from(this.tags),
						tagsAdded: [],
						tagsRemoved: []
					};

					// Truncate future history if we're not at the end
					if (this.historyIndex < this.history.length - 1) {
						this.history = this.history.slice(0, this.historyIndex + 1);
					}

					this.history = [...this.history, entry];
					this.historyIndex = this.history.length - 1;
				}
			});
		}
	}

	addTag(tag: string): void {
		this.tags = new Set([...this.tags, tag]);
	}

	removeTag(tag: string): void {
		const newTags = new Set(this.tags);
		newTags.delete(tag);
		this.tags = newTags;
	}

	setSelectedOutcome(outcome: 'pass' | 'fail'): void {
		this.selectedOutcome = outcome;
	}

	/**
	 * Take an option action
	 */
	takeOption(option: ResolvedOption): void {
		if (!this.currentStep || !this.patchedStep) return;

		const tagsBefore = Array.from(this.tags);

		// Determine target based on skill check outcome
		let target = option.pass;
		let skillCheck: HistoryEntry['skillCheck'] | undefined;

		if (option.skill && option.dc) {
			skillCheck = {
				skill: option.skill,
				dc: option.dc,
				outcome: this.selectedOutcome
			};
			target = this.selectedOutcome === 'pass' ? option.pass : (option.fail ?? null);
		}

		// Apply option tag mutations
		const tagsAdded: string[] = [];
		const tagsRemoved: string[] = [];

		for (const rawTag of option.tags) {
			const { operator, tag } = parseTag(rawTag);
			if (operator === '+') {
				this.tags.add(tag);
				tagsAdded.push(tag);
			} else if (operator === '-') {
				this.tags.delete(tag);
				tagsRemoved.push(tag);
				// Special: -quest clears all q: tags
				if (tag === 'quest') {
					for (const t of [...this.tags]) {
						if (t.startsWith('q:')) {
							this.tags.delete(t);
							tagsRemoved.push(t);
						}
					}
				}
			}
		}

		// Apply target step tag mutations
		if (target && editorStore.allSteps.length > 0) {
			const targetMatch = findMatchingStep(editorStore.allSteps, target, this.tags);
			if (targetMatch) {
				for (const rawTag of targetMatch.step.tags ?? []) {
					const { operator, tag } = parseTag(rawTag);
					if (operator === '+') {
						this.tags.add(tag);
						if (!tagsAdded.includes(tag)) tagsAdded.push(tag);
					} else if (operator === '-') {
						this.tags.delete(tag);
						if (!tagsRemoved.includes(tag)) tagsRemoved.push(tag);
						if (tag === 'quest') {
							for (const t of [...this.tags]) {
								if (t.startsWith('q:')) {
									this.tags.delete(t);
									if (!tagsRemoved.includes(t)) tagsRemoved.push(t);
								}
							}
						}
					}
				}
			}
		}

		// Force reactivity
		this.tags = new Set(this.tags);

		// Record history
		const entry: HistoryEntry = {
			location: this.location,
			stepId: this.currentStep.step.id,
			stepIndex: this.currentStep.index,
			optionLabel: option.label,
			optionTarget: target,
			skillCheck,
			tagsBefore,
			tagsAfter: Array.from(this.tags),
			tagsAdded,
			tagsRemoved
		};

		// Truncate future history if we're not at the end
		if (this.historyIndex < this.history.length - 1) {
			this.history = this.history.slice(0, this.historyIndex + 1);
		}

		this.history = [...this.history, entry];
		this.historyIndex = this.history.length - 1;

		// Navigate to target
		if (target) {
			this.location = target;
		}
	}

	/**
	 * Go to a specific location (for end interaction handling)
	 */
	goToLocation(location: string): void {
		if (!this.currentStep) return;

		// Record history entry for leaving
		const entry: HistoryEntry = {
			location: this.location,
			stepId: this.currentStep.step.id,
			stepIndex: this.currentStep.index,
			optionLabel: '(traveled)',
			optionTarget: location,
			tagsBefore: Array.from(this.tags),
			tagsAfter: Array.from(this.tags),
			tagsAdded: [],
			tagsRemoved: []
		};

		this.history = [...this.history, entry];
		this.historyIndex = this.history.length - 1;
		this.location = location;
	}

	/**
	 * Go back one step
	 */
	back(): void {
		if (this.historyIndex < 0) return;

		const entry = this.history[this.historyIndex];
		this.tags = new Set(entry.tagsBefore);
		this.location = entry.location;
		this.historyIndex--;
	}

	/**
	 * Jump to a specific history point
	 */
	jumpTo(index: number): void {
		if (index < 0 || index >= this.history.length) return;

		const entry = this.history[index];
		this.tags = new Set(entry.tagsAfter);
		this.location = entry.optionTarget ?? entry.location;
		this.historyIndex = index;
	}

	/**
	 * Reset simulation
	 */
	reset(): void {
		this.tags = new Set(editorStore.activeTags);
		this.history = [];
		this.historyIndex = -1;
		this.resolvedVars = {};

		if (editorStore.allLocations.length > 0) {
			this.location = editorStore.allLocations[0].id;
		}
	}

	/**
	 * Copy current tags to editor
	 */
	copyTagsToEditor(): void {
		editorStore.setActiveTags(this.tags);
	}

	/**
	 * Edit current step in editor
	 * Finds the matching step in the currently loaded quest file
	 */
	editCurrentStep(): void {
		if (!this.currentStep || !editorStore.questFile) return;

		const step = this.currentStep.step;
		// Find this step in the currently loaded file by matching id and tags
		const index = editorStore.questFile.steps.findIndex(
			(s) => s.id === step.id && JSON.stringify(s.tags) === JSON.stringify(step.tags)
		);

		if (index >= 0) {
			editorStore.selectStep(index);
		}
		// If not found, the step is from a different quest file - can't edit
	}
}

export const simulatorStore = new SimulatorStore();
