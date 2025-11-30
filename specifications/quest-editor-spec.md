# Coffee Quest: Visual Quest Editor Specification

## Overview

A browser-based visual editor for authoring and editing quest step files. The editor provides tag-state-driven navigation, step editing forms, coverage analysis, and validation — tools that address pain points in raw YAML editing that syntax highlighting alone cannot solve.

**Target users:** Solo developer and any ambitious contributors.

**File format:** Edits YAML source files directly. The existing build process compiles YAML/JSON quest files into the consolidated `steps.json`.

## Core Concepts

### Tag State as Navigation

The editor's primary navigation model is "what would a player with these tags see at this location?" Rather than scrolling through a list of steps, the author sets a hypothetical tag state and location, and the editor shows which step(s) match.

### Coverage Analysis

The editor can reveal gaps in step coverage — combinations of location + tags that have no matching step, or that match multiple steps ambiguously.

### Validation

Periodic linting catches structural issues: broken step references, dead-end options, undefined variables, tag typos.

## Architecture

### Technology Stack

- Single-page React application
- Runs locally or as a static deployment
- File I/O via File System Access API (for local editing) or manual load/save
- YAML parsing via `js-yaml` or similar
- State management via React state or lightweight store (Zustand, etc.)

### File Handling

The editor operates on individual quest YAML files. It does not manage the build process or the consolidated `steps.json`.

**Load sources:**
- Local file picker (File System Access API where supported)
- Drag-and-drop file loading
- Manual paste of YAML content

**Save targets:**
- Write back to opened file (if File System Access API available)
- Download as `.yaml` file
- Copy YAML to clipboard

**Project context (optional):**
- Load `_locations.json` to populate location dropdown
- Load `_config.json` for reference (stat modifiers, etc.)
- Load other quest files to build cross-file tag autocomplete index
- These are read-only context; the editor modifies only the active quest file

## User Interface

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Open File] [Save] [Download]          Coffee Quest Editor    [⚙]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Location: [▼ Town Square                              ]            │
│                                                                     │
│  Active Tags: [quest] [q:mystery] [inv:clue]  [+ Add Tag]          │
│                                                                     │
│  [▼ Show Coverage Matrix]                                           │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─ Matching Step ─────────────────────────────────────────────┐   │
│  │                                                              │   │
│  │  (step editor form — see Step Editor section)                │   │
│  │                                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [+ Add Step for This Location]                                     │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  Lint: ✓ No issues  /  ⚠ 3 warnings  [Run Lint]                    │
│  (expandable lint results panel)                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Header Bar

- **Open File:** File picker or drag-drop zone
- **Save:** Write to source file (if available) or prompt download
- **Download:** Always available; downloads current state as YAML
- **Settings (⚙):** Load project context files, configure lint rules

### Location Selector

Dropdown populated from:
1. `_locations.json` (if loaded as project context)
2. All unique location-type `id` values found in the current file
3. Manual entry for new locations

Location-type IDs are those matching known location names (from `_locations.json`) or appearing as the `id` of steps that lack internal-transition patterns.

### Tag State Selector

**Active Tags panel:**
- Displays currently selected hypothetical tags as removable chips/badges
- Add Tag input with autocomplete:
  - Suggests tags used in the current file
  - Suggests tags from other loaded quest files (project context)
  - Suggests known prefixes (`inv:`, `q:`, `done:`, `status:`, `trait:`, `ally:`, `know:`)
- Clicking a tag chip removes it from the active set

**Interaction:**
- Changing the active tags immediately updates the matching step display
- The tag state represents "a player with exactly these tags" for filtering purposes

### Coverage Matrix (Collapsible)

Shows all tag combinations relevant to the selected location and which step (if any) matches each.

**Columns:**
- One column per tag that appears in any step's requirements for this location
- "Matches" column showing result

