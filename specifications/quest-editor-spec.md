# Coffee Quest: Visual Quest Editor Specification

## Overview

A browser-based visual editor for authoring and editing quest step files. The editor provides tag-state-driven navigation, step editing forms, coverage analysis, state simulation, and validation — tools that address pain points in raw YAML editing that syntax highlighting alone cannot solve.

**Target users:** Solo developer and any ambitious contributors.

**File format:** Edits YAML source files directly. The existing build process compiles YAML/JSON quest files into the consolidated `steps.json`.

## Core Concepts

### Tag State as Navigation

The editor's primary navigation model is "what would a player with these tags see at this location?" Rather than scrolling through a list of steps, the author sets a hypothetical tag state and location, and the editor shows which step(s) match.

### Coverage Analysis

The editor can reveal gaps in step coverage — combinations of location + tags that have no matching step, or that match multiple steps ambiguously.

### State Simulation

A side panel lets you "play through" quest paths, tracking tag mutations and showing which steps become reachable. This changes authoring from write-then-test to interactive exploration of quest logic.

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

Three-panel layout: step list (left), step editor (center), simulator (right, collapsible).

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  [Open File] [Save] [Download]              Coffee Quest Editor           [▶ Sim] [⚙] │
├─────────────────────────┬────────────────────────────────────────┬───────────────────┤
│  Step List              │  Step Editor                           │  Simulator        │
│  [Search: _______]      │                                        │  (collapsible)    │
│                         │  ┌─ baker_buy ─────────────────────┐   │                   │
│  ▼ Market (12 steps)    │  │                                 │   │  Location: [▼]    │
│    📍 Market            │  │  ID: [baker_buy]                │   │                   │
│      ➔ stall_general    │  │                                 │   │  Tags:            │
│        ➔ stall_rope     │  │  Tags: [quest] [+]              │   │  [quest]          │
│          ➔ buy_rope     │  │                                 │   │  [q:flour]        │
│          ➔ haggle_rope  │  │  Text:                          │   │                   │
│        ➔ stall_fruit    │  │  ┌─────────────────────────┐    │   │  Step: baker_buy  │
│          ➔ buy_orange   │  │  │ She wipes her hands...  │    │   │  "She wipes..."   │
│                         │  │  └─────────────────────────┘    │   │                   │
│  ▼ Bakery (4 steps)     │  │                                 │   │  Options:         │
│    📍 Bakery            │  │  Options:                       │   │  ○ Buy bread      │
│      ➔ baker_buy  ←     │  │  1. "Buy bread" → buy_bread    │   │  ○ Buy pastry     │
│        ➔ buy_bread      │  │  2. "Buy pastry" → buy_pastry  │   │  ○ Leave          │
│        ➔ buy_pastry     │  │  3. "Leave" → (end)            │   │                   │
│                         │  │                                 │   │  History:         │
│  ▼ Orphaned (0)         │  │  Log: [________________]        │   │  1. Market →      │
│                         │  │                                 │   │  2. Bakery →      │
│  ▼ Patches (1)          │  │                    [Delete]     │   │                   │
│    🩹 @patch:baker_buy  │  └─────────────────────────────────┘   │  [Reset] [Back]   │
├─────────────────────────┴────────────────────────────────────────┴───────────────────┤
│  Lint: ✓ No issues  /  ⚠ 3 warnings  [Run Lint]                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

**Panel behavior:**
- Step List is always visible (left panel)
- Step Editor shows the currently selected step (center panel)
- Simulator is collapsible via [▶ Sim] toggle (right panel)
- Lint panel is collapsible at bottom

### Header Bar

- **Open File:** File picker or drag-drop zone
- **Save:** Write to source file (if available) or prompt download
- **Download:** Always available; downloads current state as YAML
- **Settings (⚙):** Load project context files, configure lint rules
- **Simulate (▶):** Open/close simulator panel

### Step List (Left Panel)

The step list displays all steps organized as a graph derived from option targets. This reveals quest flow structure rather than just listing steps sequentially.

