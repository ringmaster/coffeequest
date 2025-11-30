# Step Patches Implementation Guide

## Overview

This document provides implementation guidance for the step patches feature. Step patches allow quest files to conditionally augment steps defined in other files at runtime.

## Reference Documentation

Before implementing, read these sections:

1. **`specifications/quest-editor-spec.md`** — "Step Patches" section contains:
   - Complete syntax specification
   - Field merge semantics
   - Text modification modes (prepend/append/replace)
   - Data model (`StepPatch`, `TextModification` interfaces)
   - Runtime application algorithm (`applyPatches` function)
   - Build vs. runtime responsibilities

2. **`specifications/quest-authoring-guide.md`** — "Step Patches" section in Cross-Quest Integration contains:
   - Authoring perspective and use cases
   - When to use patches vs. hidden options

## Implementation Tasks

### 1. Build Step Changes (`scripts/merge-quests.js`)

The build step needs to:

- **Identify patches:** Steps where `id.startsWith('@patch:')`
- **Separate patches from regular steps:** Don't mix them in the main steps array
- **Validate patch targets:** Warn if `@patch:xxx` targets a step ID that doesn't exist
- **Validate patch-to-patch:** Error if a patch targets another patch
- **Output format:** Include patches as a separate `patches` array in `steps.json`:

```json
{
  "config": { ... },
  "steps": [ ... ],
  "patches": [
    {
      "target": "baker_buy",
      "tags": ["@q:flour_mystery"],
      "text": { "append": " She looks worried." },
      "options": [ ... ]
    }
  ]
}
```

### 2. Engine Changes (step selection and display)

The game engine needs to:

- **Build a patch index on load:**
  ```typescript
  const patchIndex: Map<string, StepPatch[]> = new Map();
  for (const patch of data.patches) {
    const existing = patchIndex.get(patch.target) ?? [];
    existing.push(patch);
    patchIndex.set(patch.target, existing);
  }
  ```

- **After selecting a base step, apply patches:**
  ```typescript
  function getDisplayStep(baseStep: Step, playerTags: Set<string>): Step {
    const patches = patchIndex.get(baseStep.id) ?? [];
    return applyPatches(baseStep, patches, playerTags);
  }
  ```

- **Implement `applyPatches`:** See `quest-editor-spec.md` for the full algorithm. Key points:
  - Filter patches by evaluating their tag conditions
  - Accumulate text modifications (prepends, appends, replacement)
  - Append options from all matching patches
  - Merge vars (patch overrides base on conflict)

- **Text modification application order:**
  1. All `prepend` values joined (in patch order)
  2. Base step text
  3. All `append` values joined (in patch order)
  4. If any `replace` exists, it overrides everything (last one wins)

### 3. Tag Condition Evaluation

Patch `tags` arrays use only condition operators:
- `@tag` or bare `tag` — require tag
- `!tag` — forbid tag

Mutation operators (`+tag`, `-tag`) are **not valid** on patches and should be ignored or warned.

```typescript
function evaluatePatchConditions(patchTags: string[], playerTags: Set<string>): boolean {
  for (const rawTag of patchTags) {
    if (rawTag.startsWith('+') || rawTag.startsWith('-')) {
      // Invalid on patches — ignore or warn
      continue;
    }
    
    const { operator, tag } = parseTag(rawTag);
    
    if (operator === '!' && playerTags.has(tag)) return false;
    if ((operator === '@' || operator === '') && !playerTags.has(tag)) return false;
  }
  return true;
}
```

### 4. Text Field Handling

The `text` field on patches is an object, not a string:

```typescript
interface TextModification {
  prepend?: string;
  append?: string;
  replace?: string;
}

// In patch definition
interface StepPatch {
  target: string;
  tags?: string[];
  text?: TextModification;  // Note: object, not string
  options?: OptionDef[];
  vars?: Record<string, VarValue>;
}
```

When applying:
```typescript
function applyTextModifications(
  baseText: string,
  patches: StepPatch[]
): string {
  const prepends: string[] = [];
  const appends: string[] = [];
  let replacement: string | null = null;
  
  for (const patch of patches) {
    if (patch.text?.prepend) prepends.push(patch.text.prepend);
    if (patch.text?.append) appends.push(patch.text.append);
    if (patch.text?.replace) replacement = patch.text.replace;
  }
  
  if (replacement !== null) {
    return replacement;
  }
  
  return prepends.join('') + baseText + appends.join('');
}
```

### 5. Variable Substitution in Patches

Patches can reference variables from the base step. Variable substitution should happen **after** patch application, on the composed step.

If a patch defines its own `vars`, they merge with the base step's vars (patch values override on name conflict).

## Testing Scenarios

1. **Basic patch:** Single patch adds an option to a step
2. **Conditional patch:** Patch only applies when player has specific tag
3. **Multiple patches:** Two patches target same step, both apply
4. **Text append:** Patch adds text to end of base step text
5. **Text prepend:** Patch adds text to beginning
6. **Text replace:** Patch completely replaces text
7. **Mixed text mods:** Multiple patches with different text modifications
8. **Patch with vars:** Patch adds/overrides variables
9. **Patch target missing:** Build warns about nonexistent target
10. **Patch targets patch:** Build errors on `@patch:@patch:xxx`
11. **No matching patches:** Step displays normally when no patches apply

## File Locations

- Build script: `scripts/merge-quests.js`
- Engine: `src/lib/` (wherever step selection logic lives)
- Output: `static/steps.json`
- Quest files: `quests/*.json` or `quests/*.yaml`