**Rows:**
- Cartesian product of tag presence/absence, pruned to plausible combinations
- Each row shows: tag values (✓/✗/−), matching step ID or status

**Match statuses:**
- Step ID (clickable to load that step)
- `(default)` — Falls through to default-locations.json
- `(none)` — No step matches; coverage gap
- `(ambiguous: N)` — Multiple steps match; random selection would occur

**Interaction:**
- Clicking a row sets the Active Tags to that combination
- Coverage gaps highlighted in warning color
- Ambiguous matches highlighted in info color

### Step Editor

The main editing surface. Shows details for the step matching the current location + tag state.

**States:**
- **Single match:** Display editable form for that step
- **No match:** Show "No step matches this tag combination" with option to create one
- **Multiple matches:** Show list of matching steps with option to select one for editing
- **No location selected:** Prompt to select a location

#### Step Editor Form

```
┌─────────────────────────────────────────────────────────────────┐
│  Step ID                                                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ [📍 Town Square    ▼] / [mystery_resolution]               │ │
│  └────────────────────────────────────────────────────────────┘ │
│  (location selector for location-steps; text input for internal)│
│                                                                 │
│  Tags                                                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ [@quest] [@q:mystery] [!done:mystery] [+q:resolved] [+]    │ │
│  └────────────────────────────────────────────────────────────┘ │
│  (tag chips with operator prefix; click to edit; + to add)      │
│                                                                 │
│  Variables                                        [+ Add Var]   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ suspect: ["guard", "smith", "madam"]              [Edit]   │ │
│  │ reward: [{"amount": 2, "type": "silver"}, ...]    [Edit]   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Text                                                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ The {{suspect}} looks nervous as you approach.             │ │
│  │ {{suspect.He}} knows something.                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│  (textarea with syntax highlighting for {{variables}})          │
│  (clicking a {{variable}} opens its definition in Variables)    │
│                                                                 │
│  Options                                          [+ Add Option]│
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 1. "Confront them" → confront_step              [≡] [Edit] │ │
│  │ 2. "Search the area" → search_step  [Guile 5]   [≡] [Edit] │ │
│  │ 3. "Leave"  → (end)                             [≡] [Edit] │ │
│  └────────────────────────────────────────────────────────────┘ │
│  (drag handle [≡] to reorder; compact display with expand)      │
│                                                                 │
│  Log Entry                                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Confronted the {{suspect}} about the theft                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│  (optional; single-line input with variable highlighting)       │
│                                                                 │
│                                              [Delete Step]      │
└─────────────────────────────────────────────────────────────────┘
```

#### Step ID Field

Two-part display distinguishing location-steps from internal-steps:

- **Location-steps:** Dropdown selector (populated from `_locations.json` + file contents)
  - Icon: 📍 or map pin
- **Internal-steps:** Text input for arbitrary ID
  - Icon: ➔ or flow arrow
- Toggle or auto-detection based on whether ID matches a known location

#### Tags Editor

Display as chips with operator prefix visible:
- `@tag` — Require (explicit)
- `!tag` — Forbid
- `+tag` — Add
- `-tag` — Remove
- Bare `tag` in step context = require (display as `@tag` for clarity?)

**Editing a tag:**
- Click chip to open inline editor
- Select operator from dropdown
- Autocomplete for tag name
- Delete button

**Adding a tag:**
- Click [+] to add new tag chip in edit mode
- Same operator dropdown + autocomplete

#### Variables Editor

Collapsed summary view showing variable names and preview of values.

**Editing a variable:**
- Click [Edit] to expand inline editor
- Array of strings: Editable list with add/remove
- Array of objects: Table or JSON editor for complex structures
- Support for gendered NPC objects (name, gender, occupation fields)

**Variable definition popup:**
- Triggered when clicking `{{variable}}` placeholder in text
- Shows/edits the definition for that variable
- Creates new variable if clicking undefined placeholder

#### Text Editor

