<script lang="ts">
	import { simulatorStore, type ResolvedOption } from '$lib/stores/simulatorState.svelte';
	import { editorStore } from '$lib/stores/editorState.svelte';

	// Local derived values for proper reactivity tracking
	// These help ensure Svelte tracks dependencies on class-based store properties
	let currentStep = $derived(simulatorStore.currentStep);
	let patchedStep = $derived(simulatorStore.patchedStep);
	let availableOptions = $derived(simulatorStore.availableOptions);
	let allMatchingSteps = $derived(simulatorStore.allMatchingSteps);
	let selectedAlternativeIndex = $derived(simulatorStore.selectedAlternativeIndex);

	// Toggle for expanded step text
	let expandedText = $state(false);

	// Truncate text for display
	function truncate(text: string | undefined, max: number = 100): string {
		if (!text) return '';
		const clean = text.replace(/\s+/g, ' ').trim();
		if (clean.length <= max) return clean;
		return clean.substring(0, max) + '...';
	}

	// Get display class for option
	function getOptionClass(opt: ResolvedOption): string {
		if (!opt.available) return 'unavailable';
		if (opt.hidden) return 'hidden-option';
		return '';
	}

	// Check if option should be shown
	function shouldShowOption(opt: ResolvedOption): boolean {
		// Hidden options only show when requirements are met
		if (opt.hidden && !opt.available) return false;
		return true;
	}

	// Handle option click
	function handleOptionClick(opt: ResolvedOption) {
		if (!opt.available) return;
		simulatorStore.takeOption(opt);
	}

	// Handle location change for end interaction
	function handleLocationSelect(e: Event) {
		const select = e.target as HTMLSelectElement;
		if (select.value) {
			simulatorStore.goToLocation(select.value);
		}
	}

	// Check if current step can be edited (is in the loaded quest file)
	function canEditCurrentStep(): boolean {
		if (!currentStep || !editorStore.questFile) return false;
		const step = currentStep.step;
		return editorStore.questFile.steps.some(
			(s) => s.id === step.id && JSON.stringify(s.tags) === JSON.stringify(step.tags)
		);
	}
</script>

