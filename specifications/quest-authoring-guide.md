# Coffee Quest: Quest Authoring Guide

## Overview

This guide covers best practices for creating quests in Coffee Quest. Quests are YAML files containing step definitions that the game engine selects based on player location and tags. Good quest design creates meaningful choices, rewards player effort proportionally, and avoids dead ends.

## YAML Schema Reference

### Quest File Structure

A quest file is a YAML document with a `name` and `steps` array:

```yaml
name: Quest Name
steps:
  - id: Location
    text: Step text here...
  - id: another_step
    text: More text...
```

### Step Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Location name (e.g., "Tavern") or internal step ID (e.g., "accept_quest") |
| `tags` | array | No | Tag conditions and modifications (see Tag Operators) |
| `vars` | object | No | Variable definitions for text substitution |
| `text` | string | Yes | Narrative text shown to the player |
| `options` | array | No | Player choices (see Option formats) |
| `log` | string | No | Entry added to player's adventure log |

**Example:**

```yaml
- id: Tavern
  tags:
    - "!quest"
    - "!done:tavern_brawl"
  vars:
    drunk:
      - Olaf
      - Willem
      - Bertram
  text: "{{drunk}} slams his mug on the table and glares at you."
  options:
    - What's your problem?::confront_drunk
    - Ignore him
  log: Encountered a belligerent drunk at the tavern
```

### Option Formats

Options can be specified in three ways:

**1. String shorthand (navigation):**
```yaml
- Go to the back room::back_room
```
Expands to: `{label: "Go to the back room", tags: [], pass: "back_room"}`

**2. String shorthand (end interaction):**
```yaml
- Leave the tavern
```
Expands to: `{label: "Leave the tavern", tags: [], pass: null}`

**3. Full object (complex options):**
```yaml
- label: Pick the lock
  tags: [inv:lockpick]
  skill: guile
  dc: 5
  pass: lock_opened
  fail: lock_jammed
  hidden: true
```

### Option Object Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | string | Yes | Text shown to player |
| `tags` | array | No | Tags required to see/select this option (consumed if prefixed items) |
| `skill` | string | No | Skill for check: "might", "guile", or "magic" |
| `dc` | number | No | Difficulty class for skill check (required if `skill` set) |
| `pass` | string/null | No | Step ID on success (null = end interaction) |
| `fail` | string | No | Step ID on failure (required if `skill` set) |
| `hidden` | boolean | No | If true, option only appears when tags are satisfied |

### Tag Syntax

**In step `tags` array:**

| Syntax | Meaning |
|--------|---------|
| `tag` | Step requires this tag (bare tag = require) |
| `@tag` | Step requires this tag (explicit require) |
| `!tag` | Step requires tag to be absent |
| `+tag` | Add tag when step executes |
| `-tag` | Remove tag when step executes |

**Note:** Tags with special characters (`@`, `!`, `-`) must be quoted in YAML:
```yaml
tags:
  - "@q:quest_name"    # Required - quoted
  - "!done:quest"      # Blocked - quoted
  - "-inv:item"        # Consume - quoted
  - +inv:silver        # Grant - no quotes needed
  - q:some_tag         # Preferred - no quotes needed
```

**In option `tags` array:**

| Syntax | Meaning |
|--------|---------|
| `tag` | Option requires this tag to appear/be selectable |
| `+tag` | Tag is consumed (removed) when option selected |

### Tag Prefixes

| Prefix | Purpose | Special Behavior |
|--------|---------|------------------|
| *(none)* | System tags | `quest` is the singleton lock |
| `q:` | Quest-scoped state | Auto-cleared when `-quest` fires |
| `done:` | Completed quests | Permanent, prevents quest restart |
| `inv:` | Inventory items | Shown in inventory UI, countable |
| `status:` | Conditions | Shown in character sheet |
| `trait:` | Character qualities | Shown in character sheet |
| `ally:` | Faction relationships | Shown in character sheet |
| `know:` | Learned information | Hidden, unlocks dialogue |