- Multiline textarea
- Syntax highlighting for `{{variable}}` and `{{variable.property}}` placeholders
- Clicking a placeholder:
  - If defined: Opens variable editor focused on that variable
  - If undefined: Prompts to create variable definition
- Preview panel (optional): Shows rendered text with one random variable substitution

#### Options Editor

Compact list view with expand-to-edit:

**Compact display per option:**
- Label text (truncated if long)
- Target indicator: `→ step_id` or `→ (end)`
- Skill badge if present: `[Might 5]`, `[Guile 8]`
- Hidden indicator if present: `[👁 Hidden]`
- Drag handle for reordering
- Edit button to expand

**Expanded option editor:**

```
┌─────────────────────────────────────────────────────────────┐
│  Label: [Confront them directly                        ]    │
│                                                             │
│  Target:  ○ Step: [confront_step    ▼]                      │
│           ○ End interaction                                 │
│                                                             │
│  Required Tags: [inv:evidence] [ally:guard]  [+]            │
│  (option only appears/enabled if player has these)          │
│                                                             │
│  □ Hidden (only show when requirements met)                 │
│                                                             │
│  ─── Skill Check (optional) ───                             │
│  Skill: [None ▼]  /  [Might ▼] [Guile ▼] [Magic ▼]         │
│  DC: [5]                                                    │
│  Fail Target: [confront_fail ▼]                             │
│                                                             │
│                              [Delete Option] [Collapse ▲]   │
└─────────────────────────────────────────────────────────────┘
```

**Target dropdown:**
- Autocomplete from all step IDs in file
- Option to create new step (adds stub step with that ID)
- Warning indicator if target doesn't exist

### Lint Panel

Collapsed by default; shows summary count. Expandable to show full results.

**Lint triggers:**
- Debounced after edits (e.g., 3 seconds of inactivity)
- Explicit [Run Lint] button

**Lint checks:**

| Check | Severity | Description |
|-------|----------|-------------|
| Broken `pass` target | Error | Option references step ID that doesn't exist in file |
| Broken `fail` target | Error | Skill check failure references nonexistent step |
| Undefined variable | Warning | `{{var}}` used in text but not defined in step's `vars` |
| Unused variable | Info | Variable defined but never referenced in text/tags |
| Dead-end options | Warning | All options require tags/skills with no fallback path |
| Coverage gap | Warning | Location + tag combo has no matching step |
| Ambiguous match | Info | Location + tag combo matches multiple steps |
| Orphan internal step | Warning | Internal step ID never referenced by any option |
| Missing quest gate | Warning | Location step lacks `!quest` or `@q:` tag (might show during wrong quest) |
| Tag typo candidate | Info | Tag similar to but not matching other tags (Levenshtein) |

**Lint result display:**
- Grouped by severity (errors, warnings, info)
- Each result clickable to navigate to the relevant step
- Suppress/acknowledge option for intentional patterns

## Data Model

### Internal Representation

The editor maintains an internal representation that may differ from the YAML structure for editing convenience, but serializes back to valid quest file YAML.

```typescript
interface QuestFile {
  option_presets?: Record<string, OptionDef[]>;
  steps: StepDef[];
}

interface StepDef {
  id: string;
  tags?: string[];
  vars?: Record<string, VarValue>;
  text: string;
  options?: OptionDef[] | string;  // string = preset reference
  log?: string;
}

type VarValue = string[] | VarObject[];

interface VarObject {
  [key: string]: string | number;
  gender?: 'male' | 'female';  // enables virtual pronouns
}

type OptionDef = string | OptionObject;

interface OptionObject {
  label: string;
  tags?: string[];
  skill?: 'might' | 'guile' | 'magic';
  dc?: number;
  pass?: string | null;
  fail?: string;
  hidden?: boolean;
}
```

### Tag Parsing

Tags in the `tags` array are parsed to extract operator and tag name:

