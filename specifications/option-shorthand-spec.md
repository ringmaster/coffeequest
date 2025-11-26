# Coffee Quest: Option Shorthand Syntax

## Overview

Quest step options can be specified in two formats: full object notation (existing) or string shorthand (new). The shorthand reduces verbosity for simple navigation options that don't require tags or skill checks.

## Display Behavior

By default, all options are displayed to the player. Options the player doesn't qualify for (due to tag requirements) appear dimmed and disabled. 

**Hidden options** are an exception: they only appear if the player has qualifying tags. Use hidden for options that would be confusing, spoilery, or narratively inappropriate to show before they're available.

## Syntax

### String Shorthand

```
"Label::step_id"  →  Navigate to step_id
"Label"           →  End interaction (pass: null)
```

Shorthand options are always visible (they have no tag requirements to hide behind).

### Parsing Rules

1. If option is a string containing `::`, split on first `::`:
   - Left side = label
   - Right side = pass target (step_id)
   
2. If option is a string without `::`:
   - Entire string = label
   - pass = null (ends interaction)

3. If option is an object:
   - Parse using existing full object schema
   - `"hidden": true` property controls visibility (requires tags to be meaningful)

### Expansion

| Shorthand | Expands To |
|-----------|------------|
| `"Continue shopping::stall_general"` | `{"label": "Continue shopping", "tags": [], "pass": "stall_general"}` |
| `"Leave the market"` | `{"label": "Leave the market", "tags": [], "pass": null}` |

## Examples

### Before (verbose)

```json
"options": [
  {
    "label": "Continue shopping",
    "tags": [],
    "pass": "stall_general"
  },
  {
    "label": "Leave the market",
    "tags": [],
    "pass": null
  }
]
```

### After (shorthand)

```json
"options": [
  "Continue shopping::stall_general",
  "Leave the market"
]
```

### Mixed Usage

Full objects and shorthand can coexist in the same options array:

```json
"options": [
  {
    "label": "Buy rope (1 silver)",
    "tags": ["silver"],
    "pass": "buy_rope"
  },
  {
    "label": "Try to steal rope",
    "tags": [],
    "skill": "guile",
    "dc": 8,
    "pass": "steal_success",
    "fail": "steal_fail"
  },
  {
    "label": "Ask about the secret stash",
    "tags": ["@thieves_guild"],
    "pass": "secret_stash",
    "hidden": true
  },
  "Browse other stalls::DS",
  "Leave the market"
]
```

## When to Use Hidden

**Use hidden for:**
- Guild/faction-specific options that outsiders shouldn't see
- Secret passages or knowledge-gated paths
- Options that reveal plot information by their mere existence
- Rewards or special interactions earned through prior actions

**Use visible-but-dimmed (default) for:**
- Purchases the player can't afford yet (shows what's available)
- Skill checks they don't qualify for (telegraphs possibilities)
- Paths blocked by missing items (hints at what to find)

## Implementation Notes

- Use `SplitN` with limit 2 to handle labels containing `::`
- Shorthand options always expand to empty `tags` array and are always visible
- Shorthand cannot express skill checks, tag requirements, hidden, or fail states—use full objects for those
- Expansion should happen at parse/load time, not runtime
- Hidden evaluation: if `hidden: true` and tags don't match, option is not rendered at all

## Option Presets

The entire `options` array can be replaced with a string referencing a preset. Presets reduce repetition for common option sets.

### Definition

Presets are defined as special entries in the step array. These entries have an `option_presets` key instead of an `id`:

```json
[
  {
    "option_presets": {
      "market_navigation": [
        "Browse other stalls::DS",
        "Leave the market"
      ]
    }
  },
  {
    "id": "DS",
    "tags": [],
    "text": "The market square hums with commerce...",
    "options": "market_navigation"
  },
  {
    "id": "buy_rope",
    "tags": ["-silver", "+rope"],
    "text": "You tuck the coil of sturdy hemp rope into your pack.",
    "options": "market_navigation"
  }
]
```

### Merging Behavior

During the build step that combines quest files into a single step file, all `option_presets` entries are consolidated into a single `option_presets` element at the top of the compiled file.

**Before build (separate quest files):**

```json
// market.json
[
  {
    "option_presets": {
      "market_navigation": ["Browse other stalls::DS", "Leave the market"]
    }
  },
  { "id": "DS", ... }
]

// tavern.json
[
  {
    "option_presets": {
      "tavern_navigation": ["Return to the bar::tavern_main", "Leave the tavern"]
    }
  },
  { "id": "tavern_main", ... }
]
```

**After build (compiled step file):**

```json
[
  {
    "option_presets": {
      "market_navigation": ["Browse other stalls::DS", "Leave the market"],
      "tavern_navigation": ["Return to the bar::tavern_main", "Leave the tavern"]
    }
  },
  { "id": "DS", ... },
  { "id": "tavern_main", ... }
]
```

If the same preset name appears in multiple quest files, later definitions overwrite earlier ones (last-write-wins based on file processing order).

### Usage

```json
{
  "id": "buy_rope",
  "tags": ["-silver", "+rope"],
  "text": "You tuck the coil of sturdy hemp rope into your pack.",
  "log": "Bought rope",
  "options": "market_navigation"
}
```

Expands to:

```json
{
  "id": "buy_rope",
  "tags": ["-silver", "+rope"],
  "text": "You tuck the coil of sturdy hemp rope into your pack.",
  "log": "Bought rope",
  "options": [
    "Browse other stalls::DS",
    "Leave the market"
  ]
}
```

### Preset Contents

Presets can contain any valid option format (shorthand strings, full objects, or mixed):

```json
{
  "option_presets": {
    "market_navigation": [
      {"label": "Browse other stalls", "tags": ["!banned_from_market"], "pass": "DS"},
      "Leave the market"
    ]
  }
}
```

Presets cannot reference other presets (no nesting).

### Parsing Note

At runtime, the compiled step file has a single `option_presets` entry at the top. Extract it first to build the preset lookup table, then process the remaining entries as steps.
