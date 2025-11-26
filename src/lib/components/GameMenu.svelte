<script lang="ts">
	import { gameStore } from '$lib/stores/gameState.svelte';
	import { navigateToStep } from '$lib/game/engine';

	let { open = $bindable(false) } = $props();
	let showConfirmReset = $state(false);
	let showDebugInfo = $state(false);
	let showLocations = $state(false);

	const debugEnabled = $derived(gameStore.hasTag('debug_mode'));

	// Get unique map coordinates (2-character IDs that look like coordinates)
	const mapLocations = $derived.by(() => {
		const coordPattern = /^[A-G][NCS]$/i;
		const locations = new Set<string>();
		for (const step of gameStore.steps) {
			if (coordPattern.test(step.id)) {
				locations.add(step.id.toUpperCase());
			}
		}
		return Array.from(locations).sort();
	});

	function viewQuestLog() {
		open = false;
		gameStore.showQuestLog = true;
	}

	function viewDebugInfo() {
		showDebugInfo = true;
	}

	function closeDebugInfo() {
		showDebugInfo = false;
	}

	function viewLocations() {
		showLocations = true;
	}

	function closeLocations() {
		showLocations = false;
	}

	function goToLocation(location: string) {
		navigateToStep(location);
		closeMenu();
	}

	function promptReset() {
		showConfirmReset = true;
	}

	function confirmReset() {
		gameStore.clearSave();
		open = false;
		showConfirmReset = false;
	}

	function cancelReset() {
		showConfirmReset = false;
	}

	function closeMenu() {
		open = false;
		showConfirmReset = false;
		showDebugInfo = false;
		showLocations = false;
	}
</script>

{#if open}
	<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="menu-title">
		<div class="menu">
			{#if showLocations}
				<header>
					<h2 id="menu-title">Map Locations</h2>
					<button class="close-button" onclick={closeLocations} aria-label="Back">
						&larr;
					</button>
				</header>
				<div class="debug-content">
					<h3>Available Coordinates ({mapLocations.length})</h3>
					{#if mapLocations.length === 0}
						<p class="empty-message">No locations found</p>
					{:else}
						<ul class="tag-list">
							{#each mapLocations as location}
								<li>
									<button class="location-button" onclick={() => goToLocation(location)}>
										{location}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{:else if showDebugInfo}
				<header>
					<h2 id="menu-title">Debug Info</h2>
					<button class="close-button" onclick={closeDebugInfo} aria-label="Back">
						&larr;
					</button>
				</header>
				<div class="debug-content">
					<h3>Player Tags ({gameStore.state.character.metadata.length})</h3>
					{#if gameStore.state.character.metadata.length === 0}
						<p class="empty-message">No tags</p>
					{:else}
						<ul class="tag-list">
							{#each gameStore.state.character.metadata as tag}
								<li class="tag-item">{tag}</li>
							{/each}
						</ul>
					{/if}
					<h3>Quest Variables</h3>
					{#if Object.keys(gameStore.state.questVars).length === 0}
						<p class="empty-message">No variables</p>
					{:else}
						<ul class="tag-list">
							{#each Object.entries(gameStore.state.questVars) as [key, value]}
								<li class="tag-item"><strong>{key}:</strong> {value}</li>
							{/each}
						</ul>
					{/if}
				</div>
			{:else if showConfirmReset}
				<header>
					<h2 id="menu-title">Reset Game?</h2>
				</header>
				<div class="confirm-content">
					<p>This will erase all progress, including your character and quest log.</p>
					<div class="confirm-buttons">
						<button class="cancel-button" onclick={cancelReset}>Cancel</button>
						<button class="danger-button" onclick={confirmReset}>Reset Game</button>
					</div>
				</div>
			{:else}
				<header>
					<h2 id="menu-title">Menu</h2>
					<button class="close-button" onclick={closeMenu} aria-label="Close Menu">
						&times;
					</button>
				</header>
				<nav class="menu-options">
					<button class="menu-item" onclick={viewQuestLog}>View Quest Log</button>
					{#if debugEnabled}
						<button class="menu-item" onclick={viewDebugInfo}>Debug</button>
						<button class="menu-item" onclick={viewLocations}>Map Locations</button>
					{/if}
					<button class="menu-item danger" onclick={promptReset}>Reset Game</button>
				</nav>
			{/if}
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		z-index: 100;
	}

	.menu {
		background: var(--color-background);
		border-radius: 12px;
		width: 100%;
		max-width: 320px;
		overflow: hidden;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px;
		border-bottom: 1px solid var(--color-border);
	}

	h2 {
		font-size: 20px;
		margin: 0;
	}

	.close-button {
		width: 44px;
		height: 44px;
		font-size: 28px;
		border: none;
		background: transparent;
		color: var(--color-text);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.menu-options {
		display: flex;
		flex-direction: column;
	}

	.menu-item {
		width: 100%;
		padding: 16px;
		font-size: 16px;
		text-align: left;
		border: none;
		background: transparent;
		color: var(--color-text);
		cursor: pointer;
		border-bottom: 1px solid var(--color-border);
	}

	.menu-item:last-child {
		border-bottom: none;
	}

	.menu-item:active {
		background: var(--color-surface);
	}

	.menu-item.danger {
		color: var(--color-failure);
	}

	.confirm-content {
		padding: 16px;
	}

	.confirm-content p {
		margin-bottom: 20px;
		line-height: 1.5;
	}

	.confirm-buttons {
		display: flex;
		gap: 12px;
	}

	.cancel-button,
	.danger-button {
		flex: 1;
		padding: 12px 16px;
		font-size: 16px;
		border: none;
		border-radius: 8px;
		cursor: pointer;
	}

	.cancel-button {
		background: var(--color-surface);
		color: var(--color-text);
	}

	.danger-button {
		background: var(--color-failure);
		color: white;
	}

	.debug-content {
		padding: 16px;
		max-height: 400px;
		overflow-y: auto;
	}

	.debug-content h3 {
		font-size: 14px;
		text-transform: uppercase;
		color: var(--color-text-secondary);
		margin-bottom: 8px;
		margin-top: 16px;
	}

	.debug-content h3:first-child {
		margin-top: 0;
	}

	.tag-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.tag-item {
		background: var(--color-surface);
		padding: 4px 10px;
		border-radius: 4px;
		font-size: 14px;
		font-family: monospace;
	}

	.empty-message {
		color: var(--color-text-secondary);
		font-style: italic;
		font-size: 14px;
	}

	.location-button {
		background: var(--color-surface);
		padding: 4px 10px;
		border-radius: 4px;
		font-size: 14px;
		font-family: monospace;
		border: none;
		cursor: pointer;
		color: var(--color-text);
	}

	.location-button:hover {
		background: var(--color-button);
		color: var(--color-button-text);
	}
</style>
