# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Coffee Quest** is a mobile-first, single-page static site game that integrates with a physical mug featuring a printed map. Players navigate to locations by entering coordinates, complete steps that modify their tags/state, and progress through emergent narratives driven by a tag-based system.

## Build Commands

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production (static output for GitHub Pages)
npm run build

# Preview production build
npm run preview

# Type checking
npm run check

# Lint
npm run lint
```

## Architecture

### Core Game Mechanics

- **Tag System**: Steps use prefixed tags for filtering and state management:
  - `@tag` = required (player must have)
  - `!tag` = blocked (player must not have)
  - `+tag` = grant (add to player on execution)
  - `-tag` = consume (remove from player on execution)
  - `tag` (no prefix) = preferred (scoring boost)

- **Step Selection**: When player enters coordinates, steps are filtered by location → hard filters (required/blocked) → scored by preferred tags → random selection from highest scored

- **Virtual Locations**: Steps with non-coordinate location IDs auto-execute immediately (used for processing choices/skill check results)

### Key Data Structures

- **Character state**: `{ might, guile, magic, stepsCompleted, metadata: string[] }` in localStorage
- **Quest variables**: Global `questVars` object for dynamic text interpolation via `{{variable}}`
- **Steps**: Defined in JSON with `id`, `location`, `tags`, `vars`, `text`, `log`, `options`

### State Flow

`NAVIGATION → LOCATION_ENTRY → STEP_SELECTION → DISPLAY_STEP → CHOICE/SKILL_CHECK → (loop or back to NAVIGATION)`

## Project Philosophy

This project prioritizes **developer autonomy** over framework magic. We choose tools that enhance productivity without imposing rigid patterns or hiding important details.

## Core Principles

### 1. Explicit over Implicit
- Prefer clear, readable code over clever abstractions

### 2. Libraries vs Custom Code
- **Libraries are preferred** when they tangibly simplify the application
- Libraries must not over-complicate maintenance (**primary directive: human-readable, human-maintainable code**)
- Choose well-maintained libraries with good documentation
- Avoid libraries that add complexity without clear value

### 3. Build Quality
- **Remove all warnings and errors** before calling any feature complete
- Zero tolerance for build warnings in production code
- Address TypeScript errors immediately, don't suppress them

### 4. Schema as Code
- This project does not use a database

### 5. Real-time First
- This project does not use real-time features

## Technology Choices

- This is a single-page application 
- This application runs from a static host (likely GitHub Pages)
- There is no server component.

### Framework: Svelte 5 + SvelteKit
- **Why**: Minimal runtime, excellent developer experience

#### Critical Svelte 5 Requirements

**MANDATORY: Write all Svelte components in Runes mode** - This is vital for error-free code
- Use `$state()`, `$derived()`, `$props()`, `$effect()` instead of legacy reactive declarations
- Use `let { prop1, prop2 } = $props()` for component props
- Use `let variable = $state(initialValue)` for reactive state
- Use `let computed = $derived(expression)` for computed values
- **Never mix runes with legacy Svelte syntax** - causes compilation errors

**CRITICAL $derived SYNTAX** - This is a recurring mistake:
- Use `$derived(expression)` for simple expressions: `let doubled = $derived(count * 2)`
- Use `$derived.by(() => {...})` for complex logic with function body: `let filtered = $derived.by(() => { return items.filter(...); })`
- **NEVER use `$derived(() => {...})`** - This creates a function, not a value, causing "X is not a function" errors

Example:
```svelte
<script lang="ts">
  // Correct - Runes mode
  let count = $state(0);
  let doubled = $derived(count * 2);
  let { user } = $props();

  // Correct - $derived.by for complex logic
  let filteredItems = $derived.by(() => {
    if (!config) return items;
    return items.filter(item => item.active);
  });

  // Wrong - Legacy mode (DO NOT USE)
  // export let user;
  // let count = 0;
  // $: doubled = count * 2;

  // Wrong - $derived with arrow function (DO NOT USE)
  // let filteredItems = $derived(() => {
  //   return items.filter(item => item.active);
  // });
