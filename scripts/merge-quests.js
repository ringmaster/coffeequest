import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const QUESTS_DIR = 'quests';
const OUTPUT_FILE = 'static/steps.json';

async function mergeQuests() {
	const files = await readdir(QUESTS_DIR);

	// Load config (must exist)
	const configPath = join(QUESTS_DIR, '_config.json');
	const configContent = await readFile(configPath, 'utf-8');
	const config = JSON.parse(configContent);

	// Load all quest files (excluding _config.json)
	const questFiles = files.filter((f) => f.endsWith('.json') && !f.startsWith('_'));

	const allSteps = [];
	const questMeta = [];

	for (const file of questFiles.sort()) {
		const filePath = join(QUESTS_DIR, file);
		const content = await readFile(filePath, 'utf-8');
		const quest = JSON.parse(content);

		if (quest.steps && Array.isArray(quest.steps)) {
			allSteps.push(...quest.steps);
			questMeta.push({
				file,
				name: quest.name || file,
				stepCount: quest.steps.length
			});
		}
	}

	// Check for duplicate step IDs
	const stepIds = new Set();
	const duplicates = [];
	for (const step of allSteps) {
		if (stepIds.has(step.id)) {
			duplicates.push(step.id);
		}
		stepIds.add(step.id);
	}

	if (duplicates.length > 0) {
		console.error('ERROR: Duplicate step IDs found:', duplicates);
		process.exit(1);
	}

	// Build output
	const output = {
		config,
		steps: allSteps
	};

	await writeFile(OUTPUT_FILE, JSON.stringify(output, null, '\t'));

	// Report
	console.log('Quest files merged successfully!');
	console.log(`Output: ${OUTPUT_FILE}`);
	console.log(`Total steps: ${allSteps.length}`);
	console.log('\nQuests included:');
	for (const meta of questMeta) {
		console.log(`  - ${meta.name} (${meta.stepCount} steps)`);
	}
}

mergeQuests().catch((err) => {
	console.error('Failed to merge quests:', err);
	process.exit(1);
});
