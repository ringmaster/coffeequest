import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Step, StepPatch, StepOption, RawStepPatch } from '$lib/types/game';

// Mock the gameStore module to avoid Svelte reactivity issues in tests
vi.mock('$lib/stores/gameState.svelte', () => ({
	gameStore: {
		renderText: (text: string) => text, // Pass through without variable substitution
		patchIndex: new Map(),
		effectiveMetadata: []
	}
}));

// Import after mocking
import { applyPatches, processPatchData, expandOption } from './engine';

describe('processPatchData', () => {
	it('converts raw patches to StepPatch objects', () => {
		const rawPatches: RawStepPatch[] = [
			{
				target: 'baker_buy',
				tags: ['@q:flour_mystery'],
				text: { append: ' She looks worried.' }
			}
		];

		const result = processPatchData(rawPatches, {});

		expect(result).toHaveLength(1);
		expect(result[0].target).toBe('baker_buy');
		expect(result[0].tags).toEqual(['@q:flour_mystery']);
		expect(result[0].text).toEqual({ append: ' She looks worried.' });
	});

	it('expands shorthand options in patches', () => {
		const rawPatches: RawStepPatch[] = [
			{
				target: 'test_step',
				options: ['Ask about it::ask_step', 'Leave']
			}
		];

		const result = processPatchData(rawPatches, {});

		expect(result).toHaveLength(1);
		expect(result[0].options).toHaveLength(2);
		expect(result[0].options![0]).toEqual({
			label: 'Ask about it',
			tags: [],
			pass: 'ask_step'
		});
		expect(result[0].options![1]).toEqual({
			label: 'Leave',
			tags: [],
			pass: null
		});
	});

	it('preserves vars in patches', () => {
		const rawPatches: RawStepPatch[] = [
			{
				target: 'test_step',
				vars: { npc: ['Alice', 'Bob'] }
			}
		];

		const result = processPatchData(rawPatches, {});

		expect(result[0].vars).toEqual({ npc: ['Alice', 'Bob'] });
	});
});

