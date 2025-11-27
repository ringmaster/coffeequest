<script lang="ts">
    import { onMount } from "svelte";
    import { base } from "$app/paths";
    import { gameStore } from "$lib/stores/gameState.svelte";
    import type { StepData, StepDataError } from "$lib/types/game";
    import CharacterCreation from "$lib/components/CharacterCreation.svelte";
    import GameHeader from "$lib/components/GameHeader.svelte";
    import LocationEntry from "$lib/components/LocationEntry.svelte";
    import StepDisplay from "$lib/components/StepDisplay.svelte";
    import SkillCheck from "$lib/components/SkillCheck.svelte";
    import QuestLog from "$lib/components/QuestLog.svelte";
    import LevelUp from "$lib/components/LevelUp.svelte";

    let loading = $state(true);
    let error = $state<string | null>(null);
    let questError = $state<string | null>(null);

    async function loadGameData() {
        loading = true;
        questError = null;
        error = null;

        try {
            const response = await fetch(`${base}/steps.json`);
            if (!response.ok) {
                throw new Error("Failed to load game data");
            }
            const data: StepData | StepDataError = await response.json();

            // Check if the data contains a quest file error
            if ("error" in data) {
                questError = data.error;
                loading = false;
                return;
            }

            gameStore.initialize(data.config, data.locations || {}, data.steps, data.option_presets);
            loading = false;
        } catch (e) {
            error = e instanceof Error ? e.message : "Unknown error";
            loading = false;
        }
    }

    onMount(() => {
        loadGameData();
    });

    const isSkillCheckPhase = $derived(
        gameStore.phase === "skill_check_roll" ||
            gameStore.phase === "skill_check_result",
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
    {:else if questError}
        <div class="quest-error">
            <h2>Quest File Error</h2>
            <p class="error-message">{questError}</p>
            <p class="hint">Fix the error in your quest file, then click reload.</p>
            <button onclick={loadGameData}>Reload Quest Data</button>
        </div>
    {:else if gameStore.phase === "character_creation"}
        <CharacterCreation />
    {:else}
        <GameHeader />
        <main class="game-content">
            {#if isSkillCheckPhase}
                <SkillCheck />
            {:else if gameStore.phase === "level_up"}
                <LevelUp />
            {:else if gameStore.phase === "display_step"}
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
        background: rgba(245, 241, 232, 0.55);
        box-shadow: 0 0 40px rgba(0, 0, 0, 0.3);
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

    .quest-error {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100dvh;
        padding: 24px;
        text-align: center;
    }

    .quest-error h2 {
        color: var(--color-failure);
        margin-bottom: 16px;
    }

    .quest-error .error-message {
        background: var(--color-surface);
        padding: 16px;
        border-radius: 8px;
        font-family: monospace;
        font-size: 14px;
        max-width: 100%;
        word-break: break-word;
        margin-bottom: 16px;
    }

    .quest-error .hint {
        color: var(--color-text-secondary);
        font-size: 14px;
        margin-bottom: 8px;
    }

    .quest-error button {
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
        padding-top: 68px; /* Account for fixed header height */
    }
</style>
