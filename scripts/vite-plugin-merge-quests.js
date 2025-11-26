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

	// Count steps by ID (duplicates are allowed for coordinate-based steps)
	/** @type {Record<string, number>} */
	const idCounts = {};
	for (const step of allSteps) {
		idCounts[step.id] = (idCounts[step.id] || 0) + 1;
	}
	const duplicateIds = Object.entries(idCounts)
		.filter(([, count]) => count > 1)
		.map(([id, count]) => `${id} (${count})`);
	if (duplicateIds.length > 0) {
		console.log(`\x1b[33m!\x1b[0m Shared step IDs: ${duplicateIds.join(', ')}`);
	}

	// Build output
	const output = {
		config,
		steps: allSteps
	};

	await writeFile(OUTPUT_FILE, JSON.stringify(output, null, '\t'));

	console.log(`\x1b[32m✓\x1b[0m Merged ${allSteps.length} steps from ${questMeta.length} quest files`);
	return true;
}

/** @returns {import('vite').Plugin} */
export default function mergeQuestsPlugin() {
	return {
		name: 'merge-quests',

		async buildStart() {
			await mergeQuests();
		},

		configureServer(server) {
			// Watch the quests directory for changes
			server.watcher.add(QUESTS_DIR);

			server.watcher.on('change', async (/** @type {string} */ path) => {
				if (path.includes(QUESTS_DIR) && path.endsWith('.json')) {
					console.log(`\x1b[36m[quests]\x1b[0m ${path} changed, regenerating...`);
					await mergeQuests();
				}
			});

			server.watcher.on('add', async (/** @type {string} */ path) => {
				if (path.includes(QUESTS_DIR) && path.endsWith('.json')) {
					console.log(`\x1b[36m[quests]\x1b[0m ${path} added, regenerating...`);
					await mergeQuests();
				}
			});

			server.watcher.on('unlink', async (/** @type {string} */ path) => {
				if (path.includes(QUESTS_DIR) && path.endsWith('.json')) {
					console.log(`\x1b[36m[quests]\x1b[0m ${path} removed, regenerating...`);
					await mergeQuests();
				}
			});
		}
	};
}
