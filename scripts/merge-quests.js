import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const QUESTS_DIR = 'quests';
const OUTPUT_FILE = 'static/steps.json';
const PATCH_PREFIX = '@patch:';

/**
 * Check if a step is a patch (id starts with @patch:)
 * @param {any} step
 * @returns {boolean}
 */
function isPatchStep(step) {
	return typeof step.id === 'string' && step.id.startsWith(PATCH_PREFIX);
}

/**
 * Convert a patch step to a StepPatch object
 * @param {any} step
 * @returns {{ target: string, tags?: string[], text?: any, options?: any[], vars?: any }}
 */
function stepToPatch(step) {
	const target = step.id.substring(PATCH_PREFIX.length);
	/** @type {{ target: string, tags?: string[], text?: any, options?: any[], vars?: any }} */
	const patch = { target };

	if (step.tags) patch.tags = step.tags;
	if (step.text) patch.text = step.text;
	if (step.options) patch.options = step.options;
	if (step.vars) patch.vars = step.vars;

	return patch;
}

async function mergeQuests() {
	const files = await readdir(QUESTS_DIR);

	// Load config (must exist)
	const configPath = join(QUESTS_DIR, '_config.json');
	const configContent = await readFile(configPath, 'utf-8');
	const config = JSON.parse(configContent);

	// Load all quest files (excluding _config.json)
	const questFiles = files.filter((f) => f.endsWith('.json') && !f.startsWith('_'));

	const allSteps = [];
	const allPatches = [];
	const questMeta = [];

	for (const file of questFiles.sort()) {
		const filePath = join(QUESTS_DIR, file);
		const content = await readFile(filePath, 'utf-8');
		const quest = JSON.parse(content);

		if (quest.steps && Array.isArray(quest.steps)) {
			for (const step of quest.steps) {
				if (step.id) {
					if (isPatchStep(step)) {
						allPatches.push({ ...stepToPatch(step), _sourceFile: file });
					} else {
						allSteps.push(step);
					}
				}
			}
			questMeta.push({
				file,
				name: quest.name || file,
				stepCount: quest.steps.length
			});
		}
	}

	// Collect all regular step IDs for validation
	const regularStepIds = new Set(allSteps.map((s) => s.id));

	// Validate patches
	const patchErrors = [];
	const patchWarnings = [];
	for (const patch of allPatches) {
		// Error if patch targets another patch
		if (patch.target.startsWith(PATCH_PREFIX)) {
			patchErrors.push(`Patch in ${patch._sourceFile} targets another patch: @patch:${patch.target}`);
		}
		// Warn if patch targets a step ID that doesn't exist
		else if (!regularStepIds.has(patch.target)) {
			patchWarnings.push(`Patch in ${patch._sourceFile} targets non-existent step: ${patch.target}`);
		}
	}

	// Report patch errors (fatal)
	if (patchErrors.length > 0) {
		console.error('ERROR: Patch validation errors:');
		for (const error of patchErrors) {
			console.error(`  ${error}`);
		}
		process.exit(1);
	}

	// Report patch warnings
	for (const warning of patchWarnings) {
		console.warn(`WARNING: ${warning}`);
	}

	// Clean up internal _sourceFile from patches before output
	const cleanPatches = allPatches.map(({ _sourceFile, ...patch }) => patch);

	// Check for duplicate step IDs (now allowed for location-based steps)
	const stepIds = new Set();
	const duplicates = [];
	for (const step of allSteps) {
		if (stepIds.has(step.id)) {
			duplicates.push(step.id);
		}
		stepIds.add(step.id);
	}

	if (duplicates.length > 0) {
		console.log(`Shared step IDs: ${duplicates.join(', ')}`);
	}

	// Build output
	const output = {
		config,
		steps: allSteps,
		...(cleanPatches.length > 0 && { patches: cleanPatches })
	};

	await writeFile(OUTPUT_FILE, JSON.stringify(output, null, '\t'));

	// Report
	console.log('Quest files merged successfully!');
	console.log(`Output: ${OUTPUT_FILE}`);
	console.log(`Total steps: ${allSteps.length}`);
	if (cleanPatches.length > 0) {
		console.log(`Total patches: ${cleanPatches.length}`);
	}
	console.log('\nQuests included:');
	for (const meta of questMeta) {
		console.log(`  - ${meta.name} (${meta.stepCount} steps)`);
	}
}

mergeQuests().catch((err) => {
	console.error('Failed to merge quests:', err);
	process.exit(1);
});
