# Coffee Quest - Technical Specification

## Overview

Coffee Quest is a mobile-first, single-page static site that integrates with a physical mug featuring a printed map. Players create characters with stats (Might, Guile, Magic), navigate to locations by entering coordinates from the physical map, and progress through an emergent narrative by completing steps that unlock new possibilities through a metadata tagging system.

**Core Concept:** Quests are not pre-defined templates but emerge naturally from the player's accumulated tags and location choices. Each location may have multiple available steps, and the app presents the most appropriate one based on the player's current state.

## Architecture Principles

1. **Location-Centric:** Steps are associated with map locations, not quest templates
2. **Tag-Driven Narrative:** Player progression tracked through metadata tags
3. **Emergent Quests:** Story chains form from executing steps that grant/consume tags
4. **Stateless Steps:** Each step is self-contained; flow emerges from tag requirements
5. **Global Variable Persistence:** Variables set once and reused throughout gameplay

## Core Mechanics

### Character Stats

**Three Core Stats:**
- **Might:** Physical strength, combat, intimidation
- **Guile:** Stealth, deception, negotiation
- **Magic:** Arcane knowledge, supernatural influence

**Progression:**
- Starting values: Configurable (suggest 2-4 range)
- Stored in localStorage
- Increase by 1 after every N completed steps (suggest N=5)
- Certain metadata tags may provide temporary stat bonuses

### Location & Navigation

**Physical Map Integration:**
- Player views physical map printed on coffee mug
- Locations identified by coordinates (e.g., "B7", "M12", "15,8")
- Player manually enters coordinates into app
- **Correct coordinates:** Load and display appropriate step for that location
- **Incorrect coordinates:** Show generic "You're not at the right location" message

**Location Step Selection:**
When player enters valid coordinates:
1. Filter all steps by matching location
2. Apply tag filtering (required/blocked/preferred)
3. Calculate scores for remaining steps
4. Randomly select from highest-scored steps
5. Display step to player

### Tag System

**Tag Syntax in `step.tags` Array:**

| Prefix | Meaning | Usage |
|--------|---------|-------|
| `@tag` | Required | Player MUST have this tag to see step |
| `!tag` | Blocked | Player must NOT have this tag to see step |
| `tag` | Preferred | Score boost if player has tag |
| `+tag` | Grant | Add tag to player when step executes |
| `-tag` | Consume | Remove tag from player when step executes |

**Examples:**
```javascript
tags: ["@silver", "!banned_from_market", "knows_merchant"]
// Required: player has "silver"
// Blocked: player doesn't have "banned_from_market"  
// Preferred: score boost if player has "knows_merchant"

tags: ["-silver", "-silver", "+purchased_flour"]
// Consumes: removes 2 "silver" tags
// Grants: adds "purchased_flour" tag
```

**Tag Properties:**
- Tags are simple strings stored in an array
- Tags can stack (e.g., multiple "silver" tags)
- Tags persist in localStorage unless explicitly consumed
- No maximum tag limit

### Step Scoring Algorithm

```
For each step at entered location:
  
  // Hard filters - any violation excludes step
  For each tag in step.tags:
    If tag starts with '@':
      If player lacks tag.substring(1): EXCLUDE
    
    If tag starts with '!':
      If player has tag.substring(1): EXCLUDE
  
  // Soft scoring for remaining steps
  score = 0
  For each tag in step.tags without prefix:
    If player has tag:
      score += 5
  
Select all steps with max score
Return random choice from that set
```

**Special Case - Default Steps:**
Steps with only generic tags like `["quest"]` act as fallbacks when more specific steps don't match:

```javascript
{
  location: "B7",
  tags: ["quest"],  // Generic - low priority
  text: "The bakery is closed.",
  log: "Visited the bakery but it was closed."
}
```

### Step Types & Structure

**Core Step Definition:**
```javascript
{
  id: "unique_step_identifier",
  location: "B7",  // Map coordinates or virtual step ID
  tags: ["@required", "!blocked", "preferred"],
  
  vars: {
    variable_name: ["option1", "option2", "option3"],  // Set variable
    other_var: null  // Clear variable
  },
  
  text: "Step description shown to player. Can use {{variables}}.",
  log: "Text added to quest log (optional)",
  
  options: [
    // Array of player choices (see below)
  ]
}
```

**Location Types:**

1. **Physical Locations:** Match map coordinates (e.g., "B7", "M12")
   - Require player to enter coordinates
   - Multiple steps can share same location
   
