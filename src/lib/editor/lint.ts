import type { QuestFile, LintResult, LintSeverity } from '$lib/types/editor';
import type { RawStep, RawStepOption, StepOption } from '$lib/types/game';
import { parseTag, isPatchStep, getPatchTarget } from '$lib/stores/editorState.svelte';

const PATCH_PREFIX = '@patch:';

/**
 * Run all lint checks on a quest file
 */
export function lintQuestFile(
	questFile: QuestFile,
	locations: Record<string, string> = {}
): LintResult[] {
	const results: LintResult[] = [];

	// Collect all step IDs (excluding patches)
	const stepIds = new Set(
		questFile.steps.filter((s) => !isPatchStep(s)).map((s) => s.id)
	);

	// Collect all location names (from _locations.json + steps that look like locations)
	const locationNames = new Set(Object.values(locations));
	questFile.steps.forEach((s) => {
		if (!isPatchStep(s) && !s.id.includes('_')) {
			locationNames.add(s.id);
		}
	});

	// Run each lint check
	results.push(...checkBrokenTargets(questFile, stepIds));
	results.push(...checkUndefinedVariables(questFile));
	results.push(...checkUnusedVariables(questFile));
	results.push(...checkOrphanSteps(questFile, stepIds, locationNames));
	results.push(...checkMissingQuestGate(questFile, locationNames));
	results.push(...checkTagTypos(questFile));
	results.push(...checkPatchTargets(questFile, stepIds));

	// Sort by severity
	const severityOrder: Record<LintSeverity, number> = { error: 0, warning: 1, info: 2 };
	results.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

	return results;
}

/**
 * Check for broken pass/fail targets
 */
function checkBrokenTargets(questFile: QuestFile, stepIds: Set<string>): LintResult[] {
	const results: LintResult[] = [];

	questFile.steps.forEach((step, stepIndex) => {
		const options = expandOptions(step.options, questFile.option_presets);

		options.forEach((opt, optIndex) => {
			const option = typeof opt === 'string' ? parseShorthandOption(opt) : opt;

			if (option.pass && !stepIds.has(option.pass)) {
				results.push({
					severity: 'error',
					code: 'broken_pass_target',
					message: `Option "${option.label}" references non-existent step: ${option.pass}`,
					stepId: step.id,
					stepIndex,
					optionIndex: optIndex
				});
			}

			if (option.fail && !stepIds.has(option.fail)) {
				results.push({
					severity: 'error',
					code: 'broken_fail_target',
					message: `Option "${option.label}" fail target references non-existent step: ${option.fail}`,
					stepId: step.id,
					stepIndex,
					optionIndex: optIndex
				});
			}
		});
	});

	return results;
}

/**
 * Check for undefined variables in text
 */
function checkUndefinedVariables(questFile: QuestFile): LintResult[] {
	const results: LintResult[] = [];

	// Build a map of all variables defined across all steps
	const globalVarMap = new Map<string, { stepIndex: number; stepId: string }>();
	questFile.steps.forEach((step, stepIndex) => {
		if (step.vars) {
			for (const varName of Object.keys(step.vars)) {
				// Only track the first occurrence
				if (!globalVarMap.has(varName)) {
					globalVarMap.set(varName, { stepIndex, stepId: step.id });
				}
			}
		}
	});

	questFile.steps.forEach((step, stepIndex) => {
		const definedVars = new Set(Object.keys(step.vars ?? {}));
		const usedVars = extractVariables(step.text);

		// Also check log
		if (step.log) {
			usedVars.push(...extractVariables(step.log));
		}

		// Also check option labels
		const options = expandOptions(step.options, questFile.option_presets);
		options.forEach((opt) => {
			const label = typeof opt === 'string' ? opt.split('::')[0] : opt.label;
			usedVars.push(...extractVariables(label));
		});

		const seenVars = new Set<string>();
		for (const varName of usedVars) {
			const baseName = varName.split('.')[0];
			// Skip duplicates
			if (seenVars.has(baseName)) continue;
			seenVars.add(baseName);

			if (!definedVars.has(varName) && !definedVars.has(baseName)) {
				// Check if defined in another step
				const otherDef = globalVarMap.get(baseName);
				if (otherDef && otherDef.stepIndex !== stepIndex) {
					results.push({
						severity: 'info',
						code: 'variable_from_other_step',
						message: `Variable "{{${varName}}}" is defined in step "${otherDef.stepId}"`,
						stepId: step.id,
						stepIndex,
						relatedStepId: otherDef.stepId,
						relatedStepIndex: otherDef.stepIndex
					});
				} else {
					results.push({
						severity: 'warning',
						code: 'undefined_variable',
						message: `Variable "{{${varName}}}" is used but not defined anywhere`,
						stepId: step.id,
						stepIndex
					});
				}
			}
		}
	});

	return results;
}

