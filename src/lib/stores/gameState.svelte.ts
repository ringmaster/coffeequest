import type {
	Character,
	GameState,
	GamePhase,
	Step,
	StepOption,
	GameConfig,
	StatName,
	SkillCheckResult
} from '$lib/types/game';

const STORAGE_KEY = 'coffeequest_save';
const MAX_LOG_ENTRIES = 100;

function createDefaultCharacter(): Character {
	return {
		might: 2,
		guile: 2,
		magic: 2,
		stepsCompleted: 0,
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
	steps = $state<Step[]>([]);

	// UI state
	currentDisplayStep = $state<Step | null>(null);
	availableOptions = $state<StepOption[]>([]);
	pendingSkillCheck = $state<{
		option: StepOption;
		selectedStat: StatName | null;
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

	initialize(config: GameConfig, steps: Step[]): void {
		this.config = config;
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

	removeTag(tag: string): boolean {
		const index = this.state.character.metadata.indexOf(tag);
		if (index > -1) {
			this.state.character.metadata.splice(index, 1);
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
		return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
			return this.state.questVars[varName] || match;
		});
	}

	// Stat progression
	checkStatIncrease(): StatName | null {
		if (!this.config) return null;
		const stepsCompleted = this.state.character.stepsCompleted;
		const interval = this.config.statsIncreaseEvery;

		if (stepsCompleted > 0 && stepsCompleted % interval === 0) {
			// Increase the lowest stat
			const stats: StatName[] = ['might', 'guile', 'magic'];
			const lowest = stats.reduce((min, stat) =>
				this.state.character[stat] < this.state.character[min] ? stat : min
			);
			this.state.character[lowest] += this.config.statIncreaseAmount;
			return lowest;
		}
		return null;
	}

	toggleQuestLog(): void {
		this.showQuestLog = !this.showQuestLog;
	}
}

export const gameStore = new GameStore();
