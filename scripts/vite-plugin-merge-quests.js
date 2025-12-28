import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import yaml from 'js-yaml';

const QUESTS_DIR = 'quests';
const OUTPUT_FILE = 'static/steps.json';

/**
 * Check if a filename is a quest file (json or yaml, not starting with _)
 * @param {string} filename
 * @returns {boolean}
 */
function isQuestFile(filename) {
	if (filename.startsWith('_')) return false;
	return /\.(json|ya?ml)$/i.test(filename);
}

/**
 * Check if a path is a quest-related file (json or yaml)
 * @param {string} path
 * @returns {boolean}
 */
function isQuestRelatedFile(path) {
	return /\.(json|ya?ml)$/i.test(path);
}

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
 * Parse YAML with error messages including line numbers
 * @param {string} content
 * @param {string} filename
 * @returns {{ data: any } | { error: string }}
 */
function parseYAML(content, filename) {
	try {
		const data = yaml.load(content);
		return { data };
	} catch (e) {
		if (e instanceof yaml.YAMLException) {
			const mark = e.mark;
			if (mark) {
				// Get context around the error
				const lines = content.split('\n');
				const line = mark.line + 1; // js-yaml uses 0-based line numbers
				const column = mark.column + 1;
				const startLine = Math.max(0, line - 3);
				const contextLines = [];
				for (let i = startLine; i < line && i < lines.length; i++) {
					const lineNum = i + 1;
					const marker = lineNum === line ? '>>>' : '   ';
					contextLines.push(`${marker} ${lineNum}: ${lines[i]}`);
				}
				const context = contextLines.join('\n');

				return {
					error: `YAML syntax error in ${filename} at line ${line}, column ${column}\n\n${context}\n\nDetails: ${e.reason || e.message}`
				};
			}
			return { error: `YAML syntax error in ${filename}: ${e.reason || e.message}` };
		}
		return { error: `Error parsing ${filename}: ${e instanceof Error ? e.message : String(e)}` };
	}
}

/**
 * Parse a file based on its extension (JSON or YAML)
 * @param {string} content
 * @param {string} filename
 * @returns {{ data: any } | { error: string }}
 */
function parseFile(content, filename) {
	if (/\.ya?ml$/i.test(filename)) {
		return parseYAML(content, filename);
	}
	return parseJSON(content, filename);
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
	try {
		const files = await readdir(QUESTS_DIR);

		// Load config (must exist - try json, yaml, yml in order)
		let config = null;
		let configFilename = null;
		for (const ext of ['.json', '.yaml', '.yml']) {
			const filename = `_config${ext}`;
			const configPath = join(QUESTS_DIR, filename);
			try {
				const configContent = await readFile(configPath, 'utf-8');
				const configResult = parseFile(configContent, filename);
				if ('error' in configResult) {
					await writeErrorOutput(configResult.error);
					return false;
				}
				config = configResult.data;
				configFilename = filename;
				break;
			} catch {
				// Try next extension
			}
		}
		if (config === null) {
			await writeErrorOutput('Missing required file: _config.json (or _config.yaml/_config.yml)');
			return false;
		}

		// Load locations mapping (optional - try json, yaml, yml in order)
		let locations = {};
		for (const ext of ['.json', '.yaml', '.yml']) {
			const filename = `_locations${ext}`;
			const locationsPath = join(QUESTS_DIR, filename);
			try {
				const locationsContent = await readFile(locationsPath, 'utf-8');
				const locationsResult = parseFile(locationsContent, filename);
				if ('error' in locationsResult) {
					await writeErrorOutput(locationsResult.error);
					return false;
				}
				locations = locationsResult.data;
				break;
			} catch {
				// Try next extension
			}
		}

		// Load all quest files (excluding files starting with _)
		const questFiles = files.filter(isQuestFile);

		const allSteps = [];
		const allPatches = [];
		const questMeta = [];
		/** @type {Record<string, any[]>} */
		const mergedPresets = {};

		for (const file of questFiles.sort()) {
			const filePath = join(QUESTS_DIR, file);
			const content = await readFile(filePath, 'utf-8');

			const questResult = parseFile(content, file);
			if ('error' in questResult) {
				await writeErrorOutput(questResult.error);
				return false;
			}
			const quest = questResult.data;

			// Merge top-level option_presets from the quest file
			if (quest.option_presets && typeof quest.option_presets === 'object') {
				Object.assign(mergedPresets, quest.option_presets);
			}

			if (quest.steps && Array.isArray(quest.steps)) {
				// Extract option_presets entries, patches, and regular steps
				// Skip entries without an id (comment-only objects)
				for (const step of quest.steps) {
					if (step.option_presets && typeof step.option_presets === 'object') {
						Object.assign(mergedPresets, step.option_presets);
					} else if (step.id) {
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
			// Error if patch targets another patch (i.e., target starts with @patch:)
			if (patch.target.startsWith(PATCH_PREFIX)) {
				patchErrors.push(
					`Patch in ${patch._sourceFile} targets another patch: @patch:${patch.target}`
				);
			}
			// Warn if patch targets a step ID that doesn't exist
			else if (!regularStepIds.has(patch.target)) {
				patchWarnings.push(
					`Patch in ${patch._sourceFile} targets non-existent step: ${patch.target}`
				);
			}
		}

		// Report patch errors (fatal)
		if (patchErrors.length > 0) {
			await writeErrorOutput(`Patch validation errors:\n${patchErrors.join('\n')}`);
			return false;
		}

		// Report patch warnings
		for (const warning of patchWarnings) {
			console.log(`\x1b[33m!\x1b[0m ${warning}`);
		}

		// Clean up internal _sourceFile from patches before output
		const cleanPatches = allPatches.map(({ _sourceFile, ...patch }) => patch);

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
			steps: allSteps,
			...(cleanPatches.length > 0 && { patches: cleanPatches })
		};

		await writeFile(OUTPUT_FILE, JSON.stringify(output, null, '\t'));

		let message = `\x1b[32m✓\x1b[0m Merged ${allSteps.length} steps`;
		if (cleanPatches.length > 0) {
			message += ` and ${cleanPatches.length} patches`;
		}
		message += ` from ${questMeta.length} quest files`;
		console.log(message);
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
				if (path.includes(QUESTS_DIR) && isQuestRelatedFile(path)) {
					console.log(`\x1b[36m[quests]\x1b[0m ${path} changed, regenerating...`);
					await mergeQuests();
				}
			});

			server.watcher.on('add', async (/** @type {string} */ path) => {
				if (path.includes(QUESTS_DIR) && isQuestRelatedFile(path)) {
					console.log(`\x1b[36m[quests]\x1b[0m ${path} added, regenerating...`);
					await mergeQuests();
				}
			});

			server.watcher.on('unlink', async (/** @type {string} */ path) => {
				if (path.includes(QUESTS_DIR) && isQuestRelatedFile(path)) {
					console.log(`\x1b[36m[quests]\x1b[0m ${path} removed, regenerating...`);
					await mergeQuests();
				}
			});
		}
	};
}