/**
 * Check for unused variables
 */
function checkUnusedVariables(questFile: QuestFile): LintResult[] {
	const results: LintResult[] = [];

	questFile.steps.forEach((step, stepIndex) => {
		if (!step.vars) return;

		const definedVars = Object.keys(step.vars);
		const allText = [
			step.text,
			step.log ?? '',
			...(expandOptions(step.options, questFile.option_presets).map((opt) =>
				typeof opt === 'string' ? opt : opt.label
			))
		].join(' ');

		for (const varName of definedVars) {
			// Check if variable or any of its fields are used
			const pattern = new RegExp(`\\{\\{${varName}(\\.\\w+)?\\}\\}`, 'g');
			if (!pattern.test(allText)) {
				results.push({
					severity: 'info',
					code: 'unused_variable',
					message: `Variable "${varName}" is defined but never used`,
					stepId: step.id,
					stepIndex
				});
			}
		}
	});

	return results;
}

/**
 * Check for orphan internal steps (never referenced by any option)
 */
function checkOrphanSteps(
	questFile: QuestFile,
	stepIds: Set<string>,
	locationNames: Set<string>
): LintResult[] {
	const results: LintResult[] = [];

	// Collect all referenced step IDs
	const referencedIds = new Set<string>();
	questFile.steps.forEach((step) => {
		const options = expandOptions(step.options, questFile.option_presets);
		options.forEach((opt) => {
			const option = typeof opt === 'string' ? parseShorthandOption(opt) : opt;
			if (option.pass) referencedIds.add(option.pass);
			if (option.fail) referencedIds.add(option.fail);
		});
	});

	// Find internal steps that are never referenced
	questFile.steps.forEach((step, stepIndex) => {
		// Skip patches (they're not referenced but are valid)
		if (isPatchStep(step)) return;

		// Skip location steps (they're entry points)
		if (locationNames.has(step.id) || !step.id.includes('_')) return;

		if (!referencedIds.has(step.id)) {
			results.push({
				severity: 'warning',
				code: 'orphan_step',
				message: `Internal step "${step.id}" is never referenced by any option`,
				stepId: step.id,
				stepIndex
			});
		}
	});

	return results;
}

/**
 * Check for location steps missing quest gates
 */
function checkMissingQuestGate(questFile: QuestFile, locationNames: Set<string>): LintResult[] {
	const results: LintResult[] = [];

	questFile.steps.forEach((step, stepIndex) => {
		// Skip patches
		if (isPatchStep(step)) return;

		// Only check location steps
		if (!locationNames.has(step.id) && step.id.includes('_')) return;

		const tags = step.tags ?? [];
		const hasQuestGate = tags.some((t) => {
			const { operator, tag } = parseTag(t);
			return (
				(operator === '!' && tag === 'quest') ||
				(operator === '@' && tag.startsWith('q:')) ||
				(operator === '' && tag.startsWith('q:'))
			);
		});

		if (!hasQuestGate) {
			results.push({
				severity: 'warning',
				code: 'missing_quest_gate',
				message: `Location step "${step.id}" lacks quest gate (add !quest or @q:questname)`,
				stepId: step.id,
				stepIndex
			});
		}
	});

	return results;
}

