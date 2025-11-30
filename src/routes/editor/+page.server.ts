import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import yaml from 'js-yaml';
import type { PageServerLoad } from './$types';
import type { GameConfig } from '$lib/types/game';

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

export const load: PageServerLoad = async () => {
	try {
		const files = await readdir(QUESTS_DIR);
		const questFiles = files.filter(isQuestFile).sort();
		const locations = (await loadConfigFile<Record<string, string>>('_locations')) ?? {};
		const config = await loadConfigFile<GameConfig>('_config');

		return {
			files: questFiles,
			locations,
			config
		};
	} catch (e) {
		console.error('Failed to load editor data:', e);
		return {
			files: [],
			locations: {},
			config: null
		};
	}
};
