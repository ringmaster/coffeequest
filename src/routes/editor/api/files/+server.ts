import { json } from '@sveltejs/kit';
import { readdir } from 'fs/promises';
import { join } from 'path';
import type { RequestHandler } from './$types';

const QUESTS_DIR = 'quests';

function isQuestFile(filename: string): boolean {
	if (filename.startsWith('_')) return false;
	return /\.(json|ya?ml)$/i.test(filename);
}

export const GET: RequestHandler = async () => {
	try {
		const files = await readdir(QUESTS_DIR);
		const questFiles = files.filter(isQuestFile).sort();
		return json({ files: questFiles });
	} catch (e) {
		console.error('Failed to list quest files:', e);
		return json({ files: [] }, { status: 500 });
	}
};
