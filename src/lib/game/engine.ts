import type { Step, StepOption, StatName, SkillCheckResult, Stats } from '$lib/types/game';
import { gameStore } from '$lib/stores/gameState.svelte';

/**
 * Check if a step passes all hard filters (required and blocked tags)
 */
function passesHardFilters(step: Step, playerMetadata: string[]): boolean {
	for (const tag of step.tags) {
		// Required tags: @tag
		if (tag.startsWith('@')) {
			const required = tag.substring(1);
			if (!playerMetadata.includes(required)) {
				return false;
			}
		}

		// Blocked tags: !tag
		if (tag.startsWith('!')) {
			const blocked = tag.substring(1);
			if (playerMetadata.includes(blocked)) {
				return false;
			}
		}
	}
	return true;
}

/**
 * Calculate score for a step based on preferred tags
 */
function calculateStepScore(step: Step, playerMetadata: string[], preferredWeight: number): number {
	let score = 0;
	for (const tag of step.tags) {
		// Only count tags without special prefixes as preferred
		if (
			!tag.startsWith('@') &&
			!tag.startsWith('!') &&
			!tag.startsWith('+') &&
			!tag.startsWith('-')
		) {
			if (playerMetadata.includes(tag)) {
				score += preferredWeight;
			}
		}
	}
	return score;
}

/**
 * Select the best step for a given location based on player state
 */
export function selectStepForLocation(location: string): Step | null {
	const playerMetadata = gameStore.state.character.metadata;
	const preferredWeight = gameStore.config?.preferredTagWeight ?? 5;

	// Filter by location
	const locationSteps = gameStore.steps.filter((s) => s.location === location);

	if (locationSteps.length === 0) {
		return null;
	}

	// Apply hard filters
	const eligible = locationSteps.filter((step) => passesHardFilters(step, playerMetadata));

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
 * Get step by ID (for virtual locations)
 */
export function getStepById(stepId: string): Step | null {
	return gameStore.steps.find((s) => s.id === stepId) ?? null;
}

/**
 * Filter options based on player's current tags
 */
export function getAvailableOptions(step: Step): StepOption[] {
	if (!step.options || step.options.length === 0) {
		return [];
	}

	const playerMetadata = gameStore.state.character.metadata;

	return step.options.filter((option) => {
		for (const tag of option.tags || []) {
			// Required
			if (tag.startsWith('@')) {
				if (!playerMetadata.includes(tag.substring(1))) {
					return false;
				}
			}
			// Blocked
			if (tag.startsWith('!')) {
				if (playerMetadata.includes(tag.substring(1))) {
					return false;
				}
			}
			// Regular tags (must have for options)
			if (
				!tag.startsWith('@') &&
				!tag.startsWith('!') &&
				!tag.startsWith('+') &&
				!tag.startsWith('-')
			) {
				if (!playerMetadata.includes(tag)) {
					return false;
				}
			}
		}
		return true;
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
 * Navigate to a location (coordinate entry)
 */
export function navigateToLocation(location: string): void {
	const normalizedLocation = location.toUpperCase().trim();

	const step = selectStepForLocation(normalizedLocation);

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

	// Store current step info
	gameStore.state.currentStep = {
		stepId: step.id,
		location: step.location
	};

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
	if (option.skill && option.dc !== undefined) {
		// This is a skill check option - use the skill from the option directly
		gameStore.pendingSkillCheck = {
			option,
			selectedStat: option.skill
		};
		gameStore.phase = 'skill_check_roll';
	} else if (option.pass) {
		// Direct navigation to next step
		const nextStep = getStepById(option.pass);
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
		gameStore.state.currentStep = null;
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
		const nextStep = getStepById(nextStepId);
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
		gameStore.state.currentStep = null;
		gameStore.phase = 'navigation';
		gameStore.save();
	}
}
