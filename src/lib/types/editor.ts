import type { RawStep, RawStepOption, GameConfig } from './game';

// Quest file structure for editor
export interface QuestFile {
	name?: string;
	option_presets?: Record<string, RawStepOption[]>;
	steps: RawStep[];
}

// Parsed tag with operator
export interface ParsedTag {
	operator: '@' | '!' | '+' | '-' | '';
	tag: string;
}

// Lint result
export type LintSeverity = 'error' | 'warning' | 'info';

export interface LintResult {
	severity: LintSeverity;
	code: string;
	message: string;
	stepId?: string;
	stepIndex?: number;
	optionIndex?: number;
	relatedStepId?: string;
	relatedStepIndex?: number;
}

// Coverage matrix row
export interface CoverageRow {
	tagValues: Record<string, boolean | null>;
	matches: string[];
	status: 'single' | 'none' | 'ambiguous' | 'default';
}

// API response types
export interface FileListResponse {
	files: string[];
}

export interface FileContentResponse {
	name: string;
	content: QuestFile;
}

export interface ContextResponse {
	locations: Record<string, string>;
	config: GameConfig | null;
}

export interface SaveResponse {
	success: boolean;
	error?: string;
}
