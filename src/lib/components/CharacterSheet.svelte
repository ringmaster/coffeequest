<script lang="ts">
	import { gameStore } from '$lib/stores/gameState.svelte';

	let { open = $bindable(false) } = $props();

	function formatTagName(tag: string): string {
		return tag
			.replace(/_/g, ' ')
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	function close() {
		open = false;
	}

	// Negative status effects that should be highlighted
	const negativeStatuses = ['injured', 'poisoned', 'cursed', 'scratched', 'sick', 'exhausted', 'weakened'];

	function isNegativeStatus(status: string): boolean {
		return negativeStatuses.includes(status.toLowerCase());
	}
</script>

{#if open}
	<div class="overlay" onclick={close} onkeydown={(e) => e.key === 'Escape' && close()} role="button" tabindex="0">
		<div class="panel" onclick={(e) => e.stopPropagation()} onkeydown={() => {}} role="dialog" aria-label="Character Sheet" tabindex="-1">
			<header>
				<h2>Character</h2>
				<button class="close-button" onclick={close} aria-label="Close character sheet">&times;</button>
			</header>
			<div class="content">
				{#if gameStore.state.questVars.character_name}
					<div class="character-name">{gameStore.state.questVars.character_name}</div>
				{/if}

				<section class="stats-section">
					<h3>Stats</h3>
					<div class="stats-grid">
						<div class="stat">
							<span class="stat-label">Might</span>
							<span class="stat-value">
								{gameStore.effectiveStats.might}
								{#if gameStore.statModifiers.might > 0}
									<span class="modifier">(+{gameStore.statModifiers.might})</span>
								{/if}
							</span>
						</div>
						<div class="stat">
							<span class="stat-label">Guile</span>
							<span class="stat-value">
								{gameStore.effectiveStats.guile}
								{#if gameStore.statModifiers.guile > 0}
									<span class="modifier">(+{gameStore.statModifiers.guile})</span>
								{/if}
							</span>
						</div>
						<div class="stat">
							<span class="stat-label">Magic</span>
							<span class="stat-value">
								{gameStore.effectiveStats.magic}
								{#if gameStore.statModifiers.magic > 0}
									<span class="modifier">(+{gameStore.statModifiers.magic})</span>
								{/if}
							</span>
						</div>
					</div>
					<div class="xp-display">
						<span class="xp-label">Level {gameStore.level}</span>
						<span class="xp-value">{gameStore.state.character.xp} XP</span>
					</div>
				</section>

				{#if gameStore.statuses.length > 0}
					<section class="tag-section">
						<h3>Status</h3>
						<div class="tag-list">
							{#each gameStore.statuses as status}
								<span class="tag status-tag" class:negative={isNegativeStatus(status)}>
									{formatTagName(status)}
								</span>
							{/each}
						</div>
					</section>
				{/if}

				{#if gameStore.traits.length > 0}
					<section class="tag-section">
						<h3>Traits</h3>
						<div class="tag-list">
							{#each gameStore.traits as trait}
								<span class="tag trait-tag">{formatTagName(trait)}</span>
							{/each}
						</div>
					</section>
				{/if}

				{#if gameStore.allies.length > 0}
					<section class="tag-section">
						<h3>Allies</h3>
						<div class="tag-list">
							{#each gameStore.allies as ally}
								<span class="tag ally-tag">{formatTagName(ally)}</span>
							{/each}
						</div>
					</section>
				{/if}

				{#if gameStore.completedQuests.length > 0}
					<section class="tag-section">
						<h3>Completed Quests</h3>
						<div class="tag-list">
							{#each gameStore.completedQuests as quest}
								<span class="tag done-tag">{formatTagName(quest)}</span>
							{/each}
						</div>
					</section>
				{/if}
			</div>
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
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.panel {
		background: var(--color-surface);
		border-radius: 12px;
		width: 90%;
		max-width: 400px;
		max-height: 80vh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px;
		border-bottom: 1px solid var(--color-border);
	}

	h2 {
		margin: 0;
		font-size: 18px;
		color: var(--color-text);
	}

	.close-button {
		width: 32px;
		height: 32px;
		border: none;
		border-radius: 6px;
		background: var(--color-button);
		color: var(--color-button-text);
		font-size: 20px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.content {
		padding: 16px;
		overflow-y: auto;
	}

	.character-name {
		font-size: 20px;
		font-weight: bold;
		color: var(--color-text);
		text-align: center;
		margin-bottom: 16px;
		padding-bottom: 12px;
		border-bottom: 1px solid var(--color-border);
	}

	section {
		margin-bottom: 20px;
	}

	section:last-child {
		margin-bottom: 0;
	}

	h3 {
		margin: 0 0 10px 0;
		font-size: 14px;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.stats-section {
		background: var(--color-background);
		border-radius: 8px;
		padding: 12px;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
	}

	.stat {
		text-align: center;
	}

	.stat-label {
		display: block;
		font-size: 12px;
		color: var(--color-text-secondary);
		margin-bottom: 4px;
	}

	.stat-value {
		display: block;
		font-size: 20px;
		font-weight: bold;
		color: var(--color-text);
		font-family: monospace;
	}

	.modifier {
		font-size: 12px;
		color: var(--color-success);
	}

	.xp-display {
		display: flex;
		justify-content: space-between;
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--color-border);
	}

	.xp-label {
		font-weight: bold;
		color: var(--color-text);
	}

	.xp-value {
		color: var(--color-text-secondary);
	}

	.tag-section h3 {
		margin-bottom: 8px;
	}

	.tag-list {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.tag {
		padding: 6px 12px;
		border-radius: 16px;
		font-size: 13px;
		font-weight: 500;
	}

	.status-tag {
		background: #e3f2fd;
		color: #1565c0;
	}

	.status-tag.negative {
		background: #ffebee;
		color: #c62828;
	}

	.trait-tag {
		background: #f3e5f5;
		color: #7b1fa2;
	}

	.ally-tag {
		background: #e8f5e9;
		color: #2e7d32;
	}

	.done-tag {
		background: #fff3e0;
		color: #e65100;
	}

	/* Dark mode adjustments */
	:global(.dark) .status-tag {
		background: #1a3a5c;
		color: #90caf9;
	}

	:global(.dark) .status-tag.negative {
		background: #5c1a1a;
		color: #ef9a9a;
	}

	:global(.dark) .trait-tag {
		background: #3a1a5c;
		color: #ce93d8;
	}

	:global(.dark) .ally-tag {
		background: #1a3a1a;
		color: #a5d6a7;
	}

	:global(.dark) .done-tag {
		background: #4a2a0a;
		color: #ffcc80;
	}
</style>
