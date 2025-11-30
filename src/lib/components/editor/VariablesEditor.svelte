<script lang="ts">
	import type { VarOptions } from '$lib/types/game';

	let {
		vars,
		onChange
	}: {
		vars: Record<string, VarOptions> | undefined;
		onChange: (vars: Record<string, VarOptions> | undefined) => void;
	} = $props();

	let expandedVar = $state<string | null>(null);
	let newVarName = $state('');

	// Get list of variable names
	let varNames = $derived(vars ? Object.keys(vars).sort() : []);

	function getVarPreview(value: VarOptions): string {
		if (value === null) return '(clear)';
		if (Array.isArray(value)) {
			if (value.length === 0) return '[]';
			if (typeof value[0] === 'string') {
				const preview = value.slice(0, 3).join(', ');
				return value.length > 3 ? `[${preview}, ...]` : `[${preview}]`;
			}
			// Object array
			return `[{...}] (${value.length} items)`;
		}
		return String(value);
	}

	function isObjectArray(value: VarOptions): boolean {
		return Array.isArray(value) && value.length > 0 && typeof value[0] === 'object';
	}

	function updateVar(name: string, value: VarOptions) {
		const newVars = { ...vars, [name]: value };
		onChange(newVars);
	}

	function removeVar(name: string) {
		if (!vars) return;
		const newVars = { ...vars };
		delete newVars[name];
		onChange(Object.keys(newVars).length > 0 ? newVars : undefined);
	}

	function addVar() {
		const name = newVarName.trim();
		if (!name) return;
		updateVar(name, ['value1', 'value2']);
		newVarName = '';
		expandedVar = name;
	}

	function updateStringArray(name: string, index: number, value: string) {
		if (!vars) return;
		const arr = vars[name] as string[];
		const newArr = [...arr];
		newArr[index] = value;
		updateVar(name, newArr);
	}

	function addStringToArray(name: string) {
		if (!vars) return;
		const arr = vars[name] as string[];
		updateVar(name, [...arr, '']);
	}

	function removeFromArray(name: string, index: number) {
		if (!vars) return;
		const arr = vars[name] as (string | Record<string, string>)[];
		updateVar(name, arr.filter((_, i) => i !== index) as VarOptions);
	}

	function updateObjectField(name: string, index: number, field: string, value: string) {
		if (!vars) return;
		const arr = vars[name] as Record<string, string>[];
		const newArr = [...arr];
		newArr[index] = { ...newArr[index], [field]: value };
		updateVar(name, newArr);
	}

	function addObjectToArray(name: string) {
		if (!vars) return;
		const arr = vars[name] as Record<string, string>[];
		// Copy structure from first object
		const template = arr[0] ? Object.fromEntries(Object.keys(arr[0]).map((k) => [k, ''])) : { name: '' };
		updateVar(name, [...arr, template]);
	}

	function addFieldToObjects(name: string, fieldName: string) {
		if (!vars) return;
		const arr = vars[name] as Record<string, string>[];
		const newArr = arr.map((obj) => ({ ...obj, [fieldName]: '' }));
		updateVar(name, newArr);
	}
</script>