</script>
```

**ALWAYS add `key` attributes to `{#each}` blocks** - Use unique identifiers (user.id, card.id, etc.) to prevent rendering issues
```svelte
{#each users as user (user.id)}
  <!-- content -->
{/each}
```

**Implement proper ARIA attributes** for accessibility:
- Add `aria-label` to all buttons that need context (especially icon-only or action buttons)
- Use `role` attributes for custom interactive elements
- Include `aria-disabled` for disabled states
- Add `aria-live` regions for dynamic content updates
- Use semantic HTML (`<button>`, `<nav>`, `<main>`) instead of `<div>` with roles where possible

**Avoid unused CSS rules** - Only define CSS classes that are actually used in the component
- Remove or comment out unused selectors before committing
- Use CSS variables for values that might be needed across components
- Move reusable styles to global stylesheets or mixins

### Style Management: Custom Design System
- **Why**: Full control over UI, no dependency on third-party themes
- **Usage**: Reusable components, consistent styling, responsive design, selector composition with LESS
- **Avoid**: Overly complex CSS frameworks like Tailwind that bloat the codebase
- **Note**: Remove Tailwind-style classes as you go, ensuring that the styles they provided are replaced with custom styles.

## Code Organization

### Directory Structure
```
src/
├── lib/
│   ├── components/       # UI components (CharacterCreation, GameHeader, etc.)
│   ├── game/             # Game engine logic (step selection, skill checks)
│   ├── stores/           # Reactive state management (gameState.svelte.ts)
│   └── types/            # TypeScript type definitions
├── routes/               # SvelteKit routes (single page app)
└── app.html              # Root HTML template
quests/
├── _config.json          # Game config (starting stats, modifiers)
├── merchant-quest.json   # Individual quest files
└── bakery-quest.json     # (merged into static/steps.json on build)
static/
└── steps.json            # GENERATED - do not edit directly
```

### Quest File Format
Quest files in `quests/` are merged automatically during dev and build. Each quest file:
```json
{
  "name": "Quest Name",
  "description": "Quest description",
  "steps": [...]
}
```
The `_config.json` file contains game-wide settings. Files are sorted alphabetically when merged.

### Naming Conventions
- **Files**: kebab-case (`card-editor.svelte`, `user-repository.js`)
- **Components**: PascalCase (`CardEditor`, `UserPresence`)
- **Variables**: camelCase (`boardId`, `currentUser`)
- **Constants**: SCREAMING_SNAKE_CASE (`MAX_CARDS_PER_COLUMN`)
- **Database**: snake_case (`board_id`, `created_at`)

## Quality Standards

### Code Readability - **MUST-HAVE**
- **Code must be manually maintainable** - any developer should be able to understand and modify functionality without extensive research
- **Avoid clever abstractions** that obscure what the code is doing
- **Use descriptive variable and function names** that explain intent
- **Keep functions focused** on single responsibilities
- **Comment complex business logic** but not obvious operations
- **Prefer explicit code** over implicit magic

### Type Safety
- Component props should be fully typed
- Avoid `any` types in production code

## Documentation Strategy - **TOKEN CONSERVATION**

### Three Critical Documentation Files Only
1. **README.md** - User documentation on how to use the application
2. **DEVELOPMENT.md** - Technical implementation decisions and architecture choices for future developers/AI agents
   - Document small but critical decisions that impact future development
   - Include reasoning behind architectural choices, library selections, schema decisions
   - Structure by topic
3. **REVISIT.md** - Tests and documentation items deferred for token conservation but potentially useful later
   - Structure into sections: Tests, Documentation, Features, Performance
   - Include brief rationale for why each item was deferred

### Documentation Rules
- **Create these files as needed** during development when decisions warrant documentation
- **No other documentation files** should exist beyond these three plus inline code comments
- **Single-file consolidation** - don't create new files for each feature
- **Optimize for fewer docs** as a token conservation effort
- **Avoid documentation sprawl** - consolidate related information
- **Additional files as needed**: STYLEGUIDE.md for design system

### Code Comments
- **Inline comments only for complexity** - explain business logic, not obvious operations
- **Focus on why, not what** - document reasoning behind non-obvious implementations
- **Avoid over-commenting** - code should be self-explanatory where possible


This document should be revisited as the project evolves, but these principles should guide architectural decisions throughout development.
