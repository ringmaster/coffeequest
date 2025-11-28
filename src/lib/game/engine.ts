import type { Step, StepOption, StatName, SkillCheckResult, SkillBonus, SkillSource, RawStepOption, RawStep, OptionPresetsEntry, StepDebugInfo, TagAnalysis } from '$lib/types/game';
import { gameStore } from '$lib/stores/gameState.svelte';

/**
 * Transition to navigation phase, but check for level up first.
 * If the player leveled up, go to level_up phase instead.
 */
function transitionToNavigation(): void {
	gameStore.currentDisplayStep = null;
	gameStore.availableOptions = [];
	gameStore.state.currentStepId = null;

	if (gameStore.leveledUp) {
		gameStore.leveledUp = false;
		gameStore.phase = 'level_up';
	} else {
		gameStore.phase = 'navigation';
	}
	gameStore.save();
}

/**
 * Parse a string shorthand option into a full StepOption object
 * "Label::step_id" → { label: "Label", tags: [], pass: "step_id" }
 * "Label" → { label: "Label", tags: [], pass: null }
 */
function parseShorthandOption(shorthand: string): StepOption {
	const delimiterIndex = shorthand.indexOf('::');
	if (delimiterIndex === -1) {
		return {
			label: shorthand,
			tags: [],
			pass: null
		};
	}
	return {
		label: shorthand.substring(0, delimiterIndex),
		tags: [],
		pass: shorthand.substring(delimiterIndex + 2)
	};
}

/**
 * Expand a raw option (string or object) into a full StepOption
 */
export function expandOption(raw: RawStepOption): StepOption {
	if (typeof raw === 'string') {
		return parseShorthandOption(raw);
	}
	// Ensure tags array exists
	return {
		...raw,
		tags: raw.tags || []
	};
}

/**
 * Expand all options in a raw step, resolving presets and shorthand
 */
export function expandStepOptions(
	rawStep: RawStep,
	presets: Record<string, RawStepOption[]>
): Step {
	const step: Step = {
		id: rawStep.id,
		tags: rawStep.tags,
		text: rawStep.text
	};

	if (rawStep.vars) step.vars = rawStep.vars;
	if (rawStep.log) step.log = rawStep.log;

	if (rawStep.options === undefined) {
		return step;
	}

	// Resolve preset reference
	let rawOptions: RawStepOption[];
	if (typeof rawStep.options === 'string') {
		const preset = presets[rawStep.options];
		if (!preset) {
			console.warn(`Unknown option preset: ${rawStep.options}`);
			rawOptions = [];
		} else {
			rawOptions = preset;
		}
	} else {
		rawOptions = rawStep.options;
	}

	// Expand each option
	step.options = rawOptions.map(expandOption);

	return step;
}

/**
 * Check if an entry is an option_presets definition (not a step)
 */
export function isPresetsEntry(entry: RawStep | OptionPresetsEntry): entry is OptionPresetsEntry {
	return 'option_presets' in entry;
}

/**
 * Process raw step data: extract presets and expand all steps
 */
export function processStepData(
	rawSteps: (RawStep | OptionPresetsEntry)[],
	topLevelPresets?: Record<string, RawStepOption[]>
): { steps: Step[]; presets: Record<string, RawStepOption[]> } {
	// Collect all presets (top-level and from entries)
	const presets: Record<string, RawStepOption[]> = { ...topLevelPresets };
	const steps: Step[] = [];

	for (const entry of rawSteps) {
		if (isPresetsEntry(entry)) {
			// Merge presets (later definitions overwrite)
			Object.assign(presets, entry.option_presets);
		} else {
			// Process step
			steps.push(expandStepOptions(entry, presets));
		}
	}

	return { steps, presets };
}

/**
 * Check if player has enough of each required tag
 * Counts occurrences of each tag in the requirements and compares to player's tags
 * Tags containing {{variables}} are rendered before comparison
 */