```typescript
interface ParsedTag {
  operator: '@' | '!' | '+' | '-' | '';  // '' = bare (require)
  tag: string;
}

function parseTag(raw: string): ParsedTag {
  if (raw.startsWith('@')) return { operator: '@', tag: raw.slice(1) };
  if (raw.startsWith('!')) return { operator: '!', tag: raw.slice(1) };
  if (raw.startsWith('+')) return { operator: '+', tag: raw.slice(1) };
  if (raw.startsWith('-')) return { operator: '-', tag: raw.slice(1) };
  return { operator: '', tag: raw };
}
```

### Step Matching Algorithm

Given a location and tag set, find matching steps:

```typescript
function findMatchingSteps(
  steps: StepDef[], 
  location: string, 
  activeTags: Set<string>
): StepDef[] {
  return steps.filter(step => {
    // Must match location
    if (step.id !== location) return false;
    
    // Check all tag conditions
    for (const rawTag of step.tags ?? []) {
      const { operator, tag } = parseTag(rawTag);
      
      // @ or bare: require tag
      if (operator === '@' || operator === '') {
        if (!activeTags.has(tag)) return false;
      }
      // !: forbid tag
      else if (operator === '!') {
        if (activeTags.has(tag)) return false;
      }
      // + and - are mutations, not conditions (ignore for matching)
    }
    
    return true;
  });
}
```

### Coverage Matrix Generation

```typescript
interface CoverageRow {
  tagValues: Record<string, boolean | null>;  // null = don't care
  matches: string[];  // step IDs
  status: 'single' | 'none' | 'ambiguous' | 'default';
}

function generateCoverageMatrix(
  steps: StepDef[],
  location: string,
  defaultSteps: StepDef[]  // from default-locations.json
): CoverageRow[] {
  // 1. Collect all tags referenced in conditions for this location
  const relevantTags = collectRelevantTags(steps, location);
  
  // 2. Generate tag combinations (pruning impossible ones)
  const combinations = generateCombinations(relevantTags);
  
  // 3. For each combination, find matches
  return combinations.map(combo => {
    const tagSet = new Set(
      Object.entries(combo)
        .filter(([_, v]) => v === true)
        .map(([k, _]) => k)
    );
    
    const matches = findMatchingSteps(steps, location, tagSet);
    const defaultMatches = findMatchingSteps(defaultSteps, location, tagSet);
    
    let status: CoverageRow['status'];
    if (matches.length === 1) status = 'single';
    else if (matches.length > 1) status = 'ambiguous';
    else if (defaultMatches.length > 0) status = 'default';
    else status = 'none';
    
    return {
      tagValues: combo,
      matches: matches.map(s => s.id),
      status
    };
  });
}
```

## File Format

### YAML Structure

The editor reads and writes YAML matching the existing JSON schema:

```yaml
option_presets:
  market_nav:
    - "Browse other stalls::market_main"
    - "Leave the market"

steps:
  - id: Tavern
    tags:
      - "!quest"
      - "!done:mystery"
    vars:
      drunk:
        - Olaf
        - Willem
        - Bertram
    text: >
      {{drunk}} slams his mug on the table and glares at you.
    options:
      - "What's your problem?::confront_drunk"
      - "Ignore him"
    log: Encountered a belligerent drunk at the tavern

  - id: confront_drunk
    tags:
      - "+quest"
      - "+q:tavern_brawl"
    text: >
      {{drunk}} stands, knocking over his chair. "You got a 
      problem with me, stranger?"
    options:
      - label: "Back down"
        pass: back_down
      - label: "Stand your ground"
        skill: might
        dc: 4
        pass: win_confrontation
        fail: lose_confrontation
```

### YAML Formatting Preferences

