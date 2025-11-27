<script lang="ts">
    import { navigateToStep } from "$lib/game/engine";
    import { gameStore } from "$lib/stores/gameState.svelte";

    let coordinates = $state("");

    const columns = ["A", "B", "C", "D", "E", "F", "G"];
    const rows = ["N", "C", "S"];

    const debugEnabled = $derived(gameStore.hasTag("debug_mode"));

    const mapLocations = $derived.by(() => {
        return Object.entries(gameStore.locations)
            .map(([coord, name]) => ({ coord, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    });

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

        <div class="location-list">
            <h3>Locations</h3>
            {#each mapLocations as location}
                <button
                    class="location-button"
                    onclick={() => goToCoord(location.coord, "")}
                >
                    <span class="coord">{location.coord}</span>
                    <span class="name">{location.name}</span>
                </button>
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

    .location-list {
        margin-top: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .location-list h3 {
        font-size: 14px;
        text-transform: uppercase;
        color: var(--color-text-secondary);
        margin: 0 0 8px 0;
    }

    .location-button {
        display: flex;
        align-items: center;
        width: 100%;
        padding: 8px 12px;
        font-size: 14px;
        font-family: monospace;
        text-align: left;
        border: none;
        border-radius: 6px;
        background: var(--color-surface);
        color: var(--color-text);
        cursor: pointer;
    }

    .location-button:hover {
        background: var(--color-button);
        color: var(--color-button-text);
    }

    .location-button .coord {
        font-weight: bold;
        margin-right: 12px;
        min-width: 24px;
    }

    .location-button .name {
        opacity: 0.8;
    }
</style>