### Variable Syntax

**Definition (in `vars` object):**

```yaml
vars:
  npc_name:
    - Alice
    - Bob
    - Carol
  mood:
    - angry
    - sad
    - nervous
```

**Object variables with properties:**

```yaml
vars:
  victim:
    - name: Elena
      occupation: merchant
      gender: female
    - name: Marcus
      occupation: trader
      gender: male
```

**Usage in text:**

| Syntax | Description |
|--------|-------------|
| `{{npc_name}}` | Simple variable substitution |
| `{{victim.name}}` | Object property access |
| `{{victim.occupation}}` | Object property access |
| `{{victim.he}}` | Virtual pronoun (lowercase) |
| `{{victim.He}}` | Virtual pronoun (capitalized) |
| `{{victim.him}}` | Virtual pronoun (lowercase) |
| `{{victim.his}}` | Virtual pronoun (lowercase) |

**Virtual pronouns** (derived from `gender` field):

| Property | male | female |
|----------|------|--------|
| `.he` / `.He` | he / He | she / She |
| `.him` / `.Him` | him / Him | her / Her |
| `.his` / `.His` | his / His | her / Her |

**Variables in tags:**

```yaml
tags:
  - +q:guilty_{{suspect}}
```

Variable substitution is processed in tag strings, enabling dynamic branching.

### Option Presets

Reusable option sets defined at file level:

```yaml
name: Market Quest
option_presets:
  market_nav:
    - Browse other stalls::market_main
    - Leave the market

steps:
  - id: buy_rope
    text: You purchase the rope.
    options: market_nav
```

Presets are consolidated during build into a single `option_presets` object.

## Quest Structure

### The Three-Act Pattern

Most quests follow a three-step structure:

1. **Initiation** — Player visits a location and can accept (or decline) a quest
2. **Conflict** — Player pursues the quest goal, facing challenges requiring choices or skill checks
3. **Resolution** — Player completes (or fails) the quest, receiving consequences based on their actions

Complex quests may have multiple conflict stages or branching resolution paths.

### Basic Quest Flow

```
[Location: Quest Giver]     Player can accept or decline
         ↓
[Accept Step]               Sets quest tags, gives items/information
         ↓
[Location: Challenge]       Skill checks, choices, resource spending
         ↓
[Resolution Step]           Clears quest, grants rewards/consequences
```

## Tag System

### Tag Prefixes

| Prefix | Purpose | Lifetime |
|--------|---------|----------|
| `quest` | Singleton lock (no prefix) | Until quest ends |
| `q:` | Quest-scoped state | Auto-cleared when `-quest` fires |
| `done:` | Completed quests | Permanent |
| `inv:` | Inventory items | Until spent/removed |
| `status:` | Conditions (injured, etc.) | Until specifically cleared |
| `trait:` | Character qualities | Permanent unless removed |
| `ally:` | Faction relationships | Permanent unless removed |
| `know:` | Learned information | Permanent |

### Tag Operators