#### Layout

```
┌─ Step List ─────────────────────────────────────────────────┐
│ [Search: ________] [Filter by tag ▼]                        │
│                                                             │
│ ▼ Market → stall_general (12 steps)                         │
│   ├─ 📍 Market "The market square hums..."                  │
│   │   └─➔ stall_general "Vendors hawk their wares..."       │
│   │       ├─➔ stall_rope "The rope merchant..."             │
│   │       │   ├─➔ buy_rope "You purchase the rope."         │
│   │       │   └─➔ haggle_rope "You try to negotiate..."     │
│   │       │       ├─➔ haggle_rope_success                   │
│   │       │       └─➔ haggle_rope_fail                      │
│   │       ├─➔ stall_fruit "Oranges and apples..."           │
│   │       │   └─➔ buy_orange                                │
│   │       └─➔ stall_tools "Farming implements..."           │
│   │           └─➔ buy_lockpick [ally:thieves] hidden        │
│                                                             │
│ ▼ Market [quest] → investigate_merchant (6 steps)           │
│   ├─ 📍 Market [quest] "You scan the crowd..."              │
│   │   └─➔ investigate_merchant                              │
│   │       ├─➔ confront_merchant                             │
│   │       │   ├─➔ merchant_confess                          │
│   │       │   └─➔ merchant_deny                             │
│   │       └─➔ search_stall                                  │
│                                                             │
│ ▼ Orphaned (1 step)                                         │
│   └─ ➔ unused_step ⚠️                                       │
│                                                             │
│ ▼ Patches                                                   │
│   └─ 🩹 @patch:stall_general [q:flour_mystery]              │
└─────────────────────────────────────────────────────────────┘
```

#### Graph Construction Algorithm

```typescript
interface StepNode {
  step: StepDef;
  children: StepNode[];  // steps this one can reach via options
  parents: StepNode[];   // steps that can reach this one
}

function buildStepGraph(steps: StepDef[]): Map<string, StepNode> {
  const nodes = new Map<string, StepNode>();
  
  // Create nodes for non-patch steps
  for (const step of steps) {
    if (!step.id.startsWith('@patch:')) {
      nodes.set(step.id, { step, children: [], parents: [] });
    }
  }
  
  // Build edges from options
  for (const step of steps) {
    if (step.id.startsWith('@patch:')) continue;
    
    const node = nodes.get(step.id)!;
    for (const option of expandOptions(step.options)) {
      if (option.pass && nodes.has(option.pass)) {
        const child = nodes.get(option.pass)!;
        node.children.push(child);
        child.parents.push(node);
      }
      if (option.fail && nodes.has(option.fail)) {
        const child = nodes.get(option.fail)!;
        node.children.push(child);
        child.parents.push(node);
      }
    }
  }
  
  return nodes;
}

function findRoots(nodes: Map<string, StepNode>, locations: Set<string>): StepNode[] {
  const roots: StepNode[] = [];
  
  for (const node of nodes.values()) {
    const isLocation = locations.has(node.step.id);
    const noParents = node.parents.length === 0;
    
    if (isLocation || noParents) {
      roots.push(node);
    }
  }
  
  return roots;
}
```

#### Grouping Rules

1. **Patches** — All `@patch:` steps go in a separate "Patches" group at the bottom
2. **Root identification** — A step is a root if:
   - It's a location step (ID matches a known location), OR
   - It has no incoming edges (no options target it)
3. **Tree construction** — From each root, traverse children via option targets to build subtrees
4. **Orphaned steps** — Steps with no parents AND no children go in "Orphaned" group with warning

#### Edge Case Display

**Cycles (back-edges):**
When a step links back to an ancestor, show as a reference rather than nesting:
```
├─➔ haggle_rope_fail
│   └─↩ stall_rope (back)
```

**Multiple parents:**
When a step is reachable from multiple paths, show under primary parent (first encountered) with reference elsewhere:
```
├─➔ buy_rope
│   └─➔ purchase_complete
├─➔ buy_orange  
│   └─↗ purchase_complete (see above)
```

