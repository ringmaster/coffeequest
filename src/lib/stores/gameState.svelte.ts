import type {
	Character,
	GameState,
	GamePhase,
	Step,
	StepOption,
	GameConfig,
	StatName,
	SkillCheckResult,
	RawStep,
	OptionPresetsEntry,
	RawStepOption
} from '$lib/types/game';
import { processStepData } from '$lib/game/engine';

const STORAGE_KEY = 'coffeequest_save';
const MAX_LOG_ENTRIES = 100;

function createDefaultCharacter(): Character {
	return {
		might: 2,
		guile: 2,
		magic: 2,
		stepsCompleted: 0,
		xp: 0,
		metadata: []
	};
}

function createDefaultState(): GameState {
	return {
		character: createDefaultCharacter(),
		questVars: {},
		currentStepId: null,
		questLog: []
	};
}

function loadFromStorage(): GameState | null {
	if (typeof window === 'undefined') return null;
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			return JSON.parse(saved) as GameState;
		}
	} catch (e) {
		console.error('Failed to load save data:', e);
	}
	return null;
}

function saveToStorage(state: GameState): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch (e) {
		console.error('Failed to save game state:', e);
	}
}

class GameStore {
	// Core state
	state = $state<GameState>(createDefaultState());
	phase = $state<GamePhase>('character_creation');
	config = $state<GameConfig | null>(null);
	locations = $state<Record<string, string>>({});
	steps = $state<Step[]>([]);

	// UI state
	currentDisplayStep = $state<Step | null>(null);
	availableOptions = $state<StepOption[]>([]);
	pendingSkillCheck = $state<{
		option: StepOption;
	} | null>(null);
	skillCheckResult = $state<SkillCheckResult | null>(null);
	showQuestLog = $state<boolean>(false);
	errorMessage = $state<string | null>(null);

