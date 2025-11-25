import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import mergeQuests from './scripts/vite-plugin-merge-quests.js';

export default defineConfig({
	plugins: [mergeQuests(), sveltekit()],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