/**
 * Check for potential tag typos using Levenshtein distance
 */
function checkTagTypos(questFile: QuestFile): LintResult[] {
	const results: LintResult[] = [];

	// Collect all tags
	const allTags = new Map<string, number>(); // tag -> count
	questFile.steps.forEach((step) => {
		for (const rawTag of step.tags ?? []) {
			const { tag } = parseTag(rawTag);
			allTags.set(tag, (allTags.get(tag) ?? 0) + 1);
		}
	});

	// Find tags that are similar to others but only appear once
	const tagList = Array.from(allTags.keys());
	for (const [tag, count] of allTags.entries()) {
		if (count > 1) continue; // Skip tags used multiple times

		for (const other of tagList) {
			if (tag === other) continue;
			if (allTags.get(other)! <= 1) continue; // Only compare against common tags

			const distance = levenshteinDistance(tag, other);
			const maxLen = Math.max(tag.length, other.length);

			// If edit distance is small relative to length, it might be a typo
			if (distance === 1 || (distance === 2 && maxLen > 6)) {
				// Find which step has this tag
				const stepIndex = questFile.steps.findIndex((s) =>
					s.tags?.some((t) => parseTag(t).tag === tag)
				);

				results.push({
					severity: 'info',
					code: 'tag_typo_candidate',
					message: `Tag "${tag}" is similar to "${other}" - possible typo?`,
					stepId: stepIndex >= 0 ? questFile.steps[stepIndex].id : undefined,
					stepIndex: stepIndex >= 0 ? stepIndex : undefined
				});
				break; // Only report once per tag
			}
		}
	}

	return results;
}

/**
 * Check patch targets are valid
 */
function checkPatchTargets(questFile: QuestFile, stepIds: Set<string>): LintResult[] {
	const results: LintResult[] = [];

	questFile.steps.forEach((step, stepIndex) => {
		if (!isPatchStep(step)) return;

		const target = getPatchTarget(step);

		// Check for empty target
		if (!target) {
			results.push({
				severity: 'error',
				code: 'patch_missing_target',
				message: 'Patch is missing a target step ID',
				stepId: step.id,
				stepIndex
			});
			return;
		}

		// Check for non-existent target
		if (!stepIds.has(target)) {
			results.push({
				severity: 'warning',
				code: 'patch_unknown_target',
				message: `Patch targets non-existent step: ${target}`,
				stepId: step.id,
				stepIndex
			});
		}

		// Check for patch targeting another patch
		if (target.startsWith(PATCH_PREFIX)) {
			results.push({
				severity: 'error',
				code: 'patch_targets_patch',
				message: `Patch cannot target another patch: ${target}`,
				stepId: step.id,
				stepIndex
			});
		}
	});

	return results;
}

// Helper functions

function extractVariables(text: string): string[] {
	const matches = text.matchAll(/\{\{([\w.]+)\}\}/g);
	return [...matches].map((m) => m[1]);
}

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

function parseShorthandOption(opt: string): StepOption {
	const match = opt.match(/^(.+?)(?:::(.+))?$/);
	if (match) {
		return {
			label: match[1],
			tags: [],
			pass: match[2] || null
		};
	}
	return { label: opt, tags: [], pass: null };
}

function levenshteinDistance(a: string, b: string): number {
	const matrix: number[][] = [];

	for (let i = 0; i <= b.length; i++) {
		matrix[i] = [i];
	}
	for (let j = 0; j <= a.length; j++) {
		matrix[0][j] = j;
	}

	for (let i = 1; i <= b.length; i++) {
		for (let j = 1; j <= a.length; j++) {
			if (b.charAt(i - 1) === a.charAt(j - 1)) {
				matrix[i][j] = matrix[i - 1][j - 1];
			} else {
				matrix[i][j] = Math.min(
					matrix[i - 1][j - 1] + 1, // substitution
					matrix[i][j - 1] + 1, // insertion
					matrix[i - 1][j] + 1 // deletion
				);
			}
		}
	}

	return matrix[b.length][a.length];
}