**Cross-location references:**
When an option targets a step in a different location group:
```
└─➔ recommend_baker → baker_buy (external)
```

#### Step Display Format

Each step in the tree shows:
- **Icon:** 📍 for location steps, ➔ for internal steps, 🩹 for patches, ⚠️ for orphaned
- **ID:** Step ID (or location name for location steps)
- **Tags preview:** Key tags in brackets, e.g., `[quest]`, `[!done:baker]`
- **Text preview:** First ~40 characters of step text, truncated with ellipsis

#### Interactions

- **Click step:** Select for editing in main panel
- **Expand/collapse:** Toggle subtree visibility (▼/▶)
- **Search:** Filter tree to steps matching ID or text content
- **Filter by tag:** Show only steps with specific tag conditions
- **Click back-reference:** Jump to the referenced step

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

## State Simulator

A side panel that lets you "play through" quest paths, tracking tag mutations and showing which steps become reachable. This changes authoring from write-then-test to interactive exploration of quest logic.

### Layout

The simulator appears as a collapsible right panel alongside the main editor:

```
┌─────────────────────────────────────────────┬──────────────────────────────┐
│  (main editor layout)                       │  ▶ Simulator           [✕]  │
│                                             │                              │
│  Location: [Town Square]                    │  Location: Tavern    [▼]    │
│  Active Tags: [quest] [q:mystery]           │                              │
│                                             │  Tag State:                  │
│  ┌─ Matching Step ──────────────────────┐   │  ┌────────────────────────┐  │
│  │                                      │   │  │ quest                  │  │
│  │  (step editor form)                  │   │  │ q:mystery              │  │
│  │                                      │   │  │ q:talked_to_barkeep    │  │
│  │                                      │   │  │ inv:silver ×2          │  │
│  └──────────────────────────────────────┘   │  └────────────────────────┘  │
│                                             │                              │
│                                             │  Step: barkeep_hint          │
│                                             │  ┌────────────────────────┐  │
│                                             │  │ "The barkeep leans     │  │
│                                             │  │ in close..."           │  │
│                                             │  └────────────────────────┘  │
│                                             │                              │
│                                             │  Options:                    │
│                                             │  ┌────────────────────────┐  │
│                                             │  │ ○ "Ask about noise"    │  │
│                                             │  │   → ask_noise          │  │
│                                             │  │   +q:asked_noise       │  │
│                                             │  │                        │  │
│                                             │  │ ○ "Bribe him"          │  │
│                                             │  │   requires: inv:silver │  │
│                                             │  │   → bribe_barkeep      │  │
│                                             │  │   -inv:silver          │  │
│                                             │  │   +q:bribed            │  │
│                                             │  │                        │  │
│                                             │  │ ○ "Leave"              │  │
│                                             │  │   → (end) [Location ▼] │  │
│                                             │  └────────────────────────┘  │
│                                             │                              │
│                                             │  History:                    │
│                                             │  ┌────────────────────────┐  │
│                                             │  │ 1. Tavern: initiation  │  │
│                                             │  │    +quest, +q:mystery  │  │
│                                             │  │ 2. Market: buy_rope    │  │
│                                             │  │    -inv:silver, +inv:… │  │
│                                             │  │ 3. Tavern: barkeep_hin…│  │
│                                             │  │    (current)           │  │
│                                             │  └────────────────────────┘  │
│                                             │                              │
│                                             │  [Reset] [← Back] [Export]   │
└─────────────────────────────────────────────┴──────────────────────────────┘
```

### Starting a Simulation

**Entry points:**
- Click [▶ Simulate] button in header to open panel
- Panel initializes with current Active Tags from the editor
- Or start fresh with empty/minimal tag state

**Initial state:**
- Location defaults to first location-step in file, or selectable via dropdown
- Tag state copied from editor's Active Tags selector
- History is empty

### Option Display