2. **Virtual Locations:** Intermediate step IDs (e.g., "market_purchase_complete")
   - Auto-execute immediately when referenced
   - No coordinate entry required
   - Used for processing choices/skill check results

### Options Structure

Each step presents 0+ options to the player:

```javascript
options: [
  {
    label: "Wait in line and pay 2 silver",
    tags: ["silver", "silver"],  // Prerequisites to see this option
    pass: "market_purchase_complete"  // Step ID to execute if chosen
  },
  {
    label: "Try to steal the item (Guile)",
    tags: [],
    skill: "guile",  // Triggers skill check
    dc: 8,
    pass: "market_steal_success",  // Execute if check succeeds
    fail: "market_steal_caught"    // Execute if check fails
  },
  {
    label: "Leave the market",
    tags: [],
    pass: null  // Return to free navigation
  }
]
```

**Option Properties:**
- `label`: Button text shown to player (may contain {{variables}})
- `tags`: Tag requirements using same syntax as step.tags (for filtering visibility)
- `skill`: Optional - "might", "guile", or "magic" - triggers d6 skill check
- `dc`: Difficulty class for skill check (2-11 range typical)
- `pass`: Step ID to execute on selection/success (null = return to navigation)
- `fail`: Step ID to execute on skill check failure

**Option Filtering:**
Options are filtered by their `tags` array before display:
- Only show options where player meets requirements
- Hide options with insufficient resources
- Uses same @/!/prefix rules as step filtering

### Skill Checks

**Mechanic:**
```
Player selects which stat to use (Might/Guile/Magic)
Roll = d6 + Selected Stat + Stat Modifiers
Success if Roll ≥ DC
```

**UI Flow:**
1. Display challenge text
2. Show available stat options with current values
3. Player selects stat
4. Player taps "Roll" button
5. Display: d6 result, stat bonus, total, DC, pass/fail
6. Execute appropriate step (pass or fail)

**Stat Modifiers:**
Certain metadata tags provide passive bonuses:
```javascript
const STAT_MODIFIERS = {
  "blessed_sword": { might: 1 },
  "thieves_cloak": { guile: 1 },
  "wizards_ring": { magic: 1 }
};
```

### Variable System

**Global Variable Bin:**
- All variables stored in single global object in localStorage
- Variables persist until explicitly cleared
- Variables shared across all steps

**Setting Variables:**
```javascript
vars: {
  item: ["bread", "pastries", "cakes"],
  ingredient: ["flour", "sugar", "eggs"]
}
// On step execution: randomly picks one value for each
// Stores: questVars.item = "pastries", questVars.ingredient = "sugar"
```

**Using Variables:**
```javascript
text: "Thank you for bringing the {{ingredient}}! Here's your {{item}}."
// Renders: "Thank you for bringing the sugar! Here's your pastries."
```

**Clearing Variables:**
```javascript
vars: {
  item: null,
  ingredient: null
}
// On step execution: deletes these keys from questVars
```

**Variable Resolution:**
```javascript
function renderText(template, globalVars) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return globalVars[varName] || match;
  });
}
```

### Quest Log

**Purpose:** Narrative record of player actions without exposing raw metadata

**Behavior:**
- Displays text from `log` field of executed steps
- Variables replaced with their values at time of logging
- Chronological order (newest first)
- Persists in localStorage
- Maximum 100 entries (configurable)

**Example Log Entries:**
```
Agreed to fetch sugar for the baker
Negotiated discount at the market
Bought sugar at market for 1 silver
Delivered sugar to baker, earned silver
```

## Data Structures

### localStorage Schema

```javascript
{
  // Character state
  character: {
    might: 3,
    guile: 5,
    magic: 2,
    stepsCompleted: 12,
    metadata: [
      "silver",
      "silver", 
      "assisted_baker",
      "knows_secret_passage",
      "banned_from_tavern"
    ]
  },
  
  // Global variable storage
  questVars: {
    item: "pastries",
    ingredient: "sugar",
    npc_name: "Marcus",
    pest_type: "rats"
  },
  
  // Current step state (if in middle of step chain)
  currentStep: {
    stepId: "market_negotiate",
    location: "M12"
  },
  
  // Quest log entries
  questLog: [
    "Delivered sugar to baker, earned silver",
    "Bought sugar at market for 1 silver",
    "Negotiated discount at the market",
    "Agreed to fetch sugar for the baker"
  ],
  
  // App configuration
  config: {
    statsIncreaseEvery: 5,
    statIncreaseAmount: 1,
    preferredTagWeight: 5
  }
}
```

### Step Data File Format

