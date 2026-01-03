import type { RawStep, RawStepOption, GameConfig } from './game';

// Quest file structure for editor
export interface QuestFile {
	name?: string;
	option_presets?: Record<string, RawStepOption[]>;
	steps: RawStep[];
}

// Step graph node for tree visualization
export interface StepNode {
	step: RawStep;
	stepIndex: number;
	children: StepNode[];
	parents: StepNode[];
}

// Tree node for display (handles cycles and multiple parents)
export interface TreeNode {
	stepId: string;
	stepIndex: number;
	step: RawStep;
	children: TreeNode[];
	// Display metadata
	isLocation: boolean;
	isPatch: boolean;
	isOrphaned: boolean;
	// Reference types (for non-primary occurrences)
	refType: 'primary' | 'back' | 'see-above' | 'external' | null;
	refTarget?: string; // For back/see-above refs, the step ID being referenced
}

// Root group for display
export interface StepTreeGroup {
	rootId: string;
	rootLabel: string;
	keyTags: string[]; // Key differentiating tags
	children: TreeNode[];
	stepCount: number;
}

// Parsed tag with operator and optional comparison
export type TagOperator = '@' | '!' | '+' | '-' | '';
export type ComparisonOperator = '=' | '<' | '>' | null;

export interface ParsedTag {
	operator: TagOperator;
	tag: string;
	comparison: ComparisonOperator;
	value: number | null;
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
