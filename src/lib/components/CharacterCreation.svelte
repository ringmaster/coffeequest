<script lang="ts">
	import { gameStore } from '$lib/stores/gameState.svelte';

	const randomNames = [
		'Aldric',
		'Brynn',
		'Cora',
		'Darian',
		'Elena',
		'Finn',
		'Greta',
		'Hawk',
		'Ivy',
		'Jasper',
		'Kira',
		'Lorn',
		'Mira',
		'Nolan',
		'Orin',
		'Petra',
		'Quinn',
		'Rowan',
		'Sage',
		'Theron'
	];

	let characterName = $state(randomNames[Math.floor(Math.random() * randomNames.length)]);
	let might = $state(2);
	let guile = $state(2);

	const startingPoints = $derived(gameStore.config?.startingPoints ?? 4);
	const pointsUsed = $derived(might + guile);
	const pointsRemaining = $derived(startingPoints - pointsUsed);
	const canStart = $derived(pointsRemaining === 0 && characterName.trim().length > 0);

	function adjustStat(stat: 'might' | 'guile', delta: number) {
		const current = stat === 'might' ? might : guile;
		const newValue = current + delta;

		if (newValue < 1 || newValue > 5) return;
		if (delta > 0 && pointsRemaining <= 0) return;

		if (stat === 'might') might = newValue;
		else guile = newValue;
	}

	function beginAdventure() {
		if (canStart) {
			// Magic starts at 0 and is only modified by items
			gameStore.startNewGame(might, guile, 0, characterName);
		}
	}
</script>

<div class="character-creation">
	<h1>Coffee Quest</h1>
	<h2>Create Your Character</h2>

	<div class="name-row">
		<label for="character-name">Name</label>
		<input
			id="character-name"
			type="text"
			bind:value={characterName}
			placeholder="Enter your name"
			autocomplete="off"
		/>
	</div>

	<div class="stat-row">
		<span class="stat-label">Might</span>
		<div class="stat-controls">
			<button
				onclick={() => adjustStat('might', -1)}
				disabled={might <= 1}
				aria-label="Decrease Might"
			>
				-
			</button>
			<span class="stat-value">{might}</span>
			<button
				onclick={() => adjustStat('might', 1)}
				disabled={might >= 5 || pointsRemaining <= 0}
				aria-label="Increase Might"
			>
				+
			</button>
		</div>
	</div>

	<div class="stat-row">
		<span class="stat-label">Guile</span>
		<div class="stat-controls">
			<button
				onclick={() => adjustStat('guile', -1)}
				disabled={guile <= 1}
				aria-label="Decrease Guile"
			>
				-
			</button>
			<span class="stat-value">{guile}</span>
			<button
				onclick={() => adjustStat('guile', 1)}
				disabled={guile >= 5 || pointsRemaining <= 0}
				aria-label="Increase Guile"
			>
				+
			</button>
		</div>
	</div>

	<p class="points-remaining">Points remaining: {pointsRemaining}</p>

	<button class="begin-button" onclick={beginAdventure} disabled={!canStart}>
		Begin Adventure
	</button>
</div>

<style>
	.character-creation {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 24px 16px;
		max-width: 400px;
		margin: 0 auto;
	}

	h1 {
		font-size: 28px;
		color: var(--color-accent);
		margin-bottom: 8px;
	}

	h2 {
		font-size: 20px;
		margin-bottom: 24px;
	}

	.name-row {
		width: 100%;
		margin-bottom: 24px;
	}

	.name-row label {
		display: block;
		font-size: 16px;
		margin-bottom: 8px;
		color: var(--color-text-secondary);
	}

	.name-row input {
		width: 100%;
		padding: 12px 16px;
		font-size: 18px;
		border: 2px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-background);
		color: var(--color-text);
		box-sizing: border-box;
	}

	.name-row input:focus {
		outline: none;
		border-color: var(--color-button);
	}

	.stat-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		margin-bottom: 16px;
		padding: 12px 16px;
		background: var(--color-surface);
		border-radius: 8px;
	}

	.stat-label {
		font-size: 18px;
		font-weight: 600;
	}

	.stat-controls {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.stat-controls button {
		width: 44px;
		height: 44px;
		font-size: 24px;
		font-weight: bold;
		border: none;
		border-radius: 8px;
		background: var(--color-button);
		color: var(--color-button-text);
		cursor: pointer;
	}

	.stat-controls button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.stat-value {
		font-size: 24px;
		font-weight: bold;
		min-width: 32px;
		text-align: center;
	}

	.points-remaining {
		font-size: 18px;
		margin: 24px 0;
		color: var(--color-text-secondary);
	}

	.begin-button {
		width: 100%;
		padding: 16px;
		font-size: 18px;
		font-weight: 600;
		border: none;
		border-radius: 8px;
		background: var(--color-button);
		color: var(--color-button-text);
		cursor: pointer;
	}

	.begin-button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
