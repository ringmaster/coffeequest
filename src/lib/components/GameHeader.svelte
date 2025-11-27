<script lang="ts">
	import { gameStore } from '$lib/stores/gameState.svelte';
	import GameMenu from './GameMenu.svelte';
	import InventoryPanel from './InventoryPanel.svelte';
	import CharacterSheet from './CharacterSheet.svelte';

	let menuOpen = $state(false);
	let inventoryOpen = $state(false);
	let characterSheetOpen = $state(false);

	function openMenu() {
		menuOpen = true;
	}

	function openInventory() {
		inventoryOpen = true;
	}

	function openCharacterSheet() {
		characterSheetOpen = true;
	}

	function openQuestLog() {
		gameStore.showQuestLog = true;
	}

	// Count total inventory items for badge
	const inventoryCount = $derived(
		gameStore.inventoryItems.reduce((sum, item) => sum + item.count, 0)
	);

	// Check if there are any status effects (for badge indicator)
	const hasStatusEffects = $derived(gameStore.statuses.length > 0);

	// Count quest log entries for badge
	const questLogCount = $derived(gameStore.state.questLog.length);
</script>

<header class="game-header">
	<div class="toolbar-icons">
		<button
			class="icon-button"
			onclick={openQuestLog}
			aria-label="Open quest log"
			title="Quest Log"
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
				<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
				<path d="M8 7h8"></path>
				<path d="M8 11h8"></path>
			</svg>
			{#if questLogCount > 0}
				<span class="badge">{questLogCount}</span>
			{/if}
		</button>
		<button
			class="icon-button"
			onclick={openInventory}
			aria-label="Open inventory"
			title="Inventory"
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M8 2C6 2 4 3 4 5v14c0 2 2 4 4 4h8c2 0 4-2 4-4V5c0-2-2-3-4-3H8z"></path>
				<path d="M8 2c0 2 2 3 4 3s4-1 4-3"></path>
				<line x1="12" y1="11" x2="12" y2="17"></line>
				<line x1="9" y1="14" x2="15" y2="14"></line>
			</svg>
			{#if inventoryCount > 0}
				<span class="badge">{inventoryCount}</span>
			{/if}
		</button>
		<button
			class="icon-button"
			onclick={openCharacterSheet}
			aria-label="Open character sheet"
			title="Character"
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
				<circle cx="12" cy="7" r="4"></circle>
			</svg>
			{#if hasStatusEffects}
				<span class="status-indicator"></span>
			{/if}
		</button>
	</div>
	<div class="meta">
		<span class="level">Lv {gameStore.level}</span>
		<span class="xp">XP: {gameStore.state.character.xp}</span>
		<button class="menu-button" onclick={openMenu} aria-label="Open Menu">
			&#9776;
		</button>
	</div>
</header>

<GameMenu bind:open={menuOpen} />
<InventoryPanel bind:open={inventoryOpen} />
<CharacterSheet bind:open={characterSheetOpen} />

<style>
	.game-header {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		max-width: 428px;
		margin: 0 auto;
		z-index: 50;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
	}

	.toolbar-icons {
		display: flex;
		gap: 8px;
	}

	.icon-button {
		position: relative;
		width: 44px;
		height: 44px;
		border: none;
		border-radius: 8px;
		background: var(--color-button);
		color: var(--color-button-text);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 10px;
	}

	.icon-button svg {
		width: 24px;
		height: 24px;
	}

	.badge {
		position: absolute;
		top: -4px;
		right: -4px;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		border-radius: 9px;
		background: var(--color-primary, #4a90d9);
		color: white;
		font-size: 11px;
		font-weight: bold;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.status-indicator {
		position: absolute;
		top: -2px;
		right: -2px;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: #c62828;
		border: 2px solid var(--color-surface);
	}

	.meta {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.level {
		font-size: 14px;
		font-weight: bold;
		color: var(--color-text);
	}

	.xp {
		font-size: 14px;
		color: var(--color-text-secondary);
	}

	.menu-button {
		width: 44px;
		height: 44px;
		font-size: 20px;
		border: none;
		border-radius: 8px;
		background: var(--color-button);
		color: var(--color-button-text);
		cursor: pointer;
	}
</style>
