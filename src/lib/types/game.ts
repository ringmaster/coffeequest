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
	metadata: string[];
}

export interface StepOption {
	label: string;
	tags: string[];
	skill?: StatName;
	dc?: number;
	pass: string | null;
	fail?: string;
}

export interface Step {
	id: string;
	tags: string[];
	vars?: Record<string, string[] | null>;
	text: string;
	log?: string;
	options?: StepOption[];
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
	steps: Step[];
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

export interface SkillCheckResult {
	roll: number;
	statValue: number;
	modifier: number;
	total: number;
	dc: number;
	success: boolean;
}

export type GamePhase =
	| 'character_creation'
	| 'navigation'
	| 'display_step'
	| 'skill_check_roll'
	| 'skill_check_result';