function hasRequiredTags(tags: string[], playerMetadata: string[]): boolean {
	// Count required tags (plain and @ tags, excluding blocked/grant/consume)
	const requiredCounts = new Map<string, number>();
	const blockedTags = new Set<string>();

	for (const tag of tags) {
		if (tag.startsWith('!')) {
			// Render variables in blocked tags
			const renderedTag = gameStore.renderText(tag.substring(1));
			blockedTags.add(renderedTag);
		} else if (!tag.startsWith('+') && !tag.startsWith('-')) {
			// Render variables in required tags
			const baseTag = tag.startsWith('@') ? tag.substring(1) : tag;
			const required = gameStore.renderText(baseTag);
			requiredCounts.set(required, (requiredCounts.get(required) || 0) + 1);
		}
	}

	// Check blocked tags
	for (const blocked of blockedTags) {
		if (playerMetadata.includes(blocked)) {
			return false;
		}
	}

	// Count player's tags
	const playerCounts = new Map<string, number>();
	for (const tag of playerMetadata) {
		playerCounts.set(tag, (playerCounts.get(tag) || 0) + 1);
	}

	// Check if player has enough of each required tag
	for (const [tag, requiredCount] of requiredCounts) {
		const playerCount = playerCounts.get(tag) || 0;
		if (playerCount < requiredCount) {
			return false;
		}
	}

	return true;
}

/**
 * Check if a step passes all hard filters (required and blocked tags)
 * - Plain tags and @tags are both required (player must have)
 * - !tags are blocked (player must NOT have)
 * - +tags and -tags are grants/consumes (not filters)
 * - Duplicate tags require multiple copies (e.g., ["silver", "silver"] needs 2 silver)
 */
function passesHardFilters(step: Step, playerMetadata: string[]): boolean {
	return hasRequiredTags(step.tags || [], playerMetadata);
}

/**
 * Analyze step tags and return detailed info about which tags pass/fail
 */
function analyzeStepTags(step: Step, playerMetadata: string[]): TagAnalysis[] {
	const analysis: TagAnalysis[] = [];
	const playerCounts = new Map<string, number>();

	for (const tag of playerMetadata) {
		playerCounts.set(tag, (playerCounts.get(tag) || 0) + 1);
	}

	// Track required tag counts
	const requiredCounts = new Map<string, number>();

	for (const tag of step.tags || []) {
		if (tag.startsWith('+') || tag.startsWith('-')) {
			// Skip grant/consume tags
			continue;
		}

		if (tag.startsWith('!')) {
			// Blocked tag
			const renderedTag = gameStore.renderText(tag.substring(1));
			const hasTag = playerMetadata.includes(renderedTag);
			analysis.push({
				tag: tag,
				type: 'blocked',
				satisfied: !hasTag // Satisfied if player does NOT have it
			});
		} else {
			// Required tag (plain or @)
			const baseTag = tag.startsWith('@') ? tag.substring(1) : tag;
			const renderedTag = gameStore.renderText(baseTag);
			requiredCounts.set(renderedTag, (requiredCounts.get(renderedTag) || 0) + 1);

			const playerCount = playerCounts.get(renderedTag) || 0;
			const requiredCount = requiredCounts.get(renderedTag) || 1;

			analysis.push({
				tag: tag,
				type: 'required',
				satisfied: playerCount >= requiredCount
			});
		}
	}

	return analysis;
}

/**
 * Get debug info for all steps matching a location ID
 */
export function getStepDebugInfo(locationId: string): StepDebugInfo[] {
	const playerMetadata = gameStore.effectiveMetadata;
	const normalizedId = locationId.toLowerCase();
	const matchingSteps = gameStore.steps.filter((s) => s.id.toLowerCase() === normalizedId);

	return matchingSteps.map((step) => ({
		step,
		eligible: passesHardFilters(step, playerMetadata),
		tagAnalysis: analyzeStepTags(step, playerMetadata)
	}));
}

