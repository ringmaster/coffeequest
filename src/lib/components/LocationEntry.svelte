<script lang="ts">
    import { navigateToStep } from "$lib/game/engine";
    import { gameStore } from "$lib/stores/gameState.svelte";

    let coordinates = $state("");

    const columns = ["A", "B", "C", "D", "E", "F", "G"];
    const rows = ["N", "C", "S"];

    const debugEnabled = $derived(gameStore.hasTag("debug_mode"));

    function handleSubmit() {
        if (coordinates.trim()) {
            navigateToStep(coordinates);
            coordinates = "";
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            handleSubmit();
        }
    }

    function goToCoord(col: string, row: string) {
        navigateToStep(col + row);
    }
</script>

<div class="location-entry">
    <label for="coords"
        >Find the location on your map, then enter the map coordinates to visit
        that location:</label
    >
    <div class="input-row">
        <input
            id="coords"
            type="text"
            bind:value={coordinates}
            onkeydown={handleKeydown}
            placeholder="e.g., BS"
            autocomplete="off"
            autocapitalize="characters"
        />
        <button
            onclick={handleSubmit}
            disabled={!coordinates.trim()}
            aria-label="Go to location"
        >
            GO
        </button>
    </div>
    {#if gameStore.errorMessage}
        <p class="error">{gameStore.errorMessage}</p>
    {/if}

    {#if debugEnabled}
        <div class="coord-grid">
            {#each rows as row}
                <div class="coord-row">
                    {#each columns as col}
                        <button
                            class="coord-button"
                            onclick={() => goToCoord(col, row)}
                        >
                            {col}{row}
                        </button>
                    {/each}
                </div>
            {/each}
        </div>
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

    .coord-grid {
        margin-top: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .coord-row {
        display: flex;
        gap: 8px;
        justify-content: center;
    }

    .coord-button {
        padding: 8px 4px;
        font-size: 14px;
        font-weight: 600;
        border: none;
        border-radius: 6px;
        background: var(--color-surface);
        color: var(--color-text);
        cursor: pointer;
        flex: 1;
        max-width: 48px;
    }

    .coord-button:hover {
        background: var(--color-button);
        color: var(--color-button-text);
    }
</style>