Each option shows:
- Label text
- Target step (or "end interaction")
- Tag requirements (with ✓/✗ indicating if currently satisfied)
- Tag mutations that will occur (+/- tags)
- Skill check details if applicable

**Option states:**
- **Available:** Requirements met, clickable
- **Unavailable:** Requirements not met, dimmed, shows what's missing
- **Hidden:** Has `hidden: true` and requirements not met — not shown at all

```
┌─────────────────────────────────────────────────────────────────────┐
│ ○ "Bribe him" (1 silver)                                            │
│   requires: [inv:silver] ✓                                          │
│   → bribe_barkeep                                                   │
│   mutations: [-inv:silver] [+q:bribed_barkeep]                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ ○ "Use your guild contacts"                              [Hidden]   │
│   requires: [ally:thieves_guild] ✗                                  │
│   (option would not appear in game)                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Skill Check Handling

Skill checks show both outcomes with a toggle to choose which path to follow:

```
┌─────────────────────────────────────────────────────────────────────┐
│ ○ "Pick the lock"                                        [Guile: 6] │
│                                                                     │
│   Pass → lock_opened                                                │
│     mutations: [+q:lock_picked]                                     │
│                                                                     │
│   Fail → lock_jammed                                                │
│     mutations: [+q:lock_broken] [+status:wanted]                    │
│                                                                     │
│   Choose outcome:  (● Pass)  (○ Fail)                               │
└─────────────────────────────────────────────────────────────────────┘
```

Clicking the option follows the selected outcome path.

### End Interaction Handling

When an option has `pass: null` (ends interaction):

```
┌─────────────────────────────────────────────────────────────────────┐
│ ○ "Leave"                                                           │
│   → (end interaction)                                               │
│   Next location: [▼ Select location]                                │
│                  ├─ Town Square                                     │
│                  ├─ Market                                          │
│                  ├─ Guardhouse                                      │
│                  └─ ...                                             │
└─────────────────────────────────────────────────────────────────────┘
```

Selecting a location continues the simulation there, finding the matching step for the current tag state.

### Taking an Action

When the user clicks an available option:

1. **Record history entry** for current step + chosen option
2. **Apply tag mutations** from the target step's `tags` array:
   - `+tag` → add to state
   - `-tag` → remove from state
   - `-quest` → also clear all `q:` prefixed tags
3. **Resolve variables** if the target step has `vars` (pick random values, store for session)
4. **Navigate to target step** or prompt for location if ending interaction
5. **Find matching step** at new location given updated tag state
6. **Display new step** with its options

### No Matching Step

If the tag state + location has no matching step:

```
┌────────────────────────────────────────────┐
│ ⚠ No step matches at Guardhouse            │
│                                            │
│ Tag state:                                 │
│   quest, q:mystery, q:bribed_barkeep       │
│                                            │
│ This is a coverage gap.                    │
│ [Create step for this state]               │
│ [Choose different location]                │
└────────────────────────────────────────────┘
```

This surfaces coverage gaps during authoring rather than playtesting.

### History Panel

Scrollable list of steps taken:

```
┌────────────────────────────────────────────┐
│ History:                                   │
├────────────────────────────────────────────┤
│ 1. Tavern: initiation              [Jump]  │
│    → "Accept the quest"                    │
│    +quest, +q:mystery                      │
│                                            │
│ 2. Market: market_main             [Jump]  │
│    → "Buy rope (1 silver)"                 │
│    -inv:silver, +inv:rope                  │
│                                            │
│ 3. Tavern: barkeep_hint            [Jump]  │
│    (current)                               │
└────────────────────────────────────────────┘
```

**Interactions:**
- Click [Jump] to rewind simulation to that point (restores tag state as it was after that step)
- History entries after the jump point are preserved but grayed out (can re-advance or take different path)

### Controls

| Control | Action |
|---------|--------|
| [Reset] | Clear history, restore initial tag state |
| [← Back] | Undo last action, restore previous state |
| [Export] | Copy simulation path as YAML (for documentation or test cases) |
| [Edit Step] | Jump editor to currently displayed step |
| Location [▼] | Change location without taking an option (for testing arrival at different locations) |

### Editor Integration

**Bidirectional sync:**
- Clicking a step ID in simulator scrolls/focuses the editor to that step
- [Edit Step] button opens current simulator step in the editor
- Edits in the editor immediately reflect in simulator (if viewing that step)

**Tag state sync (optional):**
- Button to copy simulator's current tag state to editor's Active Tags
- Useful for: "I've simulated to this point, now let me see coverage matrix for this state"

### Export Format

Exporting produces a YAML document describing the path taken:

```yaml
# Quest path export
# Generated: 2025-01-15T10:30:00Z
# File: scarecrows-watch.yaml