| Operator | In Step Tags | In Option Tags |
|----------|--------------|----------------|
| `+tag` | Add tag when step executes | Required to spend (consumed) |
| `-tag` | Remove tag when step executes | N/A |
| `@tag` | Require tag for step to appear | N/A |
| `!tag` | Forbid tag (step won't appear if present) | N/A |
| *(bare)* | Require tag for step to appear | Required to see option |

### Quest Gating Pattern

**Initiation step** — Only appears if no quest is active and quest isn't completed:
```yaml
- id: Location
  tags:
    - "!quest"
    - "!done:quest_name"
  text: Quest giver offers the quest...
  options:
    - Accept::accept_step
    - Decline
```

**Accept step** — Activates the quest:
```yaml
- id: accept_step
  tags:
    - +quest
    - +q:quest_name
  text: You accept the quest...
  log: Accepted the quest
```

**Completion step** — Ends the quest:
```yaml
- id: complete_step
  tags:
    - "-quest"
    - +done:quest_name
    - +inv:silver
  text: Quest complete!
  log: Completed the quest and earned reward
```

Note: When `-quest` fires, ALL `q:` prefixed tags are automatically cleared.

## Step Selection

The engine selects which step to show based on:
1. Player's current location (matching `id`)
2. All tag conditions in the step's `tags` array

When multiple steps match, one is chosen randomly. Use specific tag combinations to ensure the right step appears at the right time.

### Precedence Through Specificity

More specific tag requirements take precedence. Order steps from most specific to least:

```yaml
# Most specific: Has item AND completed investigation
- id: Town Square
  tags:
    - "@q:has_flower"
    - "@q:talked_to_herbalist"
    - q:fetch_quest
  text: The cleric sees the moonflower and smiles...

# Medium: Has item only
- id: Town Square
  tags:
    - "@q:has_flower"
    - q:fetch_quest
  text: The cleric asks if you've learned how to prepare it...

# Least specific: Quest active, nothing done yet
- id: Town Square
  tags:
    - q:fetch_quest
  text: The cleric waits anxiously for the moonflower...
```

### Covering All States

For each location involved in a quest, ensure you have steps covering:

1. **Before quest accepted** — Default location behavior (handled by `default-locations.yaml`)
2. **Quest active, nothing done** — Reminder of what to do
3. **Quest active, partial progress** — Acknowledgment + hints
4. **Quest active, ready to complete** — Resolution options
5. **Quest completed** — Either default behavior or post-quest content

## Player Choice Design

### Never Create Dead Ends

Every step with options must have at least one path that doesn't require:
- A specific skill check success
- A specific inventory item
- A specific tag the player might not have

**Bad** — Player is stuck if they fail or lack silver:
```yaml
options:
  - label: Pick the lock
    skill: guile
    dc: 6
    pass: success
    fail: fail_and_stuck
  - label: Bribe the guard (2 silver)
    tags: [inv:silver, inv:silver]
    pass: success
```

**Good** — Always an exit:
```yaml
options:
  - label: Pick the lock
    skill: guile
    dc: 6
    pass: success
    fail: caught_but_continue
  - label: Bribe the guard (2 silver)
    tags: [inv:silver, inv:silver]
    pass: success
  - Leave and find another way
```

### Allow Retreat and Regrouping

When players aren't ready to proceed, give them an out:

```yaml
- id: Guardhouse
  tags:
    - "@q:lead_blacksmith"
    - q:fencing_swords
  text: "{{captain}} asks what you've found."
  options:
    - Accuse the guard::accuse_guard
    - Accuse the smith::accuse_smith
    - Accuse the madam::accuse_madam
    - I need to investigate more     # ← Escape hatch
```

The "I need to investigate more" option has no `pass` target, ending the interaction and letting the player leave to gather more evidence.

### Proportional Rewards

Reward quality should match effort invested:

| Effort | Reward Example |
|--------|----------------|
| Minimal (1 lead, weak evidence) | 1 silver |
| Moderate (2 leads, solid case) | 2 silver |
| Maximum (all leads, overwhelming) | 3 silver + ally tag |
| Risky shortcut (confrontation) | 1 silver + trait |
| Corrupt path (blackmail) | 4 silver + `trait:corrupt` |

### Multiple Approach Options

Offer different ways to solve problems that play to different character builds:

```yaml
options:
  - label: Sneak past the guards
    skill: guile
    dc: 5
    pass: sneak_success
    fail: sneak_fail
  - label: Fight through
    skill: might
    dc: 6
    pass: fight_success
    fail: fight_fail
  - label: Bribe them (2 silver)
    tags: [inv:silver, inv:silver]
    pass: bribe_success
  - Look for another way in
```

### Skill Check Failures Should Advance

Failed skill checks shouldn't be dead ends—they should create complications:

```yaml
# Failure creates a harder follow-up, not a wall
- id: sneak_fail
  text: The guards spot you! One blocks your path.
  options:
    - label: Fight your way out
      skill: might
      dc: 6
      pass: escape_fight
      fail: captured
    - label: Talk your way out
      skill: guile
      dc: 5
      pass: escape_talk
      fail: captured
    - Surrender
```

## Item and Fetch Quests

### Physical Items vs. Quest Flags

When a quest involves fetching or delivering something physical:

- **Use `inv:` tags** for items the player carries and can see in inventory
- **Use `q:` tags** for abstract progress markers

**Wrong** — Player "has" flower but can't see it:
```yaml
tags:
  - +q:has_moonflower
```

**Right** — Flower appears in inventory:
```yaml
tags:
  - +inv:moonflower
```

### Requiring Item Handover

If the player must give up an item to proceed, use `-inv:item` in the step tags:

```yaml
- id: give_flower
  tags:
    - "-inv:moonflower"
    - +q:flower_delivered
  text: You hand the moonflower to the cleric. She accepts it gratefully.
  log: Gave the moonflower to the cleric
```

The option to give the flower should require having it:

```yaml
- label: Give her the moonflower
  tags: [inv:moonflower]
  pass: give_flower
```

### Item-Gated Options

Options requiring items should check for them. The item appears in `tags` (without operator) to require it, and the step uses `-inv:` to consume it:

```yaml
# Option requires silver
- label: Pay 2 silver
  tags: [inv:silver, inv:silver]
  pass: paid_step

# Step consumes silver
- id: paid_step
  tags:
    - "-inv:silver"
    - "-inv:silver"
  text: You hand over the coins...
```

## Dialogue and Hints

### Show, Don't Tell

Don't explicitly tell players what to do. Let them discover:

**Too direct:**
```
"You should go to the Market and buy rope, then return here."
```

**Better:**
```
"The well is deep. You'd need something to climb down safely."
```

### Contextual Hints on Return

When players return without what they need, provide gentle guidance through NPC dialogue:

```yaml
- id: Church
  tags:
    - q:fetch_flower
    - "!inv:moonflower"
  text: >-
    The cleric looks up hopefully, then sighs when she sees your empty hands. "The moonflower only blooms in the
    deep forest, far from town. Did you search thoroughly?"
```

### Progressive Hint Escalation

If players seem stuck, subsequent visits can offer clearer hints:

```yaml
# First return - vague
- id: Church
  tags:
    - q:fetch_flower
    - "!inv:moonflower"
    - "!q:hint_given"
  text: '"Still searching? The forest holds many secrets."'
  options:
    - Any advice?::give_hint
    - I'll keep looking

# After asking for help
- id: give_hint
  tags:
    - +q:hint_given
  text: '"Moonflowers grow near water, in the darkest parts of the wood. Look for the old stones."'

# Subsequent returns - clearer
- id: Church
  tags:
    - q:fetch_flower
    - "!inv:moonflower"
    - "@q:hint_given"
  text: '"The standing stones in the forest''s heart—have you found them yet?"'
```

## Variable Substitution

### Randomizing Names and Details

Use `vars` to add variety:

```yaml
- id: Tavern
  vars:
    drunk:
      - Olaf
      - Bertram
      - Willem
    drink:
      - ale
      - mead
      - wine
  text: "{{drunk}} slams down his {{drink}} and belches loudly."
```

Variables set in one step persist for the entire quest.

### Full Description Variations

Variables can contain entire sentences or paragraphs, not just names:

```yaml
- id: Tavern
  vars:
    tavern_mood:
      - >-
        The tavern is empty except for the barkeep, who is cleaning up broken chairs from last night's
        debauchery.
      - The tavern is full but eerily quiet, as if the patrons are waiting for something to happen.
      - A bard's melancholy tune drifts through the smoky air. The regulars nurse their drinks in silence.
  text: "{{tavern_mood}} You find a seat near the back."
```

This creates replay variety without requiring multiple step definitions.

### Gendered NPCs

NPCs can be defined as objects with properties including gender:

```yaml
vars:
  victim:
    - occupation: merchant
      gender: male
    - occupation: seamstress
      gender: female
    - occupation: farmer
      gender: male
```

In templates, access properties with dot notation. Gendered pronouns are virtual properties derived from the `gender` field:

```yaml
text: >-
  The {{victim.occupation}} shows you {{victim.his}} scar. {{victim.He}} seems to be who {{victim.he}} says
  {{victim.he}} is.
```

**Available virtual pronouns:**

| Property | Male | Female |
|----------|------|--------|
| `{{npc.he}}` | he | she |
| `{{npc.He}}` | He | She |
| `{{npc.him}}` | him | her |
| `{{npc.Him}}` | Him | Her |
| `{{npc.his}}` | his | her |
| `{{npc.His}}` | His | Her |

**Note:** Case is significant. `{{victim.He}}` produces "He" or "She" (capitalized), while `{{victim.he}}` produces "he" or "she" (lowercase).

This approach keeps name and gender synchronized automatically—no parallel arrays to maintain.

### Variables in Tags

Variable substitution works in tags, enabling dynamic quest branching:

```yaml
- id: accept_quest
  vars:
    guilty:
      - guard
      - smith
      - madam
  tags:
    - +quest
    - +q:mystery
    - +q:guilty_{{guilty}}
  text: You accept the investigation...
```

This creates a tag like `q:guilty_smith` that persists, allowing different evidence and outcomes based on the random selection.

Later steps filter on the resolved tag:

```yaml
- id: find_evidence
  tags:
    - q:mystery
    - "@q:guilty_guard"
  text: Evidence pointing toward the guard...
```

## Quest Length and Complexity

### Standard Three-Act Quests

Most quests follow the Initiation → Conflict → Resolution pattern, playable in a coffee break. These should be the majority of content.

### Extended Quests (4-5 Scenes)

Occasionally, a quest may warrant additional complexity:

```
Initiation
    ↓
Investigation/Setup
    ↓
Complication (twist, escalation)
    ↓
Climax
    ↓
Resolution
```

**Use extended quests sparingly for:**
- Major story beats
- Multi-location mysteries
- Quests with significant twists
- Epic conclusions to quest chains

**Gating Extended Quests**

Extended quests should become available when the player has accumulated tags from prior quests that would help them complete it. This creates a natural progression where longer quests reward experienced players.

```yaml
- id: Tavern
  tags:
    - "!quest"
    - "!done:epic_heist"
    - "@ally:thieves_guild"
    - "@done:fencing_swords"
  text: >-
    A hooded figure approaches. "Word is you helped the Guard... and you know people who work outside the law. I
    have a job that needs both kinds of expertise."
```

This quest requires:
- `ally:thieves_guild` — earned from a prior quest
- `done:fencing_swords` — completed the Fencing Swords investigation

The player can't stumble into this quest early. They've proven themselves through prior adventures, and those accomplishments unlock new opportunities.

**Multiple valid paths:** Even with tag gates, design multiple routes through the quest. A player might have the thieves guild connection but not the guard ally—offer alternatives that account for different tag combinations.

**Keep in mind:**
- More scenes = more steps = more edge cases to cover
- Players may abandon long quests mid-way
- Ensure intermediate progress feels meaningful
- Provide "checkpoint" moments where partial completion still feels okay

### Example: Four-Scene Quest

```
Scene 1: Tavern
  Mysterious stranger offers a job

Scene 2: Port
  Investigate the ship, discover it's a trap

Scene 3: Island
  Confront the real threat (the stranger set you up)

Scene 4: Tavern
  Return to deal with the stranger (or they've fled)
```

## Cross-Quest Integration

### Connecting the World

Items and outcomes from one quest can create optional shortcuts or bonus paths in others. This makes the world feel cohesive—actions have ripple effects beyond their immediate quest.

### Optional Item Shortcuts

If a player might have an item from another quest, offer it as a **hidden** bonus option alongside the standard paths:

```yaml
- id: Church
  tags:
    - q:help_beggar
  text: The beggar clutches his stomach. "Please, I haven't eaten in days..."
  options:
    - label: Give him an orange
      tags: [inv:orange]
      pass: beggar_fed_orange
      hidden: true
    - label: Give him some bread
      tags: [inv:bread]
      pass: beggar_fed_bread
      hidden: true
    - Offer to buy him food at the Bakery::bakery_errand
    - Offer to get him work at the Farmhouse::farmhouse_errand
    - I have nothing to offer right now
```

**Key principle:** The standard paths (Bakery errand, Farmhouse errand) are always visible. The cross-quest shortcuts (orange, bread) are **hidden** and only appear if the player has the item from a prior quest.

The player who completed the baker's quest and has oranges sees an extra option. Players without oranges never see it—they don't know what they're missing, and they have perfectly good alternatives.

### Hidden vs. Visible Options

**Visible (not hidden):**
- Standard quest paths anyone can take
- Options requiring items available in the current quest
- Purchasable solutions ("Bribe with 2 silver")

**Hidden:**
- Cross-quest item shortcuts
- Ally/reputation bonuses from other quests
- Secret paths that require prior knowledge

**Rule of thumb:** If the option requires something the player could only get from a *different* quest, make it hidden. If it's achievable through the current quest's standard flow, keep it visible.

### Ally and Reputation Payoffs

Tags earned in one quest can unlock hidden options in another:

```yaml
- id: Guardhouse
  tags:
    - q:need_favor
  text: The guards block your path. "No civilians beyond this point."
  options:
    - label: Remind the captain she owes you a favor
      tags: [ally:guard]
      pass: guard_lets_you_pass
      hidden: true
    - label: Bribe them (3 silver)
      tags: [inv:silver, inv:silver, inv:silver]
      pass: bribe_guards
    - label: Sneak past
      skill: guile
      dc: 6
      pass: sneak_success
      fail: sneak_fail
    - Leave
```

Players who earned `ally:guard` from the Fencing Swords investigation see a hidden option that bypasses the challenge entirely. Others must pay or sneak—but the quest remains completable either way.

### Design Principles for Cross-Quest Options

1. **Always completable without hidden options** — The player must be able to finish the quest using only visible options
2. **Hidden options reward prior investment** — Better outcomes, richer story, or resource savings
3. **Never punish players who lack cross-quest items** — They shouldn't feel stuck or disadvantaged
4. **Hidden options can be the "best" path** — This rewards thorough players without blocking others

### Key Items Across Quests

Some items might have uses beyond their original quest:

| Item | Original Quest | Potential Future Use |
|------|---------------|---------------------|
| `inv:armory_key` | Fencing Swords | Access restricted areas |
| `inv:orange` | Various rewards | Feed hungry NPCs |
| `inv:rope` | Market purchase | Climbing, rescue quests |
| `inv:lockpick` | Thieves Guild | Alternative entry options |

**Important:** Cross-quest items should provide *optional shortcuts*, never *required gates*. Players who haven't completed Quest A must still be able to complete Quest B through other means.

### Designing for Integration

When creating a quest, consider:

1. **What items does this quest give?** Could any be useful elsewhere?
2. **What allies/traits does this quest grant?** Where might those matter?
3. **What items might players already have?** Can any shortcut a step?
4. **What common needs appear?** (money, food, access, information)

Document potential connections in comments:

```yaml
# NOTE: Players with inv:rope from Market can skip the climbing check
# NOTE: ally:thieves_guild would let them bypass the lock entirely
```

### Step Patches

For more complex cross-quest integration, you can use **step patches** to conditionally augment steps defined in other quest files. This lets you add options or modify text without editing the original file.

A patch is a step with an `id` prefixed by `@patch:`:

```yaml
- id: "@patch:baker_buy"
  tags:
    - "@q:flour_mystery"
  text:
    append: " She keeps glancing at the empty shelves behind her."
  options:
    - label: Ask about the flour shortage
      pass: baker_flour_hint
      hidden: true
```

**Key concepts:**

- **Runtime evaluation:** Patches are conditional — the `tags` array specifies when the patch applies (using `@tag` to require and `!tag` to forbid)
- **Text modification:** Use `append`, `prepend`, or `replace` instead of a plain string
- **Options:** Appended to the target step's options array
- **Variables:** Merged with the target step's vars (patch values override on conflict)

**Multiple patches can target the same step.** If a player has both `q:flour_mystery` and `q:herb_errand`, and there are patches for each, both apply — text modifications accumulate, options from both are appended.

**Use patches when:**
- You want to add quest-specific dialogue to a shared step (like a shop)
- You need to modify text conditionally without duplicating the entire step
- Cross-quest integration requires more than just hidden options

**Use hidden options (not patches) when:**
- You just need to add a conditional option to a step you control
- The integration is simple enough that a hidden option suffices

See `specifications/quest-editor-spec.md` for full technical details on patch syntax and behavior.

### Avoiding Key Item Problems

Be cautious about quest items that might strand players:

**Potentially problematic:**
```yaml
- id: accept_armory_quest
  tags:
    - +inv:armory_key
  text: She hands you the key to the Armory.
```

If the player never returns the key, they have permanent Armory access. This might be intentional (reward for completing the quest) or a design oversight.

**Consider:**
- Should the key be returned at quest end?
- Is permanent access an intended reward?
- Could this break other quests that assume the Armory is locked?

When in doubt, consume quest-specific keys on completion:

```yaml
- id: complete_armory_quest
  tags:
    - "-quest"
    - +done:fencing_swords
    - "-inv:armory_key"
    - +inv:silver
  text: You return the key to {{captain}}. She nods approvingly...
```

Or explicitly grant permanent access as a reward:

```yaml
- id: complete_armory_quest
  tags:
    - "-quest"
    - +done:fencing_swords
    - +ally:guard
  text: '"Keep the key," {{captain}} says. "You''ve earned the Guard''s trust."'
```

## Logging

### When to Log

Create log entries when the player **takes an action that has a meaningful outcome**, not when they merely arrive somewhere:

**Log these:**
- Accepting or declining a quest
- Making a significant choice
- Completing a skill check
- Acquiring or spending items
- Quest completion/failure

**Don't log these:**
- Arriving at a location
- Reading dialogue
- Viewing options without selecting

### Log Entry Style

Keep logs concise and factual:

```yaml
log: Agreed to investigate the missing weapons
log: Found evidence pointing toward {{guard}}
log: Accused the wrong person—the thief escaped
```

Logs can include variable substitution.

## Common Patterns

### Investigation Quest (Multiple Leads)

```
Accept Quest
     ↓
Search Location (sets q:searched)
     ↓
┌────┴────┬────────┐
↓         ↓        ↓
Lead A    Lead B   Lead C
(+q:a)    (+q:b)   (+q:c)
└────┬────┴────────┘
     ↓
Resolution (reward scales with leads found)
```

Each lead location checks `@q:searched` and `!q:lead_X`.

### Fetch Quest

```
Accept Quest (+q:fetch, told what to find)
     ↓
Find Location (get +inv:item)
     ↓
Return to Quest Giver
     ↓
Hand Over Item (-inv:item, +reward)
```

### Moral Choice Quest

```
Accept Quest
     ↓
Discover Situation
     ↓
┌─────┴─────┐
↓           ↓
Good Path   Bad Path
(+trait:x)  (+trait:y, more money)
```

### Escort/Protect Quest

```
Accept Quest (+q:escorting)
     ↓
Travel to Danger Location
     ↓
Face Threat (skill check)
     ↓
┌────┴────┐
↓         ↓
Success   Failure
(reward)  (ally harmed, reduced reward)
```

### Extended Investigation (4-5 Scenes)

```
Scene 1: Accept (Guardhouse)
     ↓
Scene 2: Gather Clues (Armory)
     ↓
Scene 3: Follow Leads (Blacksmith / Seamstress / Tavern)
     ↓
Scene 4: Confront/Resolve (Guardhouse)
     ↓
[Optional Scene 5: Consequences play out]
```

Key features:
- Multiple locations can be visited in any order (leads)
- Evidence accumulates via `q:` tags
- Resolution quality scales with thoroughness
- Wrong accusations create failure state

## Checklist for New Quests

Before finalizing a quest, verify:

### Structure
- [ ] Initiation has `!quest` and `!done:quest_name`
- [ ] Accept step adds `+quest` and `+q:quest_name`
- [ ] All completion paths have `-quest` and `+done:quest_name`
- [ ] No `q:` tags manually removed (they auto-clear)
- [ ] If 4+ scenes, complexity is justified
- [ ] Extended quests gated by tags from prior quests

### Player Experience
- [ ] Every step with options has a no-requirement escape path
- [ ] Failed skill checks lead somewhere (not dead ends)
- [ ] Rewards match effort invested
- [ ] Multiple character builds can complete the quest

### Return Visits
- [ ] Quest-giver has dialogue for "returned too early"
- [ ] Quest-giver gives hints if player seems stuck
- [ ] Intermediate locations have "already done" steps

### Items
- [ ] Physical items use `inv:` prefix
- [ ] Items appear in inventory when acquired
- [ ] Item handover uses `-inv:` to consume
- [ ] Item-requiring options check for the item
- [ ] Quest-specific keys are returned or intentionally kept

### Variables
- [ ] NPC names have matching pronoun variables if gendered
- [ ] Description variations add meaningful variety
- [ ] Variables in tags create intended branching

### Cross-Quest Integration
- [ ] Considered what existing items might shortcut this quest
- [ ] Cross-quest item shortcuts are marked `hidden: true`
- [ ] Ally/reputation bonuses are marked `hidden: true`
- [ ] All cross-quest paths are optional, never required
- [ ] Quest is completable using only visible options
- [ ] Documented integration points in comments
- [ ] Step patches target existing step IDs (not other patches)
- [ ] Patch conditions use `@tag`/`!tag` syntax (not `+`/`-`)

### Logging
- [ ] Actions are logged, not arrivals
- [ ] Log entries are concise
- [ ] Variables are substituted in logs

### Polish
- [ ] Text shows rather than tells
- [ ] NPCs give contextual hints, not instructions
- [ ] Multiple outcomes have distinct narrative flavor

## Appendix: Known Cross-Quest Items and Tags

When designing new quests, consider these existing items and tags that players might have:

### Common Inventory Items

| Item | Source | Potential Uses |
|------|--------|----------------|
| `inv:silver` | Many quests | Bribes, purchases, fees |
| `inv:orange` | Baker, Merchant | Feed hungry NPCs |
| `inv:rope` | Market | Climbing, restraining, rescue |
| `inv:armory_key` | Fencing Swords | Access to Armory (if not returned) |

### Reputation Tags

| Tag | Source | Potential Uses |
|-----|--------|----------------|
| `ally:guard` | Fencing Swords (best ending) | Bypass guard challenges, get information |
| `ally:bookie` | Stable Hand's Wager (best ending) | Gambling advantages, underworld info |

### Trait Tags

| Tag | Source | Potential Uses |
|-----|--------|----------------|
| `trait:warrior` | Combat victories | Intimidation bonuses, reputation |
| `trait:gambler` | Accepting wagers | Recognition in gambling circles |
| `trait:coward` | Fleeing danger | NPCs may distrust or mock |
| `trait:corrupt` | Taking bribes/blackmail | Criminal contacts, guard suspicion |

### Status Tags

| Tag | Source | Cleared By |
|-----|--------|------------|
| `status:injured` | Combat losses | Healer, Church, rest at Inn |
| `status:wanted` | Criminal actions | Time, bribe, quest resolution |

*Update this appendix as new quests add significant items or tags.*