When serializing:
- Use block scalars (`>` or `|`) for multiline text
- Use flow sequences for simple string arrays (vars with string values)
- Use block sequences for complex arrays (options with objects)
- Preserve comments if possible (js-yaml doesn't; consider alternatives)
- 2-space indentation

## Project Context

### Loading Context Files

The editor can optionally load supporting files for enhanced functionality:

| File | Purpose |
|------|---------|
| `_locations.json` | Populates location dropdown; validates location IDs |
| `_config.json` | Reference for stat modifiers; not edited |
| `default-locations.json` | Coverage matrix default fallback detection |
| Other `*.yaml` / `*.json` | Cross-file tag autocomplete; cross-reference validation |

**Loading:**
- Settings panel allows selecting a project directory
- Or load files individually via file picker
- Context is read-only; editor only modifies the active quest file

### Cross-File Features

When project context is loaded:

**Tag autocomplete:**
- Suggests tags from all loaded files
- Groups by source file
- Highlights tags from current file vs. external

**Target validation:**
- Warning (not error) if `pass` target exists in another file
- Lint can report "target not in file but exists in project" as info

**Coverage defaults:**
- Coverage matrix shows `(default)` status when default-locations.json would handle a combination

## Implementation Notes

### File System Access

For browsers supporting File System Access API:
- Request file handle on open
- Write directly to file on save
- Handle permission errors gracefully

Fallback:
- Download file on save
- User manually replaces source file

### YAML Library

Consider:
- `js-yaml`: Common, but doesn't preserve comments
- `yaml`: Preserves comments via CST, more complex API

If comment preservation is valuable for hand-edited files, invest in the more complex library.

### Syntax Highlighting

For variable placeholders in text:
- Simple regex-based highlighting: `/\{\{[\w.]+\}\}/g`
- Could use a contenteditable div with span wrapping
- Or a textarea with overlay positioning
- Or a proper code editor component (Monaco, CodeMirror) with custom mode

### Debounced Lint

```typescript
const LINT_DEBOUNCE_MS = 3000;
let lintTimeout: number | null = null;

function scheduleLib() {
  if (lintTimeout) clearTimeout(lintTimeout);
  lintTimeout = setTimeout(runLint, LINT_DEBOUNCE_MS);
}

// Call scheduleLint() on every edit
```

## Future Considerations

Features explicitly deferred from initial implementation:

- **State simulator / playthrough mode:** Set tags, click options, see resulting state changes
- **Graph visualization:** Node-edge view of step relationships
- **Diff view:** Compare current state to saved file
- **Multi-file editing:** Tabs or split view for multiple quest files
- **Undo/redo:** Beyond browser's textarea undo
- **Collaborative editing:** Real-time sync (unnecessary for solo use)
- **Build integration:** Trigger quest merge from editor

These can be added if the core editor proves valuable.

## Success Criteria

The editor is successful if it:

1. Reduces time to author a new quest compared to raw YAML editing
2. Catches coverage gaps and broken references before playtesting
3. Makes tag state reasoning explicit rather than mental simulation
4. Doesn't corrupt quest files or lose work
5. Feels faster than switching between text editor and game for testing

## Appendix: Tag Prefix Reference

| Prefix | Purpose | Display Location | Auto-clear |
|--------|---------|------------------|------------|
| *(none)* | System tags | Hidden | No |
| `q:` | Quest-scoped state | Hidden | Yes (on `-quest`) |
| `done:` | Completed quests | Achievements | No |
| `inv:` | Inventory items | Inventory UI | No |
| `status:` | Conditions | Character sheet | No |
| `trait:` | Character qualities | Character sheet | No |
| `ally:` | Faction relationships | Character sheet | No |
| `know:` | Learned information | Hidden | No |

## Appendix: Option Shorthand Reference

| Format | Expansion |
|--------|-----------|
| `"Label::step_id"` | `{label: "Label", tags: [], pass: "step_id"}` |
| `"Label"` | `{label: "Label", tags: [], pass: null}` |
| `{...object...}` | Used as-is |
| `"preset_name"` (as entire options value) | Expanded from `option_presets` |