/**
 * Calculate score for a step based on preferred tags
 * @tags are preferred (scoring boost) in addition to being required
 * Tags containing {{variables}} are rendered before comparison
 */
function calculateStepScore(step: Step, playerMetadata: string[], preferredWeight: number): number {
	let score = 0;
	for (const tag of step.tags || []) {
		// @tags are preferred - they get a scoring boost
		if (tag.startsWith('@')) {
			const preferred = gameStore.renderText(tag.substring(1));
			if (playerMetadata.includes(preferred)) {
				score += preferredWeight;
			}
		}
	}
	return score;
}

/**
 * Select the best step for a given id based on player state
 * Matches are case-insensitive
 */
export function selectStepById(id: string): Step | null {
	const playerMetadata = gameStore.effectiveMetadata;
	const preferredWeight = gameStore.config?.preferredTagWeight ?? 5;

	// Filter by id (case insensitive)
	const normalizedId = id.toLowerCase();
	const matchingSteps = gameStore.steps.filter((s) => s.id.toLowerCase() === normalizedId);

	if (matchingSteps.length === 0) {
		return null;
	}

	// Apply hard filters
	const eligible = matchingSteps.filter((step) => passesHardFilters(step, playerMetadata));

	if (eligible.length === 0) {
		return null;
	}

	// Calculate scores
	const scored = eligible.map((step) => ({
		step,
		score: calculateStepScore(step, playerMetadata, preferredWeight)
	}));

	// Get max score
	const maxScore = Math.max(...scored.map((s) => s.score));

	// Get all steps with max score
	const topSteps = scored.filter((s) => s.score === maxScore);

	// Random selection from top
	return topSteps[Math.floor(Math.random() * topSteps.length)].step;
}


/**
 * Check if a specific option is available to the player
 * - Plain tags and @tags are both required (player must have)
 * - !tags are blocked (player must NOT have)
 * - +tags and -tags are grants/consumes (not filters)
 * - Duplicate tags require multiple copies (e.g., ["silver", "silver"] needs 2 silver)
 */
export function isOptionAvailable(option: StepOption): boolean {
	const playerMetadata = gameStore.effectiveMetadata;
	return hasRequiredTags(option.tags || [], playerMetadata);
}

/**
 * Get all options for a step (regardless of availability)
 */
export function getAllOptions(step: Step): StepOption[] {
	if (!step.options || step.options.length === 0) {
		return [];
	}
	return step.options;
}

/**
 * Filter options based on player's current tags
 * - Plain tags and @tags are both required (player must have)
 * - !tags are blocked (player must NOT have)
 * - +tags and -tags are grants/consumes (not filters)
 * - Duplicate tags require multiple copies (e.g., ["silver", "silver"] needs 2 silver)
 */
export function getAvailableOptions(step: Step): StepOption[] {
	if (!step.options || step.options.length === 0) {
		return [];
	}

	const playerMetadata = gameStore.effectiveMetadata;

	return step.options.filter((option) => {
		return hasRequiredTags(option.tags || [], playerMetadata);
	});
}

/**
 * Check if an array contains object entries (for correlated variables)
 */
function isObjectArray(arr: unknown[]): arr is Record<string, string>[] {
	return arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null;
}

/**
 * Execute a step: apply tag changes, process variables, add to log
 */