**JSON Structure:**
```javascript
{
  "config": {
    "startingStats": {
      "might": 2,
      "guile": 2,
      "magic": 2
    },
    "statsIncreaseEvery": 5,
    "statIncreaseAmount": 1,
    "preferredTagWeight": 5,
    "statModifiers": {
      "blessed_sword": { "might": 1 },
      "thieves_cloak": { "guile": 1 },
      "wizards_ring": { "magic": 1 }
    }
  },
  
  "steps": [
    {
      "id": "bakery_welcome",
      "location": "B7",
      "tags": [],
      "vars": {
        "item": ["bread", "pastries", "cakes"]
      },
      "text": "The baker greets you warmly. 'I'd love to serve you some {{item}}, but I'm all out of flour. Could you help me?'",
      "options": [
        {
          "label": "I'll help you",
          "tags": [],
          "pass": "bakery_accept_quest"
        },
        {
          "label": "Sorry, I'm busy",
          "tags": [],
          "pass": null
        }
      ]
    },
    {
      "id": "bakery_accept_quest",
      "location": "bakery_accept",
      "tags": ["+baker_flour_quest", "+quest"],
      "text": "The baker smiles gratefully. 'Wonderful! Please visit the market at D9 and get some flour.'",
      "log": "Agreed to fetch flour for the baker"
    },
    {
      "id": "market_closed",
      "location": "D9",
      "tags": ["@baker_flour_quest", "!market_open"],
      "text": "You arrive at the market but it appears to be closed today.",
      "log": "Found the market closed"
    },
    {
      "id": "market_busy",
      "location": "D9",
      "tags": ["@baker_flour_quest"],
      "text": "The market is bustling. You see a stall selling flour.",
      "options": [
        {
          "label": "Buy flour for 2 silver",
          "tags": ["silver", "silver"],
          "pass": "market_purchase"
        },
        {
          "label": "Try to negotiate (Guile)",
          "tags": [],
          "skill": "guile",
          "dc": 8,
          "pass": "market_negotiate_success",
          "fail": "market_negotiate_fail"
        },
        {
          "label": "Try to steal flour (Guile)",
          "tags": [],
          "skill": "guile",
          "dc": 10,
          "pass": "market_steal_success",
          "fail": "market_steal_caught"
        }
      ]
    },
    {
      "id": "market_purchase",
      "location": "market_buy",
      "tags": ["-silver", "-silver", "+flour", "-baker_flour_quest"],
      "vars": {
        "item": null
      },
      "text": "You purchase the flour for 2 silver.",
      "log": "Bought flour at the market for 2 silver"
    },
    {
      "id": "market_negotiate_success",
      "location": "market_deal",
      "tags": [],
      "text": "The merchant agrees to sell for just 1 silver!",
      "options": [
        {
          "label": "Buy flour for 1 silver",
          "tags": ["silver"],
          "pass": "market_purchase_discount"
        },
        {
          "label": "Walk away",
          "tags": [],
          "pass": null
        }
      ]
    },
    {
      "id": "market_purchase_discount",
      "location": "market_buy_discount",
      "tags": ["-silver", "+flour", "-baker_flour_quest", "+shrewd_negotiator"],
      "text": "You purchase the flour for 1 silver. The merchant respects your negotiating skills.",
      "log": "Negotiated a good deal and bought flour for 1 silver"
    },
    {
      "id": "market_negotiate_fail",
      "location": "market_no_deal",
      "tags": [],
      "text": "The merchant is unmoved by your haggling. Full price or nothing.",
      "options": [
        {
          "label": "Pay 2 silver",
          "tags": ["silver", "silver"],
          "pass": "market_purchase"
        },
        {
          "label": "Walk away",
          "tags": [],
          "pass": null
        }
      ]
    },
    {
      "id": "market_steal_success",
      "location": "market_theft_success",
      "tags": ["+flour", "-baker_flour_quest", "+thief_reputation", "!honest_merchant"],
      "text": "You manage to slip a bag of flour into your pack unnoticed.",
      "log": "Stole flour from the market"
    },
    {
      "id": "market_steal_caught",
      "location": "market_theft_caught",
      "tags": ["+banned_from_market", "!market_access", "-baker_flour_quest"],
      "text": "The guards catch you! You're banned from the market.",
      "log": "Got caught stealing and banned from the market"
    },
    {
      "id": "bakery_return",
      "location": "B7",
      "tags": ["@flour", "!baker_flour_quest"],
      "text": "The baker is delighted to see you return with flour. 'Thank you! Here's some silver for your trouble.'",
      "options": [
        {
          "label": "Accept payment",
          "tags": ["-flour", "+silver", "+assisted_baker"],
          "pass": "bakery_complete"
        }
      ]
    },
    {
      "id": "bakery_complete",
      "location": "bakery_thanks",
      "tags": [],
      "text": "The baker hands you a silver coin and smiles warmly.",
      "log": "Delivered flour to baker and earned silver"
    }
  ]
}
```

