# Tag Taxonomy Specification

## Overview

Coffee Quest uses a tag-based state system to track player progress, inventory, and character development. This spec introduces a prefix-based taxonomy to organize tags by purpose and enable special behaviors.

## UI Changes

### Toolbar Icons

The toolbar should be updated with two icon buttons:

#### Backpack Icon (Inventory)
- **Icon**: Backpack or bag icon
- **Position**: Toolbar
- **Behavior**: Tapping opens an inventory panel/modal
- **Contents**: 
  - All `inv:` prefixed tags, grouped and counted
  - Display format: "Silver ×3", "Rope ×1", "Orange ×2"
  - Empty state: "Your pack is empty" or similar

#### User Icon (Character Sheet)
- **Icon**: User/person silhouette icon
- **Position**: Toolbar (replaces current inline stats display)
- **Behavior**: Tapping opens a character panel/modal
- **Contents**:
  - **Stats**: Might, Guile, Magic (the existing character stats)
  - **Traits**: All `trait:` prefixed tags (e.g., "Warrior", "Gambler")
  - **Status Effects**: All `status:` prefixed tags (e.g., "Injured", "Poisoned")
  - **Allies/Reputation**: All `ally:` prefixed tags (e.g., "Bookie")

#### Display Formatting
- Strip prefixes before display (`inv:silver` → "Silver")
- Replace underscores with spaces (`health_potion` → "Health Potion")
- Title case each word
- For status effects, consider visual indicators (icons or color coding for negative effects like "Injured")

### Removed Elements
- The current stats display in the toolbar should be removed in favor of the user icon panel

## Tag Prefixes

| Prefix | Purpose | Display | Special Behavior |
|--------|---------|---------|------------------|
| `inv:` | Inventory items | Inventory UI, with stack counts | Countable (e.g., `inv:silver ×3`) |
| `q:` | Quest-scoped state | Hidden | **Auto-cleared when `-quest` is processed** |
| `done:` | Completed quests | Achievements/journal | Prevents quest restart |
| `status:` | Temporary conditions | Status effects area | Cleared only by specific steps |
| `trait:` | Character qualities | Character sheet | Can be gained or lost like any tag |
| `ally:` | Faction relationships | Reputation/standing | May affect prices, unlock hidden options |
| `know:` | Learned information | Hidden unless relevant | Unlocks dialogue options |
| *(none)* | System tags | Hidden | Reserved for `quest` singleton |

## Special Behaviors

### The `quest` Singleton

The unprefixed `quest` tag remains the global lock preventing simultaneous quests:
- `+quest` — Added when player accepts a quest
- `-quest` — Removed when quest completes (success or failure)
- Quest initiation steps should have `"tags": ["!quest"]` to prevent starting while another quest is active

### Auto-clearing `q:` Tags

When the engine processes `-quest`, it must also remove ALL tags with the `q:` prefix. This scopes quest-internal state to the active quest without requiring manual cleanup.

```
// Pseudocode for tag removal
function removeTag(tag) {
  if (tag === "quest") {
    // Remove all q:-prefixed tags
    player.tags = player.tags.filter(t => !t.startsWith("q:"))
  }
  // Normal removal logic
  player.tags = player.tags.filter(t => t !== tag)
}
```

### Inventory Display

Tags prefixed with `inv:` should be:
1. Grouped and counted (multiple `inv:silver` tags display as "Silver ×3")
2. Displayed in an inventory UI section
3. The display name is derived from the tag: `inv:silver` → "Silver", `inv:health_potion` → "Health Potion"

### Status Display

Tags prefixed with `status:` should be:
1. Displayed as active conditions/effects
2. Only removable via explicit `-status:X` in step tags
3. Examples: `status:injured`, `status:poisoned`, `status:blessed`

### Trait Display

Tags prefixed with `trait:` should be:
1. Displayed in a character sheet or summary section
2. Can be added (`+trait:warrior`) or removed (`-trait:coward`)
3. Represent earned/lost qualities based on player choices

### Ally/Faction Display

Tags prefixed with `ally:` should be:
1. Displayed as relationships/reputation
2. May be used in step conditions to unlock hidden options
3. Examples: `ally:bookie`, `ally:thieves_guild`, `ally:church`

### Knowledge Tags

Tags prefixed with `know:` should be:
1. Hidden from general display
2. Used to gate dialogue options or reveal information
3. Examples: `know:rival_cheats`, `know:secret_passage`

## Tag Operators

Existing operators work unchanged with prefixed tags:

| Operator | Meaning | Example |
|----------|---------|---------|
| `+` | Add tag | `+inv:silver`, `+trait:gambler` |
| `-` | Remove tag | `-inv:silver`, `-status:injured` |
| `@` | Require tag (in step tags array) | `@q:horse_recovered` |
| `!` | Forbid tag (in step tags array) | `!done:merchant` |

