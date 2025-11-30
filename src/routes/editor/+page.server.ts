import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import yaml from 'js-yaml';
import type { PageServerLoad } from './$types';
import type { GameConfig, RawStep, RawStepOption } from '$lib/types/game';

const QUESTS_DIR = 'quests';

function isQuestFile(filename: string): boolean {
	if (filename.startsWith('_')) return false;
	return /\.(json|ya?ml)$/i.test(filename);
}

async function loadConfigFile<T>(baseName: string): Promise<T | null> {
	for (const ext of ['.json', '.yaml', '.yml']) {
		try {
			const filePath = join(QUESTS_DIR, `${baseName}${ext}`);
			const content = await readFile(filePath, 'utf-8');
			if (/\.ya?ml$/i.test(ext)) {
				return yaml.load(content) as T;
			}
			return JSON.parse(content) as T;
		} catch {
			// Try next extension
		}
	}
	return null;
}

interface QuestFileData {
	steps?: RawStep[];
	option_presets?: Record<string, RawStepOption[]>;
}

async function loadAllQuestSteps(files: string[]): Promise<{
	allSteps: RawStep[];
	allPresets: Record<string, RawStepOption[]>;
}> {
	const allSteps: RawStep[] = [];
	const allPresets: Record<string, RawStepOption[]> = {};

	for (const filename of files) {
		try {
			const filePath = join(QUESTS_DIR, filename);
			const content = await readFile(filePath, 'utf-8');
			let data: QuestFileData;

			if (/\.ya?ml$/i.test(filename)) {
				data = yaml.load(content) as QuestFileData;
			} else {
				data = JSON.parse(content) as QuestFileData;
			}

			// Add steps (filtering out comment-only objects)
			if (data.steps) {
				const validSteps = data.steps.filter(
					(step): step is RawStep => 'id' in step && Boolean(step.id)
				);
				allSteps.push(...validSteps);
			}

			// Merge option presets
			if (data.option_presets) {
				Object.assign(allPresets, data.option_presets);
			}
		} catch (e) {
			console.error(`Failed to load quest file ${filename}:`, e);
		}
	}

	return { allSteps, allPresets };
}

export const load: PageServerLoad = async () => {
	try {
		const files = await readdir(QUESTS_DIR);
		const questFiles = files.filter(isQuestFile).sort();
		const locations = (await loadConfigFile<Record<string, string>>('_locations')) ?? {};
		const config = await loadConfigFile<GameConfig>('_config');

		// Load all quest steps for the simulator
		const { allSteps, allPresets } = await loadAllQuestSteps(questFiles);

		return {
			files: questFiles,
			locations,
			config,
			allSteps,
			allPresets
		};
	} catch (e) {
		console.error('Failed to load editor data:', e);
		return {
			files: [],
			locations: {},
			config: null,
			allSteps: [] as RawStep[],
			allPresets: {} as Record<string, RawStepOption[]>
		};
	}
};