<div class="simulator">
	{#if !simulatorStore.active}
		<div class="simulator-inactive">
			<h2>State Simulator</h2>
			<p>Test quest paths interactively</p>
			<button class="start-btn" onclick={() => simulatorStore.start()}>
				Start Simulation
			</button>
		</div>
	{:else}
		<div class="simulator-active">
			<div class="sim-header">
				<h2>Simulator</h2>
				<button class="stop-btn" onclick={() => simulatorStore.stop()} title="Stop simulation">
					&times;
				</button>
			</div>

			<!-- Location Selector -->
			<div class="sim-section">
				<label class="section-label">Location</label>
				<select
					class="location-select"
					value={simulatorStore.location}
					onchange={(e) => simulatorStore.setLocation((e.target as HTMLSelectElement).value)}
				>
					<option value="">Select location...</option>
					{#each editorStore.allLocations as loc}
						<option value={loc.name}>{loc.name} ({loc.id})</option>
					{/each}
				</select>
			</div>

			<!-- Tag State -->
			<div class="sim-section">
				<label class="section-label">
					Tag State
					<button
						class="copy-tags-btn"
						onclick={() => simulatorStore.copyTagsToEditor()}
						title="Copy to editor"
					>
						Copy
					</button>
				</label>
				<div class="tag-list">
					{#each Array.from(simulatorStore.tags).sort() as tag}
						<span class="tag">
							{tag}
							<button
								class="tag-remove"
								onclick={() => simulatorStore.removeTag(tag)}
								title="Remove tag"
							>
								&times;
							</button>
						</span>
					{/each}
					{#if simulatorStore.tags.size === 0}
						<span class="no-tags">No tags</span>
					{/if}
				</div>
				<div class="add-tag-row">
					<input
						type="text"
						class="add-tag-input"
						placeholder="Add tag..."
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								const input = e.target as HTMLInputElement;
								if (input.value.trim()) {
									simulatorStore.addTag(input.value.trim());
									input.value = '';
								}
							}
						}}
					/>
				</div>
			</div>

			<!-- Current Step -->
			<div class="sim-section">
				<label class="section-label">
					Current Step
					<span class="section-actions">
						{#if patchedStep}
							<button
								class="expand-btn"
								onclick={() => expandedText = !expandedText}
								title={expandedText ? 'Collapse text' : 'Expand text'}
							>
								{expandedText ? 'Collapse' : 'Expand'}
							</button>
						{/if}
						{#if canEditCurrentStep()}
							<button
								class="edit-step-btn"
								onclick={() => simulatorStore.editCurrentStep()}
								title="Edit in editor"
							>
								Edit
							</button>
						{/if}
					</span>
				</label>
				{#if patchedStep}
					<div class="current-step" class:expanded={expandedText}>
						<div class="step-id">{currentStep?.step.id}</div>
						<div class="step-text">
							{#if expandedText}
								{patchedStep.text}
							{:else}
								{truncate(patchedStep.text, 150)}
							{/if}
						</div>
					</div>
				{:else if simulatorStore.location}
					<div class="no-match">
						<span class="warning-icon">&#9888;</span>
						No step matches at {simulatorStore.location}
						<p class="coverage-gap">This is a coverage gap.</p>
					</div>
				{:else}
					<div class="no-location">Select a location to begin</div>
				{/if}
			</div>

			<!-- Alternative Steps (when multiple matches exist) -->
			{#if allMatchingSteps.length > 1}
				<div class="sim-section alternatives-section">
					<label class="section-label">
						Alternative Steps ({allMatchingSteps.length} matches)
					</label>
					<div class="alternatives-list">
						{#each allMatchingSteps as match, i}
							<button
								class="alt-btn"
								class:selected={i === selectedAlternativeIndex}
								onclick={() => simulatorStore.selectAlternative(i)}
								title={match.step.tags?.filter(t => t.startsWith('@') || t.startsWith('!')).join(', ') || 'No filter tags'}
							>
								<span class="alt-num">{i + 1}</span>
								{#if i !== selectedAlternativeIndex}
									<span class="alt-tags">
										{#each (match.step.tags ?? []).filter(t => t.startsWith('@') || t.startsWith('!')).slice(0, 2) as tag}
											<span class="alt-tag">{tag}</span>
										{/each}
									</span>
								{/if}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Options -->
			{#if patchedStep}
				<div class="sim-section options-section">
					<label class="section-label">Options</label>
					<div class="options-list">
						{#each availableOptions as opt}
							{#if shouldShowOption(opt)}
								<div class="option {getOptionClass(opt)}">
									<button
										class="option-btn"
										disabled={!opt.available}
										onclick={() => handleOptionClick(opt)}
									>
										<span class="option-label">
											{opt.label}
											{#if opt.pass && !opt.skill}
												<span class="target-hint">({opt.pass})</span>
											{/if}
										</span>

										{#if opt.skill && opt.dc}
											<span class="skill-badge">
												{opt.skill} {opt.dc}
											</span>
										{/if}
									</button>

									<div class="option-details">
										{#if opt.skill && opt.dc}
											<!-- Target shown in pass/fail selector below -->
										{:else if opt.pass}
											<span class="target">
												&rarr; {opt.pass}
											</span>
										{:else}
											<span class="target end">&rarr; (end)</span>
										{/if}

										{#if !opt.available}
											<div class="missing-tags">
												requires: {opt.missingTags
													.map((t) => (t.startsWith('!') ? `no ${t.slice(1)}` : t))
													.join(', ')}
											</div>
										{/if}

										{#if opt.mutations.add.length > 0 || opt.mutations.remove.length > 0}
											<div class="mutations">
												{#each opt.mutations.add as tag}
													<span class="mutation add">+{tag}</span>
												{/each}
												{#each opt.mutations.remove as tag}
													<span class="mutation remove">-{tag}</span>
												{/each}
											</div>
										{/if}
									</div>

									<!-- Skill check outcome selector -->
									{#if opt.skill && opt.dc && opt.available}
										<div class="outcome-selector">
											<label>
												<input
													type="radio"
													name="outcome-{opt.label}"
													value="pass"
													checked={simulatorStore.selectedOutcome === 'pass'}
													onchange={() => simulatorStore.setSelectedOutcome('pass')}
												/>
												Pass &rarr; {opt.pass}
											</label>
											<label>
												<input
													type="radio"
													name="outcome-{opt.label}"
													value="fail"
													checked={simulatorStore.selectedOutcome === 'fail'}
													onchange={() => simulatorStore.setSelectedOutcome('fail')}
												/>
												Fail &rarr; {opt.fail || '(end)'}
											</label>
										</div>
									{/if}

									<!-- End interaction location selector -->
									{#if !opt.pass && opt.available && !opt.skill}
										<div class="end-selector">
											<label>Next location:</label>
											<select onchange={handleLocationSelect}>
												<option value="">Select...</option>
												{#each editorStore.allLocations as loc}
													<option value={loc.name}>{loc.name} ({loc.id})</option>
												{/each}
											</select>
										</div>
									{/if}
								</div>
							{/if}
						{/each}

						{#if availableOptions.filter(shouldShowOption).length === 0}
							<div class="no-options">No options available</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- History -->
			<div class="sim-section history-section">
				<label class="section-label">History ({simulatorStore.history.length})</label>
				<div class="history-list">
					{#each simulatorStore.history as entry, i}
						<button
							class="history-entry"
							class:current={i === simulatorStore.historyIndex}
							class:future={i > simulatorStore.historyIndex}
							onclick={() => simulatorStore.jumpTo(i)}
						>
							<span class="entry-num">{i + 1}.</span>
							<span class="entry-location">{entry.location}:</span>
							<span class="entry-option">{truncate(entry.optionLabel, 20)}</span>
							{#if entry.tagsAdded.length > 0 || entry.tagsRemoved.length > 0}
								<span class="entry-mutations">
									{#each entry.tagsAdded.slice(0, 2) as tag}
										<span class="mut-add">+{tag}</span>
									{/each}
									{#each entry.tagsRemoved.slice(0, 2) as tag}
										<span class="mut-remove">-{tag}</span>
									{/each}
								</span>
							{/if}
						</button>
					{/each}
					{#if simulatorStore.history.length === 0}
						<div class="no-history">No history yet</div>
					{/if}
				</div>
			</div>

			<!-- Controls -->
			<div class="sim-controls">
				<button
					class="control-btn"
					onclick={() => simulatorStore.reset()}
					title="Reset simulation"
				>
					Reset
				</button>
				<button
					class="control-btn"
					onclick={() => simulatorStore.back()}
					disabled={simulatorStore.historyIndex < 0}
					title="Go back one step"
				>
					&larr; Back
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.simulator {
		height: 100%;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.simulator-inactive {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: 1rem;
		text-align: center;
	}

	.simulator-inactive h2 {
		font-size: 1rem;
		margin-bottom: 0.5rem;
	}

	.simulator-inactive p {
		color: var(--color-text-secondary);
		font-size: 0.85rem;
		margin-bottom: 1rem;
	}

	.start-btn {
		padding: 0.5rem 1rem;
		background: var(--color-button);
		color: var(--color-button-text);
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-family: inherit;
	}

	.start-btn:hover {
		opacity: 0.9;
	}

	.simulator-active {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	.sim-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--color-border);
	}

	.sim-header h2 {
		font-size: 1rem;
		margin: 0;
	}

	.stop-btn {
		background: none;
		border: none;
		font-size: 1.25rem;
		cursor: pointer;
		color: var(--color-text-secondary);
		padding: 0.25rem;
		line-height: 1;
	}

	.stop-btn:hover {
		color: var(--color-failure);
	}

	.sim-section {
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--color-border);
	}

	.section-label {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.75rem;
		font-weight: bold;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		margin-bottom: 0.35rem;
	}

	.section-actions {
		display: flex;
		gap: 0.25rem;
	}

	.copy-tags-btn,
	.edit-step-btn,
	.expand-btn {
		font-size: 0.7rem;
		padding: 0.15rem 0.4rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 3px;
		cursor: pointer;
		text-transform: none;
		font-weight: normal;
	}

	.copy-tags-btn:hover,
	.edit-step-btn:hover,
	.expand-btn:hover {
		background: #f0f0f0;
	}

	.location-select {
		width: 100%;
		padding: 0.35rem;
		font-family: inherit;
		font-size: 0.85rem;
		border: 1px solid var(--color-border);
		border-radius: 4px;
	}

	.tag-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		min-height: 1.5rem;
	}

	.tag {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.15rem 0.4rem;
		background: var(--color-accent);
		color: white;
		border-radius: 3px;
		font-size: 0.75rem;
		font-family: monospace;
	}

	.tag-remove {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.7);
		cursor: pointer;
		padding: 0;
		font-size: 0.85rem;
		line-height: 1;
	}

	.tag-remove:hover {
		color: white;
	}

	.no-tags {
		color: var(--color-text-secondary);
		font-size: 0.8rem;
		font-style: italic;
	}

	.add-tag-row {
		margin-top: 0.35rem;
	}

	.add-tag-input {
		width: 100%;
		padding: 0.25rem 0.4rem;
		font-family: inherit;
		font-size: 0.8rem;
		border: 1px solid var(--color-border);
		border-radius: 3px;
	}

	.current-step {
		background: white;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		padding: 0.5rem;
	}

	.current-step.expanded {
		max-height: 300px;
		overflow-y: auto;
	}

	.current-step.expanded .step-text {
		white-space: pre-wrap;
		line-height: 1.4;
	}

	.step-id {
		font-weight: bold;
		font-family: monospace;
		font-size: 0.85rem;
		margin-bottom: 0.25rem;
	}

	.step-text {
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		line-height: 1.3;
	}

	.no-match {
		background: var(--color-failure-bg);
		color: var(--color-failure);
		padding: 0.5rem;
		border-radius: 4px;
		font-size: 0.85rem;
	}

	.warning-icon {
		margin-right: 0.25rem;
	}

	.coverage-gap {
		margin: 0.25rem 0 0;
		font-size: 0.75rem;
		font-style: italic;
	}

	.no-location {
		color: var(--color-text-secondary);
		font-size: 0.85rem;
		font-style: italic;
	}

	.options-section {
		flex: 1;
		overflow-y: auto;
		min-height: 0;
	}

	.options-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.option {
		background: white;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		overflow: hidden;
	}

	.option.unavailable {
		opacity: 0.6;
	}

	.option.hidden-option {
		border-style: dashed;
	}

	.option-btn {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.4rem 0.5rem;
		background: var(--color-surface);
		border: none;
		border-bottom: 1px solid var(--color-border);
		cursor: pointer;
		font-family: inherit;
		text-align: left;
	}

	.option-btn:disabled {
		cursor: not-allowed;
	}

	.option-btn:not(:disabled):hover {
		background: #f0f0f0;
	}

	.option-label {
		font-size: 0.85rem;
	}

	.target-hint {
		font-size: 0.7rem;
		color: var(--color-text-secondary);
		font-family: monospace;
		margin-left: 0.25rem;
	}

	.skill-badge {
		font-size: 0.7rem;
		padding: 0.15rem 0.35rem;
		background: var(--color-accent);
		color: white;
		border-radius: 3px;
		text-transform: capitalize;
	}

	.option-details {
		padding: 0.35rem 0.5rem;
		font-size: 0.75rem;
	}

	.target {
		color: var(--color-text-secondary);
	}

	.target.end {
		font-style: italic;
	}

	.missing-tags {
		color: var(--color-failure);
		margin-top: 0.25rem;
	}

	.mutations {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-top: 0.25rem;
	}

	.mutation {
		padding: 0.1rem 0.3rem;
		border-radius: 2px;
		font-family: monospace;
		font-size: 0.7rem;
	}

	.mutation.add {
		background: #d4edda;
		color: #155724;
	}

	.mutation.remove {
		background: #f8d7da;
		color: #721c24;
	}

	.outcome-selector {
		padding: 0.35rem 0.5rem;
		background: #f8f9fa;
		border-top: 1px solid var(--color-border);
		display: flex;
		gap: 1rem;
		font-size: 0.75rem;
	}

	.outcome-selector label {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		cursor: pointer;
	}

	.end-selector {
		padding: 0.35rem 0.5rem;
		background: #f8f9fa;
		border-top: 1px solid var(--color-border);
		font-size: 0.75rem;
	}

	.end-selector label {
		display: block;
		margin-bottom: 0.25rem;
		color: var(--color-text-secondary);
	}

	.end-selector select {
		width: 100%;
		padding: 0.25rem;
		font-family: inherit;
		font-size: 0.8rem;
		border: 1px solid var(--color-border);
		border-radius: 3px;
	}

	.no-options {
		color: var(--color-text-secondary);
		font-size: 0.85rem;
		font-style: italic;
		text-align: center;
		padding: 0.5rem;
	}

	.history-section {
		flex-shrink: 0;
		max-height: 150px;
		overflow-y: auto;
	}

	.history-list {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.history-entry {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.25rem 0.4rem;
		background: white;
		border: 1px solid var(--color-border);
		border-radius: 3px;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.75rem;
		text-align: left;
	}

	.history-entry:hover {
		background: var(--color-surface);
	}

	.history-entry.current {
		background: var(--color-accent);
		color: white;
		border-color: var(--color-accent);
	}

	.history-entry.future {
		opacity: 0.5;
	}

	.entry-num {
		color: var(--color-text-secondary);
		min-width: 1.5rem;
	}

	.history-entry.current .entry-num {
		color: rgba(255, 255, 255, 0.8);
	}

	.entry-location {
		font-weight: bold;
	}

	.entry-option {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.entry-mutations {
		display: flex;
		gap: 0.15rem;
	}

	.mut-add,
	.mut-remove {
		font-family: monospace;
		font-size: 0.65rem;
	}

	.mut-add {
		color: #155724;
	}

	.mut-remove {
		color: #721c24;
	}

	.history-entry.current .mut-add,
	.history-entry.current .mut-remove {
		color: rgba(255, 255, 255, 0.9);
	}

	.no-history {
		color: var(--color-text-secondary);
		font-size: 0.8rem;
		font-style: italic;
		text-align: center;
		padding: 0.5rem;
	}

	.sim-controls {
		display: flex;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-top: 1px solid var(--color-border);
		background: var(--color-surface);
	}

	.control-btn {
		flex: 1;
		padding: 0.4rem;
		font-family: inherit;
		font-size: 0.8rem;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		background: white;
		cursor: pointer;
	}

	.control-btn:hover:not(:disabled) {
		background: var(--color-surface);
	}

	.control-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Alternative Steps */
	.alternatives-section {
		padding: 0.35rem 0.75rem;
	}

	.alternatives-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.alt-btn {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.25rem 0.5rem;
		background: white;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.75rem;
		transition: all 0.15s;
	}

	.alt-btn:hover {
		background: var(--color-surface);
		border-color: var(--color-accent);
	}

	.alt-btn.selected {
		background: var(--color-accent);
		color: white;
		border-color: var(--color-accent);
	}

	.alt-num {
		font-weight: bold;
		min-width: 1rem;
		text-align: center;
	}

	.alt-tags {
		display: flex;
		gap: 0.2rem;
	}

	.alt-tag {
		font-family: monospace;
		font-size: 0.65rem;
		padding: 0.1rem 0.25rem;
		background: var(--color-surface);
		border-radius: 2px;
		color: var(--color-text-secondary);
	}

	.alt-btn.selected .alt-tag {
		background: rgba(255, 255, 255, 0.2);
		color: white;
	}
</style>
