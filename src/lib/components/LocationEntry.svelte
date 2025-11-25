<script lang="ts">
	import { navigateToLocation } from '$lib/game/engine';
	import { gameStore } from '$lib/stores/gameState.svelte';

	let coordinates = $state('');

	function handleSubmit() {
		if (coordinates.trim()) {
			navigateToLocation(coordinates);
			coordinates = '';
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			handleSubmit();
		}
	}
</script>

<div class="location-entry">
	<label for="coords">Enter Location Coordinates:</label>
	<div class="input-row">
		<input
			id="coords"
			type="text"
			bind:value={coordinates}
			onkeydown={handleKeydown}
			placeholder="e.g., B7"
			autocomplete="off"
			autocapitalize="characters"
		/>
		<button onclick={handleSubmit} disabled={!coordinates.trim()} aria-label="Go to location">
			GO
		</button>
	</div>
	{#if gameStore.errorMessage}
		<p class="error">{gameStore.errorMessage}</p>
	{/if}
</div>

<style>
	.location-entry {
		padding: 24px 16px;
	}

	label {
		display: block;
		font-size: 16px;
		margin-bottom: 12px;
	}

	.input-row {
		display: flex;
		gap: 12px;
	}

	input {
		flex: 1;
		padding: 12px 16px;
		font-size: 18px;
		border: 2px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-background);
		color: var(--color-text);
		text-transform: uppercase;
	}

	input:focus {
		outline: none;
		border-color: var(--color-button);
	}

	button {
		padding: 12px 24px;
		font-size: 18px;
		font-weight: 600;
		border: none;
		border-radius: 8px;
		background: var(--color-button);
		color: var(--color-button-text);
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.error {
		margin-top: 16px;
		padding: 12px;
		background: var(--color-failure-bg);
		color: var(--color-failure);
		border-radius: 8px;
		font-size: 14px;
	}
</style>