## UI/UX Requirements

### Mobile-First Design

**Target:**
- Single page application
- Optimized for portrait mobile (320px - 428px width)
- No horizontal scrolling
- Large tap targets (minimum 44px)
- Readable text (minimum 16px base size)

**Layout Priority:**
1. Current stats display (always visible)
2. Coordinate entry
3. Step content area
4. Action buttons
5. Quest log access

### Main Views

#### 1. Character Creation Screen

**Initial view on first load:**

```
+----------------------------------+
|        COFFEE QUEST              |
|                                  |
|  Create Your Character           |
|                                  |
|  MIGHT:  [2] [-] [+]            |
|  GUILE:  [2] [-] [+]            |
|  MAGIC:  [2] [-] [+]            |
|                                  |
|  Points remaining: 6             |
|                                  |
|  [    BEGIN ADVENTURE    ]       |
+----------------------------------+
```

**Behavior:**
- Total starting points configurable (suggest 6-10)
- Min 1, Max 5 per stat
- "Begin Adventure" enabled when all points spent
- Stores in localStorage, shows Game View

#### 2. Game View (Primary)

```
+----------------------------------+
| Might: 3  Guile: 5  Magic: 2    |
| Steps: 12        [≡] [i]        |
+----------------------------------+
|                                  |
| Enter Location Coordinates:      |
| [__________] [GO]                |
|                                  |
+----------------------------------+
|                                  |
| The market is bustling. You see  |
| a stall selling flour.           |
|                                  |
| [Buy flour for 2 silver]         |
|                                  |
| [Try to negotiate (Guile)]       |
|                                  |
| [Try to steal flour (Guile)]     |
|                                  |
+----------------------------------+
```

**Header Elements:**
- Stats display (current + modifiers if any)
- Steps completed counter
- [≡] Menu button (opens Quest Log)
- [i] Info button (game instructions)

**Coordinate Entry:**
- Text input (uppercase, alphanumeric)
- "GO" button to submit
- Visible until step loads, then hidden

**Step Content Area:**
- Step text (scrollable if long)
- Variable interpolation applied
- Automatic text wrapping

**Action Buttons:**
- Full-width buttons
- Stack vertically
- Label shows stat requirement if skill check
- Disabled appearance if tags don't match (shouldn't show)
- Tappable with clear visual feedback

#### 3. Skill Check View

**Appears when option with skill check selected:**

```
+----------------------------------+
| Choose Your Approach:            |
|                                  |
| [  MIGHT (3)  ]                  |
| [  GUILE (5)  ]                  |
| [  MAGIC (2)  ]                  |
+----------------------------------+
```

**After stat selected:**

```
+----------------------------------+
| Rolling GUILE Check              |
| Target: 8                        |
|                                  |
| [    ROLL DICE    ]              |
+----------------------------------+
```

**After roll:**

```
+----------------------------------+
| GUILE Check vs DC 8              |
|                                  |
| Rolled: 4                        |
| Guile:  +5                       |
| Total:  9                        |
|                                  |
| SUCCESS!                         |
|                                  |
| [    CONTINUE    ]               |
+----------------------------------+
```

**Behavior:**
- Show only stats available for this check (from option definition)
- Animate dice roll (simple 1-6 counter or fade)
- Clear success/failure indication
- "Continue" button executes pass/fail step

#### 4. Quest Log Overlay

```
+----------------------------------+
|  QUEST LOG               [X]     |
+----------------------------------+
| Delivered flour to baker and     |
| earned silver                    |
|                                  |
| Negotiated a good deal and       |
| bought flour for 1 silver        |
|                                  |
| Agreed to fetch flour for baker  |
|                                  |
| [Show More]                      |
+----------------------------------+
```

**Behavior:**
- Modal overlay (darkened background)
- Reverse chronological (newest first)
- Show 10 most recent, "Show More" for full history
- [X] close button returns to game view
- Scrollable content area

#### 5. Debug View (Hidden)

**Accessed via console command or secret gesture:**