initial_tags: []

path:
  - location: Farmhouse
    step: initiation
    option: "I'll look into it"
    tags_added: [quest, q:scarecrows_watch, q:entity_spirit]
    tags_removed: []
    tags_after: [quest, q:scarecrows_watch, q:entity_spirit]

  - location: Field
    step: field_investigation
    option: "Examine the scarecrow"
    tags_added: [q:investigated]
    tags_removed: []
    tags_after: [quest, q:scarecrows_watch, q:entity_spirit, q:investigated]

  - location: Farmhouse
    step: farmer_debrief
    option: "Tell them everything"
    skill_check: null
    tags_added: [q:talked_farmer_after]
    tags_removed: []
    tags_after: [quest, q:scarecrows_watch, q:entity_spirit, q:investigated, q:talked_farmer_after]

final_tags:
  - quest
  - q:scarecrows_watch
  - q:entity_spirit
  - q:investigated
  - q:talked_farmer_after
```

This serves as documentation for quest paths and could feed into automated testing.

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

### Simulator State

```typescript
interface SimulatorState {
  active: boolean;
  location: string;
  tags: Set<string>;
  variables: Record<string, any>;  // resolved variable values
  history: HistoryEntry[];
  historyIndex: number;  // for rewind/forward
}

interface HistoryEntry {
  location: string;
  stepId: string;
  optionLabel: string;
  optionTarget: string | null;
  skillCheck?: { skill: string; dc: number; outcome: 'pass' | 'fail' };
  tagsBefore: string[];
  tagsAfter: string[];
  tagsAdded: string[];
  tagsRemoved: string[];
}
```

### Simulator Tag Mutation Logic

```typescript
function applyStepTags(state: SimulatorState, step: StepDef): void {
  for (const rawTag of step.tags ?? []) {
    const { operator, tag } = parseTag(rawTag);
    
    if (operator === '+') {
      state.tags.add(tag);
    } else if (operator === '-') {
      state.tags.delete(tag);
      // Special case: -quest clears all q: tags
      if (tag === 'quest') {
        for (const t of [...state.tags]) {
          if (t.startsWith('q:')) state.tags.delete(t);
        }
      }
    }
    // @ and ! are conditions, not mutations — ignore here
  }
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

## Step Patches

Step patches allow one quest file to conditionally augment steps defined in another file. This enables cross-quest integration without modifying the original quest file.

### Syntax

A patch is a step entry with an `id` prefixed by `@patch:`:

```yaml
steps:
  # Regular step (in baker-quest.yaml)
  - id: baker_buy
    tags: ["quest"]
    text: "The baker gestures to her wares. \"What'll it be?\""
    options:
      - "Buy bread (1 silver)::buy_bread"
      - "Buy pastry (2 silver)::buy_pastry"
      - "Leave"

  # Patch (in flour-mystery.yaml)
  - id: "@patch:baker_buy"
    tags: ["@q:flour_mystery"]
    text:
      append: " She keeps glancing nervously at the empty shelves behind her."
    options:
      - label: "Ask about the flour shortage"
        pass: baker_flour_hint
        hidden: true
```

### Patch Behavior

Patches are **evaluated at runtime**, not merged at build time. This allows patches to be conditional based on the player's current tag state.

**Evaluation order:**
1. Engine selects the base step for the current location + tag state
2. Engine finds all patches targeting that step's ID
3. For each patch, evaluate its tag conditions against player state
4. Apply matching patches in file-processing order

**Tag conditions on patches:**
- `@tag` — Patch only applies if player has this tag
- `!tag` — Patch only applies if player lacks this tag
- `+tag` / `-tag` — Not valid on patches (patches don't mutate tags directly)

### Field Merge Semantics

| Field | Merge Behavior |
|-------|----------------|
| `tags` | Conditions for patch application (not merged into base step) |
| `text` | See Text Modifications below |
| `options` | Appended to base step's options array |
| `vars` | Merged with base step's vars (patch vars override on conflict) |
| `log` | Ignored (patches cannot modify log entries) |

### Text Modifications

The `text` field on a patch uses an object syntax to specify how to modify the base step's text:

```yaml
# Append text to the end
- id: "@patch:baker_buy"
  tags: ["@q:flour_mystery"]
  text:
    append: " She keeps glancing at the empty shelves."

# Prepend text to the beginning
- id: "@patch:market_main"
  tags: ["@q:festival_day"]
  text:
    prepend: "Colorful banners flutter overhead. "

# Replace text entirely (use sparingly)
- id: "@patch:baker_buy"
  tags: ["@status:baker_angry"]
  text:
    replace: "The baker glares at you. \"You've got nerve showing your face here.\""
```

**Multiple patches with text modifications:**
- All `prepend` modifications are applied first (in file order), then the base text, then all `append` modifications (in file order)
- If any patch uses `replace`, it takes precedence and other text modifications are ignored
- If multiple patches use `replace`, the last one wins (file processing order)

### Multiple Patches

Multiple patches can target the same step. They accumulate:

```yaml
# flour-mystery.yaml
- id: "@patch:baker_buy"
  tags: ["@q:flour_mystery"]
  text:
    append: " She looks worried."
  options:
    - label: "Ask about the flour"
      pass: flour_hint
      hidden: true

# herb-errand.yaml  
- id: "@patch:baker_buy"
  tags: ["@q:herb_errand", "@inv:herbs"]
  options:
    - label: "Deliver the herbs"
      pass: deliver_herbs
      hidden: true
```

If a player has both `q:flour_mystery` and `q:herb_errand` + `inv:herbs`, they see:
- Base text + " She looks worried."
- Base options + "Ask about the flour" + "Deliver the herbs"

### Build vs. Runtime

**Build time:**
- Patches are included in the compiled `steps.json` as separate entries
- Build warns if a patch targets a step ID that doesn't exist
- Patches are not merged into their targets

**Runtime:**
- Engine maintains a patch index: `Map<targetStepId, Patch[]>`
- After selecting a base step, engine looks up applicable patches
- Patches with satisfied tag conditions are applied in order
- Final composed step is displayed to player

### Data Model Additions

```typescript
interface StepPatch {
  target: string;  // step ID being patched (extracted from "@patch:xxx")
  tags?: string[];  // conditions for this patch to apply
  text?: TextModification;
  options?: OptionDef[];
  vars?: Record<string, VarValue>;
}

interface TextModification {
  prepend?: string;
  append?: string;
  replace?: string;
}

// Parsing
function isPatch(step: StepDef): boolean {
  return step.id.startsWith('@patch:');
}

function getPatchTarget(step: StepDef): string {
  return step.id.slice('@patch:'.length);
}
```

### Runtime Application

```typescript
function applyPatches(
  baseStep: StepDef,
  patches: StepPatch[],
  playerTags: Set<string>
): StepDef {
  // Filter to applicable patches
  const applicable = patches.filter(p => 
    evaluateTagConditions(p.tags ?? [], playerTags)
  );
  
  if (applicable.length === 0) return baseStep;
  
  // Clone base step
  const result = { ...baseStep };
  
  // Collect text modifications
  const prepends: string[] = [];
  const appends: string[] = [];
  let replacement: string | null = null;
  
  for (const patch of applicable) {
    // Text modifications
    if (patch.text?.prepend) prepends.push(patch.text.prepend);
    if (patch.text?.append) appends.push(patch.text.append);
    if (patch.text?.replace) replacement = patch.text.replace;
    
    // Options: append
    if (patch.options) {
      result.options = [...(result.options ?? []), ...patch.options];
    }
    
    // Vars: merge (patch overrides)
    if (patch.vars) {
      result.vars = { ...result.vars, ...patch.vars };
    }
  }
  
  // Apply text modifications
  if (replacement !== null) {
    result.text = replacement;
  } else {
    result.text = prepends.join('') + result.text + appends.join('');
  }
  
  return result;
}
```

### Editor Support

**Displaying patches:**
- Patch steps shown with distinct icon (🩹 or similar)
- Target step ID displayed prominently
- Editor shows "Patches step: baker_buy" header

**Editing patches:**
- Same form as regular steps, but:
  - ID field shows target selector instead of location dropdown
  - Text field shows prepend/append/replace mode selector
  - Tags are labeled as "Conditions" not "Requirements"

**Viewing patched steps:**
- When viewing a base step, show indicator if patches exist
- "This step has 2 patches" with links to view them
- In simulator, show composed result with patch contributions highlighted

**Lint additions:**

| Check | Severity | Description |
|-------|----------|-------------|
| Patch target not found | Warning | `@patch:xxx` references step ID that doesn't exist in project |
| Patch targets patch | Error | Patches cannot target other patches |
| Unconditional patch | Info | Patch has no tag conditions (always applies) |

### Example: Cross-Quest Integration

**baker-quest.yaml** (base quest):
```yaml
steps:
  - id: Bakery
    tags: ["!quest", "!done:baker_fetch"]
    text: "The baker kneads dough, flour dusting her apron."
    options:
      - "Buy something::baker_buy"
      - "Leave"

  - id: baker_buy
    tags: []
    text: "She wipes her hands. \"Fresh bread, pastries, or perhaps some fruit?\""
    options:
      - "Buy bread (1 silver)::buy_bread"
      - "Buy pastry (2 silver)::buy_pastry" 
      - "Buy orange (1 silver)::buy_orange"
      - "Never mind"
```

**flour-mystery.yaml** (separate quest that patches the baker):
```yaml
steps:
  - id: Bakery
    tags: ["!quest", "!done:flour_mystery", "@done:baker_fetch"]
    text: "The baker waves you over urgently. \"You helped me before—I need your help again.\""
    options:
      - "What's wrong?::flour_quest_intro"
      - "Not now"

  - id: "@patch:baker_buy"
    tags: ["@q:flour_mystery"]
    text:
      append: " The shelves behind her are half-empty."
    options:
      - label: "Ask about the flour shortage"
        pass: flour_shortage_info
        hidden: true

  - id: flour_quest_intro
    tags: ["+quest", "+q:flour_mystery"]
    text: "\"The flour shipments have stopped coming. The mill says they're sending them, but...\""
    log: "The baker asked you to investigate missing flour shipments"
```

Now a player who has `q:flour_mystery` active sees the modified baker_buy step with the extra text and hidden option, without the original baker-quest.yaml being modified.

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

function scheduleLint() {
  if (lintTimeout) clearTimeout(lintTimeout);
  lintTimeout = setTimeout(runLint, LINT_DEBOUNCE_MS);
}

// Call scheduleLint() on every edit
```

### Simulator Variable Resolution

When entering a step with `vars`:
- Pick random values from each variable's array
- Store resolved values in simulator state
- Same variable values persist for the simulation session (matching game behavior)
- Reset clears variable state

## Future Considerations

Features explicitly deferred from initial implementation:

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
4. Surfaces coverage gaps during authoring via the simulator
5. Doesn't corrupt quest files or lose work
6. Feels faster than switching between text editor and game for testing

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
