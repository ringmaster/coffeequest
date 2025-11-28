<script lang="ts">
    import { navigateToStep } from "$lib/game/engine";
    import { gameStore } from "$lib/stores/gameState.svelte";

    let coordinates = $state("");

    const columns = ["A", "B", "C", "D", "E", "F", "G"];
    const rows = ["N", "C", "S"];

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

        {#if gameStore.debugStepInfo.length > 0}
            <div class="debug-steps">
                <h4>Debug: Steps at this location ({gameStore.debugStepInfo.length})</h4>
                {#each gameStore.debugStepInfo as debugInfo, i}
                    <div class="debug-step" class:eligible={debugInfo.eligible}>
                        <div class="debug-step-header">
                            <span class="step-num">#{i + 1}</span>
                            <span class="step-status">{debugInfo.eligible ? '✓ ELIGIBLE' : '✗ BLOCKED'}</span>
                        </div>
                        {#if debugInfo.tagAnalysis.length > 0}
                            <div class="debug-tags">
                                {#each debugInfo.tagAnalysis as tagInfo}
                                    <span
                                        class="debug-tag"
                                        class:satisfied={tagInfo.satisfied}
                                        class:missing={!tagInfo.satisfied}
                                        title={tagInfo.type === 'required'
                                            ? (tagInfo.satisfied ? 'Player has this tag' : 'Player missing this tag')
                                            : (tagInfo.satisfied ? 'Player does not have blocked tag' : 'Player has blocked tag')}
                                    >
                                        {tagInfo.tag}
                                    </span>
                                {/each}
                            </div>
                        {:else}
                            <div class="debug-tags">
                                <span class="debug-tag no-tags">No filter tags</span>
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    {/if}

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

    /* Debug styles */
    .debug-steps {
        margin-top: 16px;
        padding: 12px;
        background: var(--color-surface);
        border-radius: 8px;
        font-size: 12px;
    }

    .debug-steps h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        color: var(--color-text-secondary);
    }

    .debug-step {
        margin-bottom: 12px;
        padding: 8px;
        border-radius: 6px;
        background: rgba(0, 0, 0, 0.2);
        border-left: 3px solid var(--color-failure);
    }

    .debug-step.eligible {
        border-left-color: var(--color-success);
    }

    .debug-step-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 6px;
        font-weight: 600;
    }

    .step-num {
        color: var(--color-text-secondary);
    }

    .step-status {
        font-size: 11px;
    }

    .debug-step.eligible .step-status {
        color: var(--color-success);
    }

    .debug-step:not(.eligible) .step-status {
        color: var(--color-failure);
    }

    .debug-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }

    .debug-tag {
        padding: 2px 6px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 11px;
    }

    .debug-tag.satisfied {
        background: rgba(76, 175, 80, 0.3);
        color: var(--color-success);
    }

    .debug-tag.missing {
        background: rgba(244, 67, 54, 0.3);
        color: var(--color-failure);
    }

    .debug-tag.no-tags {
        background: rgba(128, 128, 128, 0.2);
        color: var(--color-text-secondary);
        font-style: italic;
    }
</style>
