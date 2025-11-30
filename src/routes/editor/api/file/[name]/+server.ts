import { json, error } from '@sveltejs/kit';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import yaml from 'js-yaml';
import type { RequestHandler } from './$types';
import type { QuestFile } from '$lib/types/editor';

const QUESTS_DIR = 'quests';

function isValidQuestFile(filename: string): boolean {
	// Prevent directory traversal and only allow quest files
	if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
		return false;
	}
	if (filename.startsWith('_')) return false;
	return /\.(json|ya?ml)$/i.test(filename);
}

function parseFile(content: string, filename: string): { data?: QuestFile; error?: string } {
	try {
		let data: QuestFile;
		if (/\.ya?ml$/i.test(filename)) {
			data = yaml.load(content) as QuestFile;
		} else {
			data = JSON.parse(content) as QuestFile;
		}

		// Filter out comment-only objects (those without an 'id' property)
		if (data.steps) {
			data.steps = data.steps.filter((step) => 'id' in step && step.id);
		}

		return { data };
	} catch (e) {
		return { error: e instanceof Error ? e.message : String(e) };
	}
}

function serializeToYAML(content: QuestFile): string {
	return yaml.dump(content, {
		indent: 2,
		lineWidth: 120,
		noRefs: true,
		quotingType: '"',
		forceQuotes: false
	});
}

export const GET: RequestHandler = async ({ params }) => {
	const { name } = params;

	if (!name || !isValidQuestFile(name)) {
		return error(400, 'Invalid file name');
	}

	try {
		const filePath = join(QUESTS_DIR, name);
		const content = await readFile(filePath, 'utf-8');
		const result = parseFile(content, name);

		if (result.error) {
			return error(400, `Parse error: ${result.error}`);
		}

		return json({ name, content: result.data });
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
			return error(404, 'File not found');
		}
		console.error('Failed to read quest file:', e);
		return error(500, 'Failed to read file');
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const { name } = params;

	if (!name || !isValidQuestFile(name)) {
		return error(400, 'Invalid file name');
	}

	try {
		const content = (await request.json()) as QuestFile;

		// Always save as YAML, changing extension if needed
		const baseName = name.replace(/\.(json|ya?ml)$/i, '');
		const newName = `${baseName}.yaml`;
		const filePath = join(QUESTS_DIR, newName);

		const yamlContent = serializeToYAML(content);
		await writeFile(filePath, yamlContent, 'utf-8');

		return json({ success: true, name: newName });
	} catch (e) {
		console.error('Failed to save quest file:', e);
		return error(500, `Failed to save file: ${e instanceof Error ? e.message : String(e)}`);
	}
};