	// Derived state
	hasExistingSave = $derived(
		typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) !== null
	);

	statModifiers = $derived.by(() => {
		if (!this.config) return { might: 0, guile: 0, magic: 0 };
		const mods = { might: 0, guile: 0, magic: 0 };
		for (const tag of this.state.character.metadata) {
			const tagMods = this.config.statModifiers[tag];
			if (tagMods) {
				if (tagMods.might) mods.might += tagMods.might;
				if (tagMods.guile) mods.guile += tagMods.guile;
				if (tagMods.magic) mods.magic += tagMods.magic;
			}
		}
		return mods;
	});

	effectiveStats = $derived({
		might: this.state.character.might + this.statModifiers.might,
		guile: this.state.character.guile + this.statModifiers.guile,
		magic: this.state.character.magic + this.statModifiers.magic
	});

	// Level is derived from XP (level up every 5 XP)
	level = $derived(Math.floor(this.state.character.xp / 5) + 1);

	/**
	 * Get effective metadata including virtual level tags.
	 * Level tags are added as multiples equal to the player's level.
	 */
	effectiveMetadata = $derived.by(() => {
		const metadata = [...this.state.character.metadata];
		// Add virtual "level" tags equal to current level
		for (let i = 0; i < this.level; i++) {
			metadata.push('level');
		}
		return metadata;
	});

	/**
	 * Get inventory items (inv: prefixed tags) grouped and counted
	 */
	inventoryItems = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const tag of this.state.character.metadata) {
			if (tag.startsWith('inv:')) {
				const item = tag.substring(4);
				counts.set(item, (counts.get(item) || 0) + 1);
			}
		}
		return Array.from(counts.entries())
			.map(([item, count]) => ({ item, count }))
			.sort((a, b) => a.item.localeCompare(b.item));
	});

	/**
	 * Get trait tags (trait: prefixed)
	 */
	traits = $derived.by(() => {
		const traits = new Set<string>();
		for (const tag of this.state.character.metadata) {
			if (tag.startsWith('trait:')) {
				traits.add(tag.substring(6));
			}
		}
		return Array.from(traits).sort();
	});

	/**
	 * Get status tags (status: prefixed)
	 */
	statuses = $derived.by(() => {
		const statuses = new Set<string>();
		for (const tag of this.state.character.metadata) {
			if (tag.startsWith('status:')) {
				statuses.add(tag.substring(7));
			}
		}
		return Array.from(statuses).sort();
	});

	/**
	 * Get ally tags (ally: prefixed)
	 */
	allies = $derived.by(() => {
		const allies = new Set<string>();
		for (const tag of this.state.character.metadata) {
			if (tag.startsWith('ally:')) {
				allies.add(tag.substring(5));
			}
		}
		return Array.from(allies).sort();
	});

	/**
	 * Get done tags (done: prefixed) - completed quests
	 */
	completedQuests = $derived.by(() => {
		const done = new Set<string>();
		for (const tag of this.state.character.metadata) {
			if (tag.startsWith('done:')) {
				done.add(tag.substring(5));
			}
		}
		return Array.from(done).sort();
	});

	initialize(
		config: GameConfig,
		locations: Record<string, string>,
		rawSteps: (RawStep | OptionPresetsEntry)[],
		topLevelPresets?: Record<string, RawStepOption[]>
	): void {
		this.config = config;
		this.locations = locations;

		// Process raw steps: expand presets and shorthand options
		const { steps } = processStepData(rawSteps, topLevelPresets);
		this.steps = steps;

		const saved = loadFromStorage();
		if (saved) {
			this.state = saved;
			this.phase = 'navigation';
		} else {
			this.state = createDefaultState();
			this.state.character = {
				...createDefaultCharacter(),
				might: config.startingStats.might,
				guile: config.startingStats.guile,
				magic: config.startingStats.magic
			};
			this.phase = 'character_creation';
		}
	}

	startNewGame(might: number, guile: number, magic: number, characterName: string): void {
		this.state = createDefaultState();
		this.state.character.might = might;
		this.state.character.guile = guile;
		this.state.character.magic = magic;
		this.state.questVars.character_name = characterName.trim();
		this.phase = 'navigation';
		this.save();
	}

	clearSave(): void {
		if (typeof window === 'undefined') return;
		localStorage.removeItem(STORAGE_KEY);
		this.state = createDefaultState();
		if (this.config) {
			this.state.character.might = this.config.startingStats.might;
			this.state.character.guile = this.config.startingStats.guile;
			this.state.character.magic = this.config.startingStats.magic;
		}
		this.phase = 'character_creation';
		this.currentDisplayStep = null;
		this.availableOptions = [];
	}

	save(): void {
		saveToStorage(this.state);
	}

	// Tag management
	hasTag(tag: string): boolean {
		return this.state.character.metadata.includes(tag);
	}

	countTag(tag: string): number {
		return this.state.character.metadata.filter((t) => t === tag).length;
	}

	addTag(tag: string): void {
		this.state.character.metadata.push(tag);
	}

	/**
	 * Remove a tag. Returns true if tag was found and removed.
	 * When removing "quest" tag, also clears all q: prefixed tags and grants XP.
	 * The leveledUp flag will be set if the XP gain caused a level up.
	 */
	leveledUp = $state(false);

	removeTag(tag: string): boolean {
		const index = this.state.character.metadata.indexOf(tag);
		if (index > -1) {
			this.state.character.metadata.splice(index, 1);
			// Special handling for "quest" tag - grants XP and clears all q: prefixed tags
			if (tag === 'quest') {
				this.leveledUp = this.grantXP(1);
				// Auto-clear all q: prefixed tags (quest-scoped state)
				this.state.character.metadata = this.state.character.metadata.filter(
					(t) => !t.startsWith('q:')
				);
			}
			return true;
		}
		return false;
	}

	// Quest log
	addLogEntry(entry: string): void {
		this.state.questLog.unshift(entry);
		if (this.state.questLog.length > MAX_LOG_ENTRIES) {
			this.state.questLog = this.state.questLog.slice(0, MAX_LOG_ENTRIES);
		}
	}

	// Variable management
	setVariable(name: string, value: string): void {
		this.state.questVars[name] = value;
	}

	clearVariable(name: string): void {
		delete this.state.questVars[name];
	}

	renderText(template: string): string {
		return template.replace(/\{\{([\w.]+)\}\}/g, (match, varName) => {
			// Check for direct variable match first
			if (this.state.questVars[varName]) {
				return this.state.questVars[varName];
			}

			// Check for gendered pronoun derivation (e.g., {{npc.him}} derives from npc.gender)
			const pronounValue = this.deriveGenderedPronoun(varName);
			if (pronounValue) {
				return pronounValue;
			}

			return match;
		});
	}

	/**
	 * Derive a gendered pronoun from a namespace.pronoun pattern.
	 * E.g., "npc.him" checks "npc.gender" and returns the appropriate pronoun.
	 */
	private deriveGenderedPronoun(varName: string): string | null {
		const pronounMap: Record<string, Record<string, string>> = {
			male: {
				he: 'he', she: 'he', they: 'he',
				him: 'him', her: 'him', them: 'him',
				his: 'his', hers: 'his', theirs: 'his',
				himself: 'himself', herself: 'himself', themself: 'himself',
				He: 'He', She: 'He', They: 'He',
				Him: 'Him', Her: 'Him', Them: 'Him',
				His: 'His', Hers: 'His', Theirs: 'His',
				Himself: 'Himself', Herself: 'Himself', Themself: 'Himself'
			},
			female: {
				he: 'she', she: 'she', they: 'she',
				him: 'her', her: 'her', them: 'her',
				his: 'her', hers: 'her', theirs: 'her',
				himself: 'herself', herself: 'herself', themself: 'herself',
				He: 'She', She: 'She', They: 'She',
				Him: 'Her', Her: 'Her', Them: 'Her',
				His: 'Her', Hers: 'Her', Theirs: 'Her',
				Himself: 'Herself', Herself: 'Herself', Themself: 'Herself'
			},
			neutral: {
				he: 'they', she: 'they', they: 'they',
				him: 'them', her: 'them', them: 'them',
				his: 'their', hers: 'their', theirs: 'their',
				himself: 'themself', herself: 'themself', themself: 'themself',
				He: 'They', She: 'They', They: 'They',
				Him: 'Them', Her: 'Them', Them: 'Them',
				His: 'Their', Hers: 'Their', Theirs: 'Their',
				Himself: 'Themself', Herself: 'Themself', Themself: 'Themself'
			}
		};

		const dotIndex = varName.lastIndexOf('.');
		if (dotIndex === -1) return null;

		const namespace = varName.substring(0, dotIndex);
		const pronounKey = varName.substring(dotIndex + 1);

		// Look up the gender for this namespace
		const gender = this.state.questVars[`${namespace}.gender`];
		if (!gender || !pronounMap[gender]) return null;

		// Look up the pronoun
		return pronounMap[gender][pronounKey] || null;
	}

	// Stat progression - called by player choice during level_up phase
	increaseStat(stat: StatName): void {
		if (!this.config) return;
		this.state.character[stat] += this.config.statIncreaseAmount;
		this.save();
	}

	/**
	 * Grant XP and check for level up.
	 * Returns true if a level up occurred (caller should transition to level_up phase)
	 */
	grantXP(amount: number = 1): boolean {
		const oldLevel = this.level;
		this.state.character.xp += amount;
		const newLevel = Math.floor(this.state.character.xp / 5) + 1;
		return newLevel > oldLevel;
	}

	toggleQuestLog(): void {
		this.showQuestLog = !this.showQuestLog;
	}

	// Resolve a coordinate to a location name (case insensitive)
	resolveLocation(coordinate: string): string {
		const normalized = coordinate.toUpperCase().trim();
		const locationName = this.locations[normalized];
		return locationName || normalized;
	}
}

export const gameStore = new GameStore();