```
+----------------------------------+
| DEBUG MODE                       |
+----------------------------------+
| METADATA TAGS:                   |
| - silver (x2)                    |
| - assisted_baker                 |
| - knows_secret_passage           |
| - banned_from_market             |
|                                  |
| VARIABLES:                       |
| - item: "pastries"               |
| - ingredient: "sugar"            |
|                                  |
| CURRENT STEP: market_negotiate   |
|                                  |
| [Clear All Data]                 |
| [Export State]                   |
+----------------------------------+
```

### Visual Design Notes

**Color Palette Suggestions:**
- Background: Warm cream (#F5F1E8)
- Text: Dark brown (#2C1810)
- Buttons: Coffee brown (#6F4E37)
- Success: Forest green (#2D5016)
- Failure: Brick red (#8B3A3A)
- Accent: Gold (#D4AF37)

**Typography:**
- Headers: Bold, 20-24px
- Body: Regular, 16-18px
- Buttons: Semi-bold, 18px
- Stats: Monospace or bold, 14-16px

**Spacing:**
- Minimum padding: 16px
- Button spacing: 12px vertical gap
- Section separation: 24px

## Implementation Details

### Technology Stack

**Recommended:**
- HTML5 + CSS3
- Vanilla JavaScript (ES6+)
- No framework required (or lightweight like Alpine.js)
- localStorage for persistence
- Mobile viewport meta tags

### Core Functions

#### Step Selection

```javascript
function selectStepForLocation(location, playerMetadata, allSteps) {
  // Filter by location
  const locationSteps = allSteps.filter(s => s.location === location);
  
  // Apply hard filters
  const eligible = locationSteps.filter(step => {
    for (const tag of step.tags) {
      // Required tags
      if (tag.startsWith('@')) {
        const required = tag.substring(1);
        if (!playerMetadata.includes(required)) {
          return false;
        }
      }
      
      // Blocked tags
      if (tag.startsWith('!')) {
        const blocked = tag.substring(1);
        if (playerMetadata.includes(blocked)) {
          return false;
        }
      }
    }
    return true;
  });
  
  if (eligible.length === 0) {
    return null; // No available steps
  }
  
  // Calculate scores
  const scored = eligible.map(step => {
    let score = 0;
    step.tags.forEach(tag => {
      // Count preferred tags (no prefix)
      if (!tag.startsWith('@') && !tag.startsWith('!') && 
          !tag.startsWith('+') && !tag.startsWith('-')) {
        if (playerMetadata.includes(tag)) {
          score += 5;
        }
      }
    });
    return { step, score };
  });
  
  // Get max score
  const maxScore = Math.max(...scored.map(s => s.score));
  
  // Get all steps with max score
  const topSteps = scored.filter(s => s.score === maxScore);
  
  // Random selection from top
  return topSteps[Math.floor(Math.random() * topSteps.length)].step;
}
```

#### Step Execution

```javascript
function executeStep(step, playerState, questVars) {
  // Process variables first
  if (step.vars) {
    Object.entries(step.vars).forEach(([varName, options]) => {
      if (options === null) {
        // Clear variable
        delete questVars[varName];
      } else if (Array.isArray(options) && options.length > 0) {
        // Set new random value
        questVars[varName] = options[Math.floor(Math.random() * options.length)];
      }
    });
  }
  
  // Apply tag changes (+ and -)
  step.tags.forEach(tag => {
    if (tag.startsWith('+')) {
      const addTag = tag.substring(1);
      playerState.metadata.push(addTag);
    } else if (tag.startsWith('-')) {
      const removeTag = tag.substring(1);
      const index = playerState.metadata.indexOf(removeTag);
      if (index > -1) {
        playerState.metadata.splice(index, 1);
      }
    }
  });
  
  // Add to quest log if specified
  if (step.log) {
    const logEntry = renderText(step.log, questVars);
    playerState.questLog.unshift(logEntry);
    
    // Limit log size
    if (playerState.questLog.length > 100) {
      playerState.questLog = playerState.questLog.slice(0, 100);
    }
  }
  
  // Render and display step text
  const displayText = renderText(step.text, questVars);
  
  return displayText;
}
```

#### Option Filtering

```javascript
function getAvailableOptions(step, playerMetadata) {
  if (!step.options || step.options.length === 0) {
    return [];
  }
  
  return step.options.filter(option => {
    // Check option tag requirements
    for (const tag of (option.tags || [])) {
      // Required
      if (tag.startsWith('@')) {
        if (!playerMetadata.includes(tag.substring(1))) {
          return false;
        }
      }
      // Blocked
      if (tag.startsWith('!')) {
        if (playerMetadata.includes(tag.substring(1))) {
          return false;
        }
      }
      // Preferred or regular - must have
      if (!tag.startsWith('@') && !tag.startsWith('!') && 
          !tag.startsWith('+') && !tag.startsWith('-')) {
        if (!playerMetadata.includes(tag)) {
          return false;
        }
      }
    }
    return true;
  });
}
```

#### Skill Check Resolution

```javascript
function resolveSkillCheck(stat, statValue, dc, statModifiers = {}) {
  const roll = Math.floor(Math.random() * 6) + 1;
  const modifier = statModifiers[stat] || 0;
  const total = roll + statValue + modifier;
  const success = total >= dc;
  
  return {
    roll,
    statValue,
    modifier,
    total,
    dc,
    success
  };
}
```

#### Stat Modifier Calculation

```javascript
function calculateStatModifiers(playerMetadata, modifierConfig) {
  const modifiers = { might: 0, guile: 0, magic: 0 };
  
  playerMetadata.forEach(tag => {
    if (modifierConfig[tag]) {
      Object.entries(modifierConfig[tag]).forEach(([stat, bonus]) => {
        modifiers[stat] += bonus;
      });
    }
  });
  
  return modifiers;
}
```

### Game Flow State Machine

```
START
  ↓
CHARACTER_CREATION
  ↓
NAVIGATION (waiting for coordinates)
  ↓
LOCATION_ENTRY (player enters coordinates)
  ↓
STEP_SELECTION (filter and score steps)
  ↓
DISPLAY_STEP (show text and options)
  ↓
┌─────────────────┐
│ CHOICE          │ ← Option selected without skill check
│   ↓             │
│ EXECUTE_STEP    │ ← Apply tags, vars, log
│   ↓             │
│ IF pass != null │
│   ↓             │
│ LOAD_NEXT_STEP  │ ← Virtual location, auto-execute
│   ↓             │
│ ELSE            │
│   ↓             │
│ NAVIGATION      │ ← Return to coordinate entry
└─────────────────┘
        OR
┌─────────────────┐
│ SKILL_CHECK     │ ← Option with skill check selected
│   ↓             │
│ SELECT_STAT     │ ← Player chooses stat
│   ↓             │
│ ROLL_DICE       │ ← d6 + stat vs DC
│   ↓             │
│ IF success      │
│   ↓             │
│ EXECUTE pass    │
│ ELSE            │
│   ↓             │
│ EXECUTE fail    │
└─────────────────┘
```

### Edge Cases & Error Handling

**No Available Steps at Location:**
- Display: "You don't see anything of interest here. Try another location."
- Log: Nothing
- Action: Remain in navigation mode

**Invalid Coordinates:**
- Display: "Those coordinates aren't on your map. Check your mug."
- Log: Nothing  
- Action: Allow re-entry

**Missing Required Tags for All Steps:**
- Same as "No Available Steps"
- Happens when player isn't ready for location yet

**Option with Insufficient Tags:**
- Should never display due to filtering
- Defensive check: disable button if tags missing

**Virtual Step Not Found:**
- Error state: "Something went wrong. Returning to last location."
- Log error to console
- Reload last valid location step

**localStorage Quota Exceeded:**
- Trim quest log to 50 entries
- Alert player if still failing
- Offer "Clear old save data" option

**Corrupted Save Data:**
- Detect on load with try/catch
- Prompt: "Save data corrupted. Start new game?"
- Clear localStorage and restart

**Stat Increase Timing:**
- Check after every step completion
- Display notification: "Your [stat] increased to [value]!"
- Store immediately to avoid loss

### Performance Considerations

**Step Data Loading:**
- Load JSON on app initialization
- Parse once, store in memory
- No dynamic loading required (static site)

**localStorage Access:**
- Read once on load
- Update on every step completion
- Debounce saves if implementing auto-save during play

**DOM Updates:**
- Minimize reflows
- Use document fragments for option lists
- Clear and rebuild rather than selective updates

**Mobile Optimization:**
- Limit simultaneous animations
- Use CSS transforms over position changes
- Lazy load quest log entries (10 at a time)

## Testing Scenarios

### Functional Tests

1. **Character Creation**
   - Allocate all points
   - Try to exceed max per stat
   - Begin adventure with valid allocation

2. **Location Navigation**
   - Enter valid coordinates → load step
   - Enter invalid coordinates → error message
   - Enter coordinates with no available steps → fallback

3. **Step Selection**
   - Multiple steps at location → highest scored selected
   - Steps with required tags → only show when tags present
   - Steps with blocked tags → never show when blocked

4. **Tag System**
   - Accumulate tags through steps
   - Consume tags correctly (remove from array)
   - Stack tags (multiple same tag)
   - Block future steps with blocked tags

5. **Variable System**
   - Set variable on first use
   - Reuse variable across steps
   - Clear variable explicitly
   - Multiple variables in same text

6. **Skill Checks**
   - Roll d6 and calculate correctly
   - Compare to DC properly
   - Execute pass step on success
   - Execute fail step on failure
   - Apply stat modifiers from tags

7. **Options**
   - Show only options with met requirements
   - Hide options with insufficient tags
   - Skill check options trigger check
   - Regular options execute directly
   - Null pass returns to navigation

8. **Quest Log**
   - Add entries with log field
   - Render variables in log text
   - Display in reverse chronological order
   - Persist across sessions
   - Limit to 100 entries

9. **Stat Progression**
   - Increment after N steps
   - Display notification
   - Persist to localStorage

10. **Persistence**
    - Save after every step
    - Restore on reload
    - Handle missing/corrupted data

### User Experience Tests

1. Portrait mobile display (320px - 428px)
2. Large text readability outdoors
3. Single-handed navigation
4. Button tap targets (thumbs)
5. Quest log scrolling
6. Coordinate entry with on-screen keyboard
7. Multi-session gameplay continuity

### Content Tests

1. Variable replacement accuracy
2. Tag logic consistency
3. Dead-end detection (no escape from situation)
4. Narrative flow coherence
5. Balanced DC values for stats

## Future Considerations

**Not in Initial Scope (but architecture allows):**

- Multiple save slots
- Export/import save data
- Achievements system
- Stat respec option
- Difficulty modes (adjust DCs)
- Timed events or decay
- Relationship tracking beyond tags
- Item inventory UI (beyond tags)
- Combat system
- Multiplayer/shared world
- Analytics/telemetry
- Sound effects
- Animations
- Theming/customization

## Deliverables

### For Claude Code Implementation

1. `index.html` - Single page structure
2. `styles.css` - Mobile-first responsive design
3. `app.js` - Core game logic and state management
4. `steps.json` - Step data (with examples)
5. `README.md` - Setup and testing instructions

### Example Step Data File

Include at least 10-15 interconnected steps demonstrating:
- Simple choice flow
- Skill check success/failure paths
- Tag accumulation and consumption
- Variable usage and clearing
- Quest log entries
- Stat modifier application
- Multiple steps at same location
- Dead ends and recovery paths

## Appendix: Complete Example Quest Chain

This example demonstrates a complete mini-quest showcasing all mechanics:

```json
{
  "steps": [
    {
      "id": "town_square_start",
      "location": "A1",
      "tags": [],
      "text": "You arrive in the town square. A merchant looks distressed.",
      "options": [
        {
          "label": "Ask what's wrong",
          "tags": [],
          "pass": "merchant_problem"
        },
        {
          "label": "Ignore and move on",
          "tags": [],
          "pass": null
        }
      ]
    },
    {
      "id": "merchant_problem",
      "location": "merchant_talk",
      "tags": ["+merchant_quest", "+quest"],
      "vars": {
        "valuable": ["gemstone", "heirloom", "artifact"]
      },
      "text": "The merchant explains: 'Thieves stole my precious {{valuable}}! They fled to the Old Mill at C5. Please help me recover it!'",
      "log": "The merchant asked you to recover their stolen {{valuable}}",
      "options": [
        {
          "label": "I'll help you",
          "tags": [],
          "pass": null
        }
      ]
    },
    {
      "id": "old_mill_approach",
      "location": "C5",
      "tags": ["@merchant_quest"],
      "text": "You arrive at the Old Mill. You hear voices inside.",
      "options": [
        {
          "label": "Sneak in quietly (Guile)",
          "tags": [],
          "skill": "guile",
          "dc": 7,
          "pass": "mill_sneak_success",
          "fail": "mill_sneak_fail"
        },
        {
          "label": "Burst in aggressively (Might)",
          "tags": [],
          "skill": "might",
          "dc": 8,
          "pass": "mill_might_success",
          "fail": "mill_might_fail"
        },
        {
          "label": "Try to talk to them",
          "tags": [],
          "pass": "mill_negotiate"
        }
      ]
    },
    {
      "id": "mill_sneak_success",
      "location": "mill_sneak_win",
      "tags": ["+recovered_valuable", "-merchant_quest", "+sneaky_reputation"],
      "text": "You slip past the thieves unnoticed and grab the {{valuable}}!",
      "log": "Sneaked into the mill and recovered the {{valuable}}"
    },
    {
      "id": "mill_sneak_fail",
      "location": "mill_sneak_caught",
      "tags": [],
      "text": "The thieves hear you! One blocks your path.",
      "options": [
        {
          "label": "Fight (Might)",
          "tags": [],
          "skill": "might",
          "dc": 9,
          "pass": "mill_fight_win",
          "fail": "mill_fight_lose"
        },
        {
          "label": "Flee",
          "tags": ["-merchant_quest", "+coward_reputation"],
          "pass": "mill_flee"
        }
      ]
    },
    {
      "id": "mill_might_success",
      "location": "mill_might_win",
      "tags": ["+recovered_valuable", "-merchant_quest", "+warrior_reputation"],
      "text": "You intimidate the thieves into surrendering the {{valuable}}!",
      "log": "Intimidated the thieves and recovered the {{valuable}}"
    },
    {
      "id": "mill_might_fail",
      "location": "mill_might_lose",
      "tags": ["-merchant_quest", "+injured"],
      "text": "The thieves overpower you. You barely escape with your life.",
      "log": "Failed to recover the {{valuable}} and got injured"
    },
    {
      "id": "mill_negotiate",
      "location": "mill_talk",
      "tags": [],
      "text": "You approach peacefully. The thieves are willing to talk.",
      "options": [
        {
          "label": "Offer them 3 silver for the item",
          "tags": ["silver", "silver", "silver"],
          "pass": "mill_purchase"
        },
        {
          "label": "Threaten them (Might)",
          "tags": [],
          "skill": "might",
          "dc": 8,
          "pass": "mill_might_success",
          "fail": "mill_might_fail"
        },
        {
          "label": "Walk away",
          "tags": ["-merchant_quest"],
          "pass": "mill_give_up"
        }
      ]
    },
    {
      "id": "mill_purchase",
      "location": "mill_buy",
      "tags": ["-silver", "-silver", "-silver", "+recovered_valuable", "-merchant_quest"],
      "text": "The thieves accept your silver and hand over the {{valuable}}.",
      "log": "Bought the {{valuable}} from the thieves for 3 silver"
    },
    {
      "id": "mill_fight_win",
      "location": "mill_combat_win",
      "tags": ["+recovered_valuable", "-merchant_quest", "+warrior_reputation"],
      "text": "You defeat the thief and claim the {{valuable}}!",
      "log": "Fought the thieves and recovered the {{valuable}}"
    },
    {
      "id": "mill_fight_lose",
      "location": "mill_combat_lose",
      "tags": ["-merchant_quest", "+injured", "+beaten_by_thieves"],
      "text": "The thief beats you soundly. You limp away empty-handed.",
      "log": "Lost the fight and failed to recover the {{valuable}}"
    },
    {
      "id": "mill_flee",
      "location": "mill_escape",
      "tags": [],
      "text": "You run from the mill. The thieves laugh at your cowardice.",
      "log": "Fled from the thieves in fear"
    },
    {
      "id": "mill_give_up",
      "location": "mill_abandon",
      "tags": [],
      "text": "You leave the mill without the {{valuable}}.",
      "log": "Gave up on recovering the {{valuable}}"
    },
    {
      "id": "merchant_return_success",
      "location": "A1",
      "tags": ["@recovered_valuable"],
      "text": "The merchant is overjoyed to see their {{valuable}} returned!",
      "options": [
        {
          "label": "Accept reward",
          "tags": ["-recovered_valuable", "+silver", "+silver", "+merchant_friend"],
          "pass": "merchant_reward"
        }
      ]
    },
    {
      "id": "merchant_reward",
      "location": "merchant_thanks",
      "tags": [],
      "vars": {
        "valuable": null
      },
      "text": "The merchant gives you 2 silver and their eternal gratitude!",
      "log": "Returned the stolen item and earned 2 silver"
    },
    {
      "id": "merchant_return_failed",
      "location": "A1",
      "tags": ["@injured", "!merchant_quest", "!recovered_valuable"],
      "text": "The merchant sees your injuries and sighs sadly. 'I appreciate you tried...'",
      "log": "Returned to the merchant empty-handed"
    }
  ]
}
```

This example shows:
- Multiple resolution paths (sneak, fight, negotiate, buy, flee)
- Success and failure states for skill checks
- Tag accumulation (reputation types)
- Tag consumption (silver, quest tag, recovered item)
- Variable usage and clearing
- Branching narrative that reconverges
- Different rewards based on approach
- Quest log entries at key moments

---

**End of Specification**

This document should provide Claude Code with everything needed to implement Coffee Quest. All core mechanics, data structures, UI requirements, and example content are defined.