import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const QUESTS_DIR = 'quests';
const OUTPUT_FILE = 'static/steps.json';

/**
 * Find the line and column number for a character position in a string
 * @param {string} content
 * @param {number} position
 * @returns {{ line: number, column: number }}
 */
function getLineAndColumn(content, position) {
	const lines = content.substring(0, position).split('\n');
	return {
		line: lines.length,
		column: lines[lines.length - 1].length + 1
	};
}

/**
 * Find the position of a JSON syntax error
 * @param {string} content
 * @param {string} errorMessage
 * @returns {number | null}
 */
function findErrorPosition(content, errorMessage) {
	// Try to extract position from error message (different Node versions have different formats)
	// Format: "... at position 123"
	let match = errorMessage.match(/position\s+(\d+)/i);
	if (match) return parseInt(match[1], 10);

	// Format: "... at line 5 column 10"
	match = errorMessage.match(/line\s+(\d+)/i);
	if (match) {
		const line = parseInt(match[1], 10);
		const colMatch = errorMessage.match(/column\s+(\d+)/i);
		const col = colMatch ? parseInt(colMatch[1], 10) : 1;
		// Convert line/column to position
		const lines = content.split('\n');
		let pos = 0;
		for (let i = 0; i < line - 1 && i < lines.length; i++) {
			pos += lines[i].length + 1; // +1 for newline
		}
		return pos + col - 1;
	}

	// Try to find the problematic token mentioned in the error
	// Format: "Unexpected token 'X'" or "Unexpected token X"
	match = errorMessage.match(/Unexpected token\s*['"]?([^'",\s]+)['"]?/i);
	if (match) {
		const token = match[1];
		// Look for this token in the content and find likely error locations
		// Common patterns: trailing commas before ] or }
		if (token === ']') {
			// Find ",]" pattern (trailing comma before array close)
			const trailingCommaArray = content.match(/,\s*\]/);
			if (trailingCommaArray) {
				return content.indexOf(trailingCommaArray[0]) + trailingCommaArray[0].length - 1;
			}
		}
		if (token === '}') {
			// Find ",}" pattern (trailing comma before object close)
			const trailingCommaObj = content.match(/,\s*\}/);
			if (trailingCommaObj) {
				return content.indexOf(trailingCommaObj[0]) + trailingCommaObj[0].length - 1;
			}
		}
	}

	return null;
}

/**
 * Parse JSON with better error messages including line numbers
 * @param {string} content
 * @param {string} filename
 * @returns {{ data: any } | { error: string }}
 */
function parseJSON(content, filename) {
	try {
		return { data: JSON.parse(content) };
	} catch (e) {
		if (e instanceof SyntaxError) {
			// Try to find position from error message or by pattern matching
			const position = findErrorPosition(content, e.message);

			if (position !== null) {
				const { line, column } = getLineAndColumn(content, position);
				// Get context around the error (a few lines before and the error line)
				const lines = content.split('\n');
				const startLine = Math.max(0, line - 3);
				const contextLines = [];
				for (let i = startLine; i < line && i < lines.length; i++) {
					const lineNum = i + 1;
					const marker = lineNum === line ? '>>>' : '   ';
					contextLines.push(`${marker} ${lineNum}: ${lines[i]}`);
				}
				const context = contextLines.join('\n');

				return {
					error: `JSON syntax error in ${filename} at line ${line}, column ${column}\n\n${context}\n\nDetails: ${e.message}`
				};
			}
			return { error: `JSON syntax error in ${filename}: ${e.message}` };
		}
		return { error: `Error parsing ${filename}: ${e instanceof Error ? e.message : String(e)}` };
	}
}

/**
 * Write an error output file
 * @param {string} errorMessage
 */
async function writeErrorOutput(errorMessage) {
	const output = { error: errorMessage };
	await writeFile(OUTPUT_FILE, JSON.stringify(output, null, '\t'));
	console.log(`\x1b[31m✗\x1b[0m ${errorMessage}`);
}

async function mergeQuests() {
	try {
		const files = await readdir(QUESTS_DIR);

		// Load config (must exist)
		const configPath = join(QUESTS_DIR, '_config.json');
		let configContent;
		try {
			configContent = await readFile(configPath, 'utf-8');
		} catch {
			await writeErrorOutput('Missing required file: _config.json');
			return false;
		}

		const configResult = parseJSON(configContent, '_config.json');
		if ('error' in configResult) {
			await writeErrorOutput(configResult.error);
			return false;
		}
		const config = configResult.data;

		// Load locations mapping (optional)
		let locations = {};
		const locationsPath = join(QUESTS_DIR, '_locations.json');
		try {
			const locationsContent = await readFile(locationsPath, 'utf-8');
			const locationsResult = parseJSON(locationsContent, '_locations.json');
			if ('error' in locationsResult) {
				await writeErrorOutput(locationsResult.error);
				return false;
			}
			locations = locationsResult.data;
		} catch {
			// No locations file, that's fine
		}

		// Load all quest files (excluding _config.json and _locations.json)
		const questFiles = files.filter((f) => f.endsWith('.json') && !f.startsWith('_'));

		const allSteps = [];
		const questMeta = [];
		/** @type {Record<string, any[]>} */
		const mergedPresets = {};

		for (const file of questFiles.sort()) {
			const filePath = join(QUESTS_DIR, file);
			const content = await readFile(filePath, 'utf-8');

			const questResult = parseJSON(content, file);
			if ('error' in questResult) {
				await writeErrorOutput(questResult.error);
				return false;
			}
			const quest = questResult.data;

			if (quest.steps && Array.isArray(quest.steps)) {
				// Extract option_presets entries and merge them
				for (const step of quest.steps) {
					if (step.option_presets && typeof step.option_presets === 'object') {
						Object.assign(mergedPresets, step.option_presets);
					} else {
						allSteps.push(step);
					}
				}
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
			locations,
			...(Object.keys(mergedPresets).length > 0 && { option_presets: mergedPresets }),
			steps: allSteps
		};

		await writeFile(OUTPUT_FILE, JSON.stringify(output, null, '\t'));

		console.log(`\x1b[32m✓\x1b[0m Merged ${allSteps.length} steps from ${questMeta.length} quest files`);
		return true;
	} catch (e) {
		const errorMessage = `Unexpected error: ${e instanceof Error ? e.message : String(e)}`;
		await writeErrorOutput(errorMessage);
		return false;
	}
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
