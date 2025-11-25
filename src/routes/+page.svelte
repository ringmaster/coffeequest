<script lang="ts">
	import { onMount } from 'svelte';
	import { gameStore } from '$lib/stores/gameState.svelte';
	import type { StepData } from '$lib/types/game';
	import CharacterCreation from '$lib/components/CharacterCreation.svelte';
	import GameHeader from '$lib/components/GameHeader.svelte';
	import LocationEntry from '$lib/components/LocationEntry.svelte';
	import StepDisplay from '$lib/components/StepDisplay.svelte';
	import SkillCheck from '$lib/components/SkillCheck.svelte';
	import QuestLog from '$lib/components/QuestLog.svelte';

	let loading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		try {
			const response = await fetch('/steps.json');
			if (!response.ok) {
				throw new Error('Failed to load game data');
			}
			const data: StepData = await response.json();
			gameStore.initialize(data.config, data.steps);
			loading = false;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error';
			loading = false;
		}
	});

	const isSkillCheckPhase = $derived(
		gameStore.phase === 'skill_check_roll' || gameStore.phase === 'skill_check_result'
	);
</script>

<div class="app">
	{#if loading}
		<div class="loading">
			<p>Loading...</p>
		</div>
	{:else if error}
		<div class="error">
			<h2>Error</h2>
			<p>{error}</p>
			<button onclick={() => window.location.reload()}>Retry</button>
		</div>
	{:else if gameStore.phase === 'character_creation'}
		<CharacterCreation />
	{:else}
		<GameHeader />
		<main class="game-content">
			{#if isSkillCheckPhase}
				<SkillCheck />
			{:else if gameStore.phase === 'display_step'}
				<StepDisplay />
			{:else}
				<LocationEntry />
			{/if}
		</main>
		<QuestLog />
	{/if}
</div>

<style>
	.app {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		max-width: 428px;
		margin: 0 auto;
	}

	.loading,
	.error {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100dvh;
		padding: 24px;
		text-align: center;
	}

	.error h2 {
		color: var(--color-failure);
		margin-bottom: 16px;
	}

	.error button {
		margin-top: 16px;
		padding: 12px 24px;
		font-size: 16px;
		border: none;
		border-radius: 8px;
		background: var(--color-button);
		color: var(--color-button-text);
		cursor: pointer;
	}

	.game-content {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
</style>