export function executeStep(step: Step): string {
	// Apply tag changes first (+ and -), with variable interpolation
	// This must happen before variable changes so tags like "-inv:{{valuable}}"
	// can reference variables before they're cleared
	for (const tag of step.tags || []) {
		if (tag.startsWith('+')) {
			const renderedTag = gameStore.renderText(tag.substring(1));
			gameStore.addTag(renderedTag);
		} else if (tag.startsWith('-')) {
			const renderedTag = gameStore.renderText(tag.substring(1));
			gameStore.removeTag(renderedTag);
		}
	}

	// Process variables after tags
	if (step.vars) {
		for (const [varName, options] of Object.entries(step.vars)) {
			if (options === null) {
				gameStore.clearVariable(varName);
			} else if (Array.isArray(options) && options.length > 0) {
				const randomIndex = Math.floor(Math.random() * options.length);
				const selected = options[randomIndex];

				if (isObjectArray(options)) {
					// Correlated variables: set each key-value pair with namespace prefix
					// e.g., "npc": [{"occupation": "merchant"}] → sets "npc.occupation"
					const obj = selected as Record<string, string>;
					for (const [key, value] of Object.entries(obj)) {
						gameStore.setVariable(`${varName}.${key}`, value);
					}
				} else {
					// Simple string array: set the variable to the selected string
					gameStore.setVariable(varName, selected as string);
				}
			}
		}
	}

	// Add to quest log if specified
	if (step.log) {
		const logEntry = gameStore.renderText(step.log);
		gameStore.addLogEntry(logEntry);
	}

	// Increment steps completed
	gameStore.state.character.stepsCompleted++;

	// Save state
	gameStore.save();

	// Render and return step text
	return gameStore.renderText(step.text);
}

const STAT_NAMES: StatName[] = ['might', 'guile', 'magic'];

/**
 * Check if a string is a stat name
 */
export function isStatName(source: string): source is StatName {
	return STAT_NAMES.includes(source as StatName);
}

/**
 * Calculate expected total bonus from skill sources (for difficulty display)
 */
export function calculateSkillBonus(skill: SkillSource | SkillSource[]): number {
	const sources = Array.isArray(skill) ? skill : [skill];
	return sources.reduce((sum, source) => sum + calculateSourceBonus(source).value, 0);
}

/**
 * Calculate bonus from a single skill source (stat or tag)
 * Stats add their value + modifiers; tags add +2 per copy
 */
function calculateSourceBonus(source: SkillSource): SkillBonus {
	if (isStatName(source)) {
		// It's a stat - add stat value + any modifiers
		const statValue = gameStore.state.character[source];
		const modifier = gameStore.statModifiers[source];
		return {
			source,
			value: statValue + modifier
		};
	} else {
		// It's a tag - add +2 per copy the player has
		const tagCount = gameStore.countTag(source);
		return {
			source,
			value: tagCount * 2
		};
	}
}

/**
 * Resolve a skill check with one or more skill sources
 */
export function resolveSkillCheck(
	skill: SkillSource | SkillSource[],
	dc: number
): SkillCheckResult {
	const roll = Math.floor(Math.random() * 6) + 1;

	// Normalize to array
	const sources = Array.isArray(skill) ? skill : [skill];

	// Calculate all bonuses
	const bonuses: SkillBonus[] = sources.map(calculateSourceBonus);
	const totalBonus = bonuses.reduce((sum, b) => sum + b.value, 0);
	const total = roll + totalBonus;
	const success = total >= dc;

	return {
		roll,
		bonuses,
		totalBonus,
		total,
		dc,
		success
	};
}

/**
 * Navigate to a step by id (coordinate entry or direct navigation)
 * If the id is a map coordinate, it will be resolved to a location name
 */
export function navigateToStep(id: string): void {
	const normalizedId = id.toUpperCase().trim();

	// Special debug locations
	if (normalizedId === 'Z3') {
		if (!gameStore.hasTag('debug_mode')) {
			gameStore.addTag('debug_mode');
			gameStore.save();
			gameStore.errorMessage = 'Debug mode enabled. Check the menu for debug options.';
		} else {
			gameStore.errorMessage = 'Debug mode is already enabled.';
		}
		return;
	}

	if (normalizedId === 'Z4') {
		// Debug: trigger level up
		gameStore.grantXP(5); // Grant enough XP to guarantee a level up
		gameStore.phase = 'level_up';
		gameStore.save();
		return;
	}

	// Resolve coordinate to location name if mapping exists
	const locationId = gameStore.resolveLocation(normalizedId);

	const step = selectStepById(locationId);

	if (!step) {
		gameStore.errorMessage = "You don't see anything of interest here. Try another location.";
		gameStore.currentDisplayStep = null;
		gameStore.availableOptions = [];

		// Populate debug info if debug mode is active
		if (gameStore.hasTag('debug_mode')) {
			gameStore.debugStepInfo = getStepDebugInfo(locationId);
		} else {
			gameStore.debugStepInfo = [];
		}
		return;
	}

	// Clear debug info on successful navigation
	gameStore.debugStepInfo = [];

	loadStep(step);
}