<div class="vars-editor field">
	<span class="field-label">Variables</span>

	<div class="vars-list">
		{#if varNames.length === 0}
			<div class="empty">No variables defined</div>
		{:else}
			{#each varNames as name}
				{@const value = vars?.[name]}
				<div class="var-item" class:expanded={expandedVar === name}>
					<div class="var-header">
						<button class="var-name" onclick={() => (expandedVar = expandedVar === name ? null : name)}>
							<span class="expand-icon">{expandedVar === name ? '▼' : '▶'}</span>
							<code>{'{{' + name + '}}'}</code>
							<span class="var-preview">{getVarPreview(value ?? null)}</span>
						</button>
						<button class="remove-btn" onclick={() => removeVar(name)} title="Remove variable">
							&times;
						</button>
					</div>

					{#if expandedVar === name}
						<div class="var-content">
							{#if value === null || value === undefined}
								<p class="null-var">This variable will be cleared</p>
								<button onclick={() => updateVar(name, ['value'])}>Convert to array</button>
							{:else if isObjectArray(value)}
								{@const objArr = value as Record<string, string>[]}
								{@const fields = objArr[0] ? Object.keys(objArr[0]) : []}
								<table class="object-table">
									<thead>
										<tr>
											{#each fields as field}
												<th>{field}</th>
											{/each}
											<th></th>
										</tr>
									</thead>
									<tbody>
										{#each objArr as obj, i}
											<tr>
												{#each fields as field}
													<td>
														<input
															type="text"
															value={obj[field] ?? ''}
															onchange={(e) => updateObjectField(name, i, field, (e.target as HTMLInputElement).value)}
														/>
													</td>
												{/each}
												<td>
													<button class="remove-btn small" onclick={() => removeFromArray(name, i)}>
														&times;
													</button>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
								<div class="var-actions">
									<button onclick={() => addObjectToArray(name)}>+ Add row</button>
									<button
										onclick={() => {
											const fieldName = prompt('New field name:');
											if (fieldName) addFieldToObjects(name, fieldName);
										}}
									>
										+ Add field
									</button>
								</div>
							{:else}
								{@const strArr = value as string[]}
								<div class="string-array">
									{#each strArr as val, i}
										<div class="string-item">
											<input
												type="text"
												value={val}
												onchange={(e) => updateStringArray(name, i, (e.target as HTMLInputElement).value)}
												placeholder="Value..."
											/>
											<button class="remove-btn small" onclick={() => removeFromArray(name, i)}>
												&times;
											</button>
										</div>
									{/each}
									<button class="add-string" onclick={() => addStringToArray(name)}>
										+ Add value
									</button>
								</div>
								<button
									class="convert-btn"
									onclick={() => {
										// Convert to object array
										updateVar(name, strArr.map((s) => ({ name: s })));
									}}
								>
									Convert to objects (for NPCs)
								</button>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		{/if}

		<div class="var-add">
			<input
				type="text"
				bind:value={newVarName}
				onkeydown={(e) => e.key === 'Enter' && addVar()}
				placeholder="New variable name..."
			/>
			<button onclick={addVar} disabled={!newVarName.trim()}>Add Variable</button>
		</div>
	</div>

	<div class="field-hint">
		Variables can be referenced in text as <code>{'{{varname}}'}</code>. For objects, use
		<code>{'{{varname.field}}'}</code>.
	</div>
</div>

<style>
	.vars-editor {
		margin-bottom: 1.25rem;
	}

	.vars-editor > .field-label {
		display: block;
		font-size: 0.85rem;
		font-weight: bold;
		margin-bottom: 0.35rem;
		color: var(--color-text);
	}

	.vars-list {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		padding: 0.5rem;
	}

	.empty {
		color: var(--color-text-secondary);
		font-size: 0.85rem;
		padding: 0.5rem;
	}

	.var-item {
		border: 1px solid var(--color-border);
		border-radius: 4px;
		margin-bottom: 0.35rem;
		background: white;
	}

	.var-item.expanded {
		border-color: var(--color-accent);
	}

	.var-header {
		display: flex;
		align-items: center;
	}

	.var-name {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: none;
		border: none;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.85rem;
		text-align: left;
		min-width: 0;
		overflow: hidden;
	}

	.var-name:hover {
		background: var(--color-surface);
	}

	.expand-icon {
		flex-shrink: 0;
		font-size: 0.7rem;
		color: var(--color-text-secondary);
	}

	.var-name code {
		flex-shrink: 0;
		background: #f0f0f0;
		padding: 0.15rem 0.35rem;
		border-radius: 3px;
		font-size: 0.8rem;
	}

	.var-preview {
		flex: 1;
		min-width: 0;
		color: var(--color-text-secondary);
		font-size: 0.8rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.var-content {
		padding: 0.75rem;
		border-top: 1px solid var(--color-border);
		background: #fafafa;
	}

	.remove-btn {
		padding: 0.35rem 0.5rem;
		background: none;
		border: none;
		cursor: pointer;
		font-size: 1.1rem;
		line-height: 1;
		color: var(--color-text-secondary);
	}

	.remove-btn:hover {
		color: var(--color-failure);
	}

	.remove-btn.small {
		padding: 0.2rem 0.35rem;
		font-size: 0.9rem;
	}

	.string-array {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.string-item {
		display: flex;
		gap: 0.25rem;
	}

	.string-item input {
		flex: 1;
		padding: 0.35rem 0.5rem;
		font-size: 0.85rem;
		border: 1px solid var(--color-border);
		border-radius: 4px;
	}

	.add-string,
	.convert-btn {
		padding: 0.35rem 0.75rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.8rem;
		margin-top: 0.5rem;
	}

	.add-string:hover,
	.convert-btn:hover {
		background: var(--color-border);
	}

	.convert-btn {
		display: block;
		width: 100%;
		text-align: center;
		color: var(--color-text-secondary);
	}

	.object-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
		margin-bottom: 0.5rem;
	}

	.object-table th {
		text-align: left;
		padding: 0.35rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		font-weight: normal;
		color: var(--color-text-secondary);
	}

	.object-table td {
		padding: 0.25rem;
		border: 1px solid var(--color-border);
	}

	.object-table input {
		width: 100%;
		padding: 0.25rem;
		font-size: 0.8rem;
		border: 1px solid transparent;
		background: transparent;
	}

	.object-table input:focus {
		border-color: var(--color-accent);
		background: white;
	}

	.var-actions {
		display: flex;
		gap: 0.5rem;
	}

	.var-actions button {
		padding: 0.35rem 0.75rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.8rem;
	}

	.null-var {
		color: var(--color-text-secondary);
		font-size: 0.85rem;
		margin-bottom: 0.5rem;
	}

	.var-add {
		display: flex;
		gap: 0.25rem;
		margin-top: 0.5rem;
	}

	.var-add input {
		flex: 1;
		padding: 0.35rem 0.5rem;
		font-size: 0.85rem;
		border: 1px solid var(--color-border);
		border-radius: 4px;
	}

	.var-add button {
		padding: 0.35rem 0.75rem;
		background: var(--color-button);
		color: var(--color-button-text);
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.85rem;
	}

	.var-add button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.field-hint {
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		margin-top: 0.35rem;
	}

	.field-hint code {
		background: #f0f0f0;
		padding: 0.1rem 0.25rem;
		border-radius: 3px;
		font-size: 0.75rem;
	}
</style>
