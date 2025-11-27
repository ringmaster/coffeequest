export type StatName = 'might' | 'guile' | 'magic';

export interface Stats {
	might: number;
	guile: number;
	magic: number;
}

export interface Character {
	might: number;
	guile: number;
	magic: number;
	stepsCompleted: number;
	xp: number;
	metadata: string[];
}

// Skill check source can be a stat name or a tag name
// Stats (might/guile/magic) add their value; tags add +2 per copy
export type SkillSource = string;

export interface StepOption {
	label: string;
	tags: string[];
	skill?: SkillSource | SkillSource[];
	dc?: number;
	pass: string | null;
	fail?: string;
	hidden?: boolean;
}

// Raw option can be a string shorthand or full object
export type RawStepOption = string | StepOption;

// Raw step as stored in quest files (before expansion)
export interface RawStep {
	id: string;
	tags: string[];
	vars?: Record<string, string[] | null>;
	text: string;
	log?: string;
	options?: RawStepOption[] | string; // Can be array or preset name
}

// Processed step with expanded options
export interface Step {
	id: string;
	tags: string[];
	vars?: Record<string, string[] | null>;
	text: string;
	log?: string;
	options?: StepOption[];
}

// Option presets entry in step data
export interface OptionPresetsEntry {
	option_presets: Record<string, RawStepOption[]>;
}

export interface GameConfig {
	startingStats: Stats;
	statsIncreaseEvery: number;
	statIncreaseAmount: number;
	preferredTagWeight: number;
	startingPoints: number;
	statModifiers: Record<string, Partial<Stats>>;
}

export interface StepData {
	config: GameConfig;
	locations?: Record<string, string>;
	option_presets?: Record<string, RawStepOption[]>;
	steps: (RawStep | OptionPresetsEntry)[];
}

export interface StepDataError {
	error: string;
}

export interface GameState {
	character: Character;
	questVars: Record<string, string>;
	currentStepId: string | null;
	questLog: string[];
}

export interface SkillBonus {
	source: string; // stat name or tag name
	value: number;
}

export interface SkillCheckResult {
	roll: number;
	bonuses: SkillBonus[]; // breakdown of all bonuses
	totalBonus: number; // sum of all bonuses
	total: number; // roll + totalBonus
	dc: number;
	success: boolean;
}

export type GamePhase =
	| 'character_creation'
	| 'navigation'
	| 'display_step'
	| 'skill_check_roll'
	| 'skill_check_result';