/**
 * Load and display a step
 */
export function loadStep(step: Step): void {
	gameStore.errorMessage = null;

	// Execute the step (process vars, tags, log)
	executeStep(step);

	// Store current step id
	gameStore.state.currentStepId = step.id;

	// Set display step with rendered text
	gameStore.currentDisplayStep = {
		...step,
		text: gameStore.renderText(step.text)
	};

	// Get all options (availability will be checked in the UI)
	gameStore.availableOptions = getAllOptions(step).map((opt) => ({
		...opt,
		label: gameStore.renderText(opt.label)
	}));

	gameStore.phase = 'display_step';
	gameStore.save();
}

/**
 * Handle option selection
 */
export function selectOption(option: StepOption): void {
	// Apply tag changes from the option (+ and -), with variable interpolation
	if (option.tags) {
		for (const tag of option.tags) {
			if (tag.startsWith('+')) {
				const renderedTag = gameStore.renderText(tag.substring(1));
				gameStore.addTag(renderedTag);
			} else if (tag.startsWith('-')) {
				const renderedTag = gameStore.renderText(tag.substring(1));
				gameStore.removeTag(renderedTag);
			}
		}
		gameStore.save();
	}

	if (option.skill && option.dc !== undefined) {
		// This is a skill check option
		gameStore.pendingSkillCheck = {
			option
		};
		gameStore.phase = 'skill_check_roll';
	} else if (option.pass) {
		// Direct navigation to next step
		const nextStep = selectStepById(option.pass);
		if (nextStep) {
			loadStep(nextStep);
		} else {
			gameStore.errorMessage = 'Something went wrong. Returning to navigation.';
			gameStore.phase = 'navigation';
		}
	} else {
		// Return to navigation (pass is null)
		transitionToNavigation();
	}
}

/**
 * Execute the skill check roll
 */
export function executeSkillCheck(): void {
	const option = gameStore.pendingSkillCheck?.option;
	if (!option?.skill || option.dc === undefined) {
		return;
	}

	const result = resolveSkillCheck(option.skill, option.dc);

	gameStore.skillCheckResult = result;
	gameStore.phase = 'skill_check_result';
}

/**
 * Continue after skill check result
 */
export function continueAfterSkillCheck(): void {
	if (!gameStore.pendingSkillCheck || !gameStore.skillCheckResult) {
		return;
	}

	const option = gameStore.pendingSkillCheck.option;
	const success = gameStore.skillCheckResult.success;

	const nextStepId = success ? option.pass : option.fail;

	// Clean up skill check state
	gameStore.pendingSkillCheck = null;
	gameStore.skillCheckResult = null;

	if (nextStepId) {
		const nextStep = selectStepById(nextStepId);
		if (nextStep) {
			loadStep(nextStep);
		} else {
			gameStore.errorMessage = 'Something went wrong. Returning to navigation.';
			gameStore.phase = 'navigation';
		}
	} else {
		// Return to navigation
		transitionToNavigation();
	}
}

/**
 * Complete level up by increasing chosen stat and returning to navigation
 */
export function completeLevelUp(stat: StatName): void {
	gameStore.increaseStat(stat);
	gameStore.phase = 'navigation';
	gameStore.save();
}
