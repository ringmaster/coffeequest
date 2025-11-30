import { json } from '@sveltejs/kit';
import { readFile } from 'fs/promises';
import { join } from 'path';
import yaml from 'js-yaml';
import type { RequestHandler } from './$types';
import type { GameConfig } from '$lib/types/game';

const QUESTS_DIR = 'quests';

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

export const GET: RequestHandler = async () => {
	try {
		const locations = (await loadConfigFile<Record<string, string>>('_locations')) ?? {};
		const config = await loadConfigFile<GameConfig>('_config');

		return json({ locations, config });
	} catch (e) {
		console.error('Failed to load context:', e);
		return json({ locations: {}, config: null }, { status: 500 });
	}
};