## Migration Guide

### Quest Files

Transform existing tags according to this mapping:

#### System Tags
```
quest                    → quest (unchanged)
```

#### Quest-Scoped Tags (auto-clear on quest end)
```
merchant_quest           → q:merchant
stable_hand_quest        → q:stable_hand
horse_recovered          → q:horse_recovered
rival_exposed            → q:rival_exposed
mud_pit_failed           → q:mud_pit_failed
recovered_valuable       → q:recovered_valuable
```

#### Completion Tags
```
merchant_quest_complete  → done:merchant
stable_hand_quest_complete → done:stable_hand
```

#### Inventory Tags
```
silver                   → inv:silver
orange                   → inv:orange
rope                     → inv:rope
gemstone                 → inv:gemstone (when in inventory)
heirloom                 → inv:heirloom (when in inventory)
artifact                 → inv:artifact (when in inventory)
```

#### Status Tags
```
injured                  → status:injured
poisoned                 → status:poisoned
```

#### Trait Tags
```
warrior                  → trait:warrior
coward                   → trait:coward
gambler                  → trait:gambler
sneaky                   → trait:sneaky
beaten_by_thieves        → trait:beaten_by_thieves (or status:? - contextual)
```

#### Ally Tags
```
bookie_ally              → ally:bookie
thieves_guild            → ally:thieves_guild
```

#### Knowledge Tags
```
(new - use for information that unlocks dialogue)
```

### Code Changes Required

#### 1. Toolbar UI Update

- Remove inline stats display from toolbar
- Add backpack icon button that opens inventory panel
- Add user icon button that opens character sheet panel

#### 2. Inventory Panel Component

Create a new component for the inventory display:
- Triggered by tapping backpack icon
- Filters player tags by `inv:` prefix
- Groups and counts duplicate tags
- Formats display names (strip prefix, replace underscores, title case)
- Shows empty state when no inventory items

#### 3. Character Sheet Panel Component

Create a new component for character information:
- Triggered by tapping user icon
- Displays player stats (Might, Guile, Magic)
- Lists `trait:` tags under "Traits" heading
- Lists `status:` tags under "Status" heading  
- Lists `ally:` tags under "Allies" or "Reputation" heading
- Formats tag names for display (strip prefix, replace underscores, title case)

#### 4. Tag Processing Engine

Update the tag removal logic to auto-clear `q:` prefixed tags when `-quest` is processed.

#### 5. Tag Condition Evaluation

No changes needed—`@` and `!` operators should work with any string, including prefixed tags.

#### 6. Quest File Migration

Update all `.json` quest files to use the new prefixed tag names per the migration guide above.

## File Inventory

Files that need tag migration:
- `merchant-quest.json` (or similar)
- `stable-hand-wager.json`
- `default-locations.json`
- Any other quest/step files in the content directory

Files that need code changes:
- Toolbar component (add backpack and user icons, remove inline stats)
- New inventory panel component
- New character sheet panel component
- Tag processing/state management module
- Any tests covering tag behavior

## Validation

After migration:
1. All quest flows should work identically to before
2. Backpack icon opens inventory panel showing `inv:` items with counts
3. User icon opens character sheet showing stats, traits, statuses, and allies
4. Stats no longer display inline in toolbar
5. Starting a quest while another is active should still be blocked
6. Completing/failing a quest should clear all `q:` tags automatically
7. `done:` tags should prevent quest restart

## Example: Transformed Step

### Before
```json
{
  "id": "accept_stable_quest",
  "tags": ["+stable_hand_quest", "+quest"],
  "text": "Relief floods the stable hand's face...",
  "log": "Agreed to help the stable hand find their missing horse"
}
```

### After
```json
{
  "id": "accept_stable_quest",
  "tags": ["+q:stable_hand", "+quest"],
  "text": "Relief floods the stable hand's face...",
  "log": "Agreed to help the stable hand find their missing horse"
}
```

### Before (completion)
```json
{
  "id": "tavern_race_normal_no_bet",
  "tags": ["-horse_recovered", "-stable_hand_quest", "-quest", "+stable_hand_quest_complete", "+silver", "+silver"],
  "text": "The stable hand collects their winnings...",
  "log": "Helped the stable hand win their bet—earned 2 silver"
}
```

### After (completion)
```json
{
  "id": "tavern_race_normal_no_bet",
  "tags": ["-quest", "+done:stable_hand", "+inv:silver", "+inv:silver"],
  "text": "The stable hand collects their winnings...",
  "log": "Helped the stable hand win their bet—earned 2 silver"
}
```

Note: `-q:horse_recovered` and `-q:stable_hand` are no longer needed—they auto-clear when `-quest` fires.