describe('applyPatches', () => {
	const baseStep: Step = {
		id: 'baker_buy',
		tags: ['quest'],
		text: 'The baker shows you her wares.',
		options: [
			{ label: 'Buy bread', tags: [], pass: 'buy_bread' },
			{ label: 'Leave', tags: [], pass: null }
		]
	};

	it('returns base step when no patches apply', () => {
		const patches: StepPatch[] = [
			{
				target: 'baker_buy',
				tags: ['@q:flour_mystery'] // Player doesn't have this tag
			}
		];

		const result = applyPatches(baseStep, patches, []);

		expect(result).toEqual(baseStep);
	});

	it('applies patch when conditions are met', () => {
		const patches: StepPatch[] = [
			{
				target: 'baker_buy',
				tags: ['@q:flour_mystery'],
				text: { append: ' She looks worried.' }
			}
		];

		const result = applyPatches(baseStep, patches, ['q:flour_mystery']);

		expect(result.text).toBe('The baker shows you her wares. She looks worried.');
	});

	it('appends options from patches', () => {
		const patches: StepPatch[] = [
			{
				target: 'baker_buy',
				tags: ['@q:flour_mystery'],
				options: [{ label: 'Ask about flour', tags: [], pass: 'flour_hint', hidden: true }]
			}
		];

		const result = applyPatches(baseStep, patches, ['q:flour_mystery']);

		expect(result.options).toHaveLength(3);
		expect(result.options![2].label).toBe('Ask about flour');
		expect(result.options![2].hidden).toBe(true);
	});

	it('merges vars from patches (patch overrides)', () => {
		const stepWithVars: Step = {
			...baseStep,
			vars: { item: ['bread', 'pastry'], price: ['1', '2'] }
		};

		const patches: StepPatch[] = [
			{
				target: 'baker_buy',
				vars: { item: ['special bread'], extra: ['bonus'] }
			}
		];

		const result = applyPatches(stepWithVars, patches, []);

		expect(result.vars).toEqual({
			item: ['special bread'], // Overridden by patch
			price: ['1', '2'], // Preserved from base
			extra: ['bonus'] // Added by patch
		});
	});

	it('applies text prepend modification', () => {
		const patches: StepPatch[] = [
			{
				target: 'baker_buy',
				text: { prepend: 'Colorful banners flutter overhead. ' }
			}
		];

		const result = applyPatches(baseStep, patches, []);

		expect(result.text).toBe('Colorful banners flutter overhead. The baker shows you her wares.');
	});

	it('applies text replace modification (overrides everything)', () => {
		const patches: StepPatch[] = [
			{
				target: 'baker_buy',
				text: { replace: 'The baker glares at you.' }
			}
		];

		const result = applyPatches(baseStep, patches, []);

		expect(result.text).toBe('The baker glares at you.');
	});

	it('replace takes precedence over prepend and append', () => {
		const patches: StepPatch[] = [
			{
				target: 'baker_buy',
				text: { prepend: 'Before. ', append: ' After.', replace: 'Replaced.' }
			}
		];

		const result = applyPatches(baseStep, patches, []);

		expect(result.text).toBe('Replaced.');
	});

	it('handles multiple patches with different text modifications', () => {
		const patches: StepPatch[] = [
			{
				target: 'baker_buy',
				tags: ['@tag1'],
				text: { prepend: 'First. ' }
			},
			{
				target: 'baker_buy',
				tags: ['@tag2'],
				text: { append: ' Second.' }
			}
		];

		const result = applyPatches(baseStep, patches, ['tag1', 'tag2']);

		expect(result.text).toBe('First. The baker shows you her wares. Second.');
	});

	it('applies patches in order (accumulates modifications)', () => {
		const patches: StepPatch[] = [
			{
				target: 'baker_buy',
				options: [{ label: 'Option A', tags: [], pass: 'a' }]
			},
			{
				target: 'baker_buy',
				options: [{ label: 'Option B', tags: [], pass: 'b' }]
			}
		];

		const result = applyPatches(baseStep, patches, []);

		expect(result.options).toHaveLength(4);
		expect(result.options![2].label).toBe('Option A');
		expect(result.options![3].label).toBe('Option B');
	});

	it('respects ! (blocked) tag conditions', () => {
		const patches: StepPatch[] = [
			{
				target: 'baker_buy',
				tags: ['!done:flour_mystery'], // Only apply if player does NOT have this tag
				text: { append: ' She needs help.' }
			}
		];

		// Player has the blocking tag
		const result1 = applyPatches(baseStep, patches, ['done:flour_mystery']);
		expect(result1.text).toBe('The baker shows you her wares.');

		// Player doesn't have the blocking tag
		const result2 = applyPatches(baseStep, patches, []);
		expect(result2.text).toBe('The baker shows you her wares. She needs help.');
	});

	it('handles patches with no conditions (always applies)', () => {
		const patches: StepPatch[] = [
			{
				target: 'baker_buy',
				// No tags - unconditional
				text: { append: ' Always added.' }
			}
		];

		const result = applyPatches(baseStep, patches, []);

		expect(result.text).toBe('The baker shows you her wares. Always added.');
	});

	it('preserves base step log and id', () => {
		const stepWithLog: Step = {
			...baseStep,
			log: 'Visited the bakery'
		};

		const patches: StepPatch[] = [
			{
				target: 'baker_buy',
				text: { append: ' Modified.' }
			}
		];

		const result = applyPatches(stepWithLog, patches, []);

		expect(result.id).toBe('baker_buy');
		expect(result.log).toBe('Visited the bakery');
	});

	it('adds mutation tags from patches to step tags', () => {
		const patches: StepPatch[] = [
			{
				target: 'baker_buy',
				tags: ['!visited_bakery', '+visited_bakery'],
				text: { prepend: 'First time here! ' }
			}
		];

		// Patch applies when player doesn't have visited_bakery
		const result = applyPatches(baseStep, patches, []);

		expect(result.text).toBe('First time here! The baker shows you her wares.');
		expect(result.tags).toContain('+visited_bakery');
	});

	it('does not apply patch when blocked by mutation tag granted earlier', () => {
		const patches: StepPatch[] = [
			{
				target: 'baker_buy',
				tags: ['!visited_bakery', '+visited_bakery'],
				text: { prepend: 'First time here! ' }
			}
		];

		// Player already has visited_bakery - patch should not apply
		const result = applyPatches(baseStep, patches, ['visited_bakery']);

		expect(result.text).toBe('The baker shows you her wares.');
		expect(result.tags).not.toContain('+visited_bakery');
	});

	it('applies patch with @level>1 comparison when player is level 2+', () => {
		const patches: StepPatch[] = [
			{
				target: 'baker_buy',
				tags: ['@level>1'],
				text: { prepend: 'With experienced eyes, you notice... ' }
			}
		];

		// Player has 2 level tags (level 2)
		const result = applyPatches(baseStep, patches, ['level', 'level']);

		expect(result.text).toBe('With experienced eyes, you notice... The baker shows you her wares.');
	});

	it('does not apply patch with @level>1 when player is level 1', () => {
		const patches: StepPatch[] = [
			{
				target: 'baker_buy',
				tags: ['@level>1'],
				text: { prepend: 'With experienced eyes, you notice... ' }
			}
		];

		// Player has 1 level tag (level 1)
		const result = applyPatches(baseStep, patches, ['level']);

		expect(result.text).toBe('The baker shows you her wares.');
	});

	it('applies patch with !level>2 when player is level 2 or below', () => {
		const patches: StepPatch[] = [
			{
				target: 'baker_buy',
				tags: ['!level>2'],
				text: { append: ' (Beginner view)' }
			}
		];

		// Player has 2 level tags (level 2) - not MORE than 2
		const result = applyPatches(baseStep, patches, ['level', 'level']);

		expect(result.text).toBe('The baker shows you her wares. (Beginner view)');
	});

	it('does not apply patch with !level>2 when player is level 3', () => {
		const patches: StepPatch[] = [
			{
				target: 'baker_buy',
				tags: ['!level>2'],
				text: { append: ' (Beginner view)' }
			}
		];

		// Player has 3 level tags (level 3) - more than 2
		const result = applyPatches(baseStep, patches, ['level', 'level', 'level']);

		expect(result.text).toBe('The baker shows you her wares.');
	});

	it('applies patch with @inv:silver=3 when player has exactly 3 silver', () => {
		const patches: StepPatch[] = [
			{
				target: 'baker_buy',
				tags: ['@inv:silver=3'],
				text: { append: ' You could afford the special bread.' }
			}
		];

		const result = applyPatches(baseStep, patches, ['inv:silver', 'inv:silver', 'inv:silver']);

		expect(result.text).toBe('The baker shows you her wares. You could afford the special bread.');
	});

	it('does not apply patch with @inv:silver=3 when player has 2 silver', () => {
		const patches: StepPatch[] = [
			{
				target: 'baker_buy',
				tags: ['@inv:silver=3'],
				text: { append: ' You could afford the special bread.' }
			}
		];

		const result = applyPatches(baseStep, patches, ['inv:silver', 'inv:silver']);

		expect(result.text).toBe('The baker shows you her wares.');
	});

	it('applies patch with @level<3 when player is level 2', () => {
		const patches: StepPatch[] = [
			{
				target: 'baker_buy',
				tags: ['@level<3'],
				text: { prepend: 'As a novice, ' }
			}
		];

		const result = applyPatches(baseStep, patches, ['level', 'level']);

		expect(result.text).toBe('As a novice, The baker shows you her wares.');
	});

	it('combines comparison with other conditions', () => {
		const patches: StepPatch[] = [
			{
				target: 'baker_buy',
				tags: ['@level>1', '!visited_bakery', '+visited_bakery'],
				text: { prepend: 'First time here as a veteran! ' }
			}
		];

		// Level 2, hasn't visited
		const result = applyPatches(baseStep, patches, ['level', 'level']);

		expect(result.text).toBe('First time here as a veteran! The baker shows you her wares.');
		expect(result.tags).toContain('+visited_bakery');
	});
});

describe('expandOption', () => {
	it('expands string shorthand with step target', () => {
		const result = expandOption('Buy bread::buy_bread');

		expect(result).toEqual({
			label: 'Buy bread',
			tags: [],
			pass: 'buy_bread'
		});
	});

	it('expands string shorthand without target (ends interaction)', () => {
		const result = expandOption('Leave');

		expect(result).toEqual({
			label: 'Leave',
			tags: [],
			pass: null
		});
	});

	it('passes through object options with default tags', () => {
		const result = expandOption({
			label: 'Pick lock',
			skill: 'guile',
			dc: 5,
			pass: 'success',
			fail: 'fail'
		} as StepOption);

		expect(result.label).toBe('Pick lock');
		expect(result.skill).toBe('guile');
		expect(result.dc).toBe(5);
		expect(result.tags).toEqual([]);
	});
});
