import type { Step, StepOption, StatName, SkillCheckResult, Stats } from '$lib/types/game';
import { gameStore } from '$lib/stores/gameState.svelte';

/**
 * Check if player has enough of each required tag
 * Counts occurrences of each tag in the requirements and compares to player's tags
 */
function hasRequiredTags(tags: string[], playerMetadata: string[]): boolean {
	// Count required tags (plain and @ tags, excluding blocked/grant/consume)
	const requiredCounts = new Map<string, number>();
	const blockedTags = new Set<string>();

	for (const tag of tags) {
		if (tag.startsWith('!')) {
			blockedTags.add(tag.substring(1));
		} else if (!tag.startsWith('+') && !tag.startsWith('-')) {
			const required = tag.startsWith('@') ? tag.substring(1) : tag;
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
	return hasRequiredTags(step.tags, playerMetadata);
}

/**
 * Calculate score for a step based on preferred tags
 * @tags are preferred (scoring boost) in addition to being required
 */
function calculateStepScore(step: Step, playerMetadata: string[], preferredWeight: number): number {
	let score = 0;
	for (const tag of step.tags) {
		// @tags are preferred - they get a scoring boost
		if (tag.startsWith('@')) {
			const preferred = tag.substring(1);
			if (playerMetadata.includes(preferred)) {
				score += preferredWeight;
			}
		}
	}
	return score;
}

/**
 * Select the best step for a given id based on player state
 */
export function selectStepById(id: string): Step | null {
	const playerMetadata = gameStore.state.character.metadata;
	const preferredWeight = gameStore.config?.preferredTagWeight ?? 5;

	// Filter by id
	const matchingSteps = gameStore.steps.filter((s) => s.id === id);

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

	const playerMetadata = gameStore.state.character.metadata;

	return step.options.filter((option) => {
		return hasRequiredTags(option.tags || [], playerMetadata);
	});
}

/**
 * Execute a step: process variables, apply tag changes, add to log
 */
export function executeStep(step: Step): string {
	// Process variables first
	if (step.vars) {
		for (const [varName, options] of Object.entries(step.vars)) {
			if (options === null) {
				gameStore.clearVariable(varName);
			} else if (Array.isArray(options) && options.length > 0) {
				const randomValue = options[Math.floor(Math.random() * options.length)];
				gameStore.setVariable(varName, randomValue);
			}
		}
	}

	// Apply tag changes (+ and -)
	for (const tag of step.tags) {
		if (tag.startsWith('+')) {
			gameStore.addTag(tag.substring(1));
		} else if (tag.startsWith('-')) {
			gameStore.removeTag(tag.substring(1));
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

/**
 * Resolve a skill check
 */
export function resolveSkillCheck(
	stat: StatName,
	dc: number,
	statModifiers: Stats
): SkillCheckResult {
	const roll = Math.floor(Math.random() * 6) + 1;
	const statValue = gameStore.state.character[stat];
	const modifier = statModifiers[stat];
	const total = roll + statValue + modifier;
	const success = total >= dc;

	return {
		roll,
		statValue,
		modifier,
		total,
		dc,
		success
	};
}

/**
 * Navigate to a step by id (coordinate entry or direct navigation)
 */
export function navigateToStep(id: string): void {
	const normalizedId = id.toUpperCase().trim();

	// Special debug location
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

	const step = selectStepById(normalizedId);

	if (!step) {
		gameStore.errorMessage = "You don't see anything of interest here. Try another location.";
		gameStore.currentDisplayStep = null;
		gameStore.availableOptions = [];
		return;
	}

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

	// Get available options
	gameStore.availableOptions = getAvailableOptions(step).map((opt) => ({
		...opt,
		label: gameStore.renderText(opt.label)
	}));

	// Check for stat increase
	const increasedStat = gameStore.checkStatIncrease();
	if (increasedStat) {
		// Could show a notification here
		console.log(`${increasedStat} increased!`);
	}

	gameStore.phase = 'display_step';
	gameStore.save();
}

/**
 * Handle option selection
 */
export function selectOption(option: StepOption): void {
	// Apply tag changes from the option (+ and -)
	if (option.tags) {
		for (const tag of option.tags) {
			if (tag.startsWith('+')) {
				gameStore.addTag(tag.substring(1));
			} else if (tag.startsWith('-')) {
				gameStore.removeTag(tag.substring(1));
			}
		}
		gameStore.save();
	}

	if (option.skill && option.dc !== undefined) {
		// This is a skill check option - use the skill from the option directly
		gameStore.pendingSkillCheck = {
			option,
			selectedStat: option.skill
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
		gameStore.currentDisplayStep = null;
		gameStore.availableOptions = [];
		gameStore.state.currentStepId = null;
		gameStore.phase = 'navigation';
		gameStore.save();
	}
}

/**
 * Execute the skill check roll
 */
export function executeSkillCheck(): void {
	if (!gameStore.pendingSkillCheck?.selectedStat || !gameStore.pendingSkillCheck.option.dc) {
		return;
	}

	const result = resolveSkillCheck(
		gameStore.pendingSkillCheck.selectedStat,
		gameStore.pendingSkillCheck.option.dc,
		gameStore.statModifiers
	);

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
		gameStore.currentDisplayStep = null;
		gameStore.availableOptions = [];
		gameStore.state.currentStepId = null;
		gameStore.phase = 'navigation';
		gameStore.save();
	}
}
