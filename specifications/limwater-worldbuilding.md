# Coffee Quest: Worldbuilding Specification

## The Town of Limwater

### Overview

Limwater is a working-class port town at the mouth of the Silter River, where it empties into Grimsby Bay—an inlet of the Briarsea. The town is named for the chalky mineral deposits the river leaves on everything it touches. It's the last freshwater port before the open water.

### Geography

| Feature | Name | Description |
|---------|------|-------------|
| Town | Limwater | River-mouth port town; mineral-stained water |
| River | The Silter | Flows into Grimsby Bay; chalky deposits |
| Bay | Grimsby Bay | Inlet of the Briarsea where Limwater sits |
| Sea | The Briarsea | The larger sea to the west |
| Region | The Briarsea March | Coastal borderland along the Briarsea; named for the sea and the bramble hedgerows that run to the waterline |
| Market Town | Dawnhollow | Two days north; seat of the Baron of Dawnhollow |
| Rival Village | Marram | Half day south; fishing village with blood feud over fishing rights |
| Island | Cairnwell Isle | Visible from port; abandoned ruins; central to the mythology |

### What Limwater Is Known For

1. **The Mud Pit races** — Pig races (and anything else that can be goaded through muck). The spring championship draws gamblers from Dawnhollow.

2. **Limwater oranges** — A bitter variety that grows only in the grove near the old mill. Used for marmalade and preventing scurvy. No one has successfully transplanted them. The Library has seventeen competing theories as to why.

3. **The Wethering** — A thick fog that rolls in from Grimsby Bay without warning. Locals claim you can hear voices in it. It is central to the hidden mythology.

### Public Legends

These are stories the townspeople know and tell:

**The Limwater Witch**: Three generations ago, Morwen Blackthistle was accused of witchcraft and driven into the Haunted Grove. She was never seen again. The Church maintains officially that there was no witch.

**Old Gregor's Hoard**: Gregor Silter was a pirate who allegedly buried treasure in the area before being hanged in Dawnhollow. People still dig for it occasionally. They never find anything.

**The Drowned Bell**: The church bell was supposedly recovered from a shipwreck. It rings on its own before storms—or so they say.

### Where People Go

| Need | Location | Notes |
|------|----------|-------|
| Bread | Bakery | — |
| Produce | Farmhouse | Eggs, vegetables |
| General goods | Market | — |
| Hot meal | Tavern | Stew of variable quality |
| Healing | Church | Priest has stillroom and herb knowledge |
| Serious medicine | Dawnhollow | Surgeon who drinks before operating |
| Dock work | Port | Loading and unloading |
| Horse work | Stables | — |
| Farm work | Farmhouse | Seasonal |
| Guard work | Guardhouse | Captain is particular |
| Entertainment | Tavern, Mud Pit, Seamstress | The Seamstress runs a brothel |

### Local Personalities (Unnamed)

NPCs should emerge from quests rather than being pre-established. The default-locations file establishes these *types*:

- Guard captain who runs a loose ship (gambling, lazy guards)
- Baker perpetually dusted in flour
- Librarian who enforces silence zealously
- Priest absorbed in prayer
- Madam at the seamstress shop (maintains polite fiction)
- Blacksmith too busy for custom work
- Miller waging war on rats

---

## The Hidden Mythology: The Sleeper

This is the unified story beneath the surface. No single quest reveals it; players piece it together through `know:` tags and accumulated details.

### The Deep Past

Cairnwell Isle wasn't always an island. Centuries ago, it was a promontory connected to the mainland. Something lived there—not a god exactly, but old enough that the distinction stops mattering. The first people called it **the Sleeper**.

The Sleeper isn't malevolent in any human sense. It simply *dreams*, and its dreams leak into the world as **the Wethering**—the fog that carries whispers and half-seen shapes.

The original inhabitants built a **temple complex** to keep the Sleeper dormant. The carvings on the Cairnwell ruins aren't decoration; they're bindings. They cast a **bell** to warn when the Sleeper stirred, so the temple-keepers could renew the wards.

### The Drowning

Roughly three centuries ago, the spit of land connecting Cairnwell to the mainland collapsed into the sea. The temple-keepers were lost. The island became inaccessible except by boat.

The **Drowned Bell** was recovered and installed in the church. The priests who inherited it understood fragments of its purpose, but the full ritual knowledge was lost. They kept it, recorded vague warnings, and hoped the Sleeper would stay dormant.

For a while, it did.

### The Blackthistle Line

Survivors of the drowning preserved fragments of the old practices. The **Blackthistle family** remembered which herbs to burn, which words to speak, which nights required vigilance. They settled near the **Haunted Grove** (which has its own connection to the old power) and quietly did the work that kept Limwater safe.

The town didn't know. For generations, the Blackthistles were just a strange family who kept to themselves, and the Wethering stayed manageable.

Three generations ago, **Morwen Blackthistle** was accused of witchcraft and driven into the Grove. She disappeared. The last active practitioner of the old ways was gone.

The Wethering has been getting worse ever since—slowly enough that no single generation notices, but the fog comes more often now, stays longer, and the voices are clearer.

### Gregor's Theft

About a century after the drowning, the pirate **Gregor Silter** landed on Cairnwell Isle despite the warnings. He found the ruins and took something.

Not gold. An **object**—small, ancient, one of the original bindings made physical. Removing it weakened the structure keeping the Sleeper dormant. A crack in the foundation.

Gregor was hanged before he understood what he had. The object passed through inheritance, theft, and gambling debts. It's been circulating through Limwater ever since, bringing subtle wrongness to whoever possesses it: bad luck, strange dreams, obsession, violence.

The families who've held it don't discuss it. Some don't consciously know what they have. But it's still in Limwater, still weakening the bindings.

### The Present

The Sleeper is stirring. Not awake—not yet—but its dreams leak more freely:

- The Wethering is more frequent
- The Drowned Bell rings when no storm is coming
- Fishermen see lights on Cairnwell Isle
- Children draw pictures of "the lady in the fog"

The Church has old documents it doesn't fully understand. The Library has fragments that don't add up. The Grove holds residual power. And somewhere in town, Gregor's stolen object waits to be found.

The pieces are all there. No one's put them together yet.

---

## Surfacing the Mystery in Quests

No single quest reveals the full picture. Players encounter fragments and accumulate `know:` tags.

### Example Quest Hooks

| Quest Type | Fragment Revealed |
|------------|-------------------|
| Guardhouse investigation | Missing person last seen walking toward the bay in fog |
| Church fetch quest | Priest mentions bell "acting up"; requests herbs that appear in old warding texts |
| Tavern mystery | Family feud over inherited "worthless trinket"; current owner has string of misfortunes |
| Farmhouse errand | Farmer mentions grandmother left offerings at Grove edge; learned from *her* grandmother |
| Port trouble | Sailor refuses Cairnwell trips; his brother went there and came back "wrong" |
| Seamstress problem | Client talking in sleep in unknown language |
| Library research | Damaged text references "the compact" and "the bell's true purpose" |

### Potential Late-Game Quests

- Visit Cairnwell Isle directly
- Encounter a Blackthistle descendant who doesn't know their heritage
- The stolen object surfaces; players decide what to do with it
- The bell rings and something answers

### Design Principle

Players who collect `know:` tags across multiple quests see connections. Completionists realize the "worthless trinket," the "warding herbs," the "lady in the fog," and the "wrong brother" all point to the same buried history.

---

## Open Questions

These can be resolved as quests are written:

1. **Can players resolve the threat?** Or is the Sleeper's stirring simply backdrop that gives the world texture?

2. **What is the stolen object?** Its form should be mundane enough to pass unnoticed but distinctive enough to track across quests.

3. **Are there living Blackthistle descendants?** If so, do they know their heritage?

4. **What exactly is the Sleeper?** Keeping it undefined may be more effective than explaining it.

5. **What happened to Morwen?** Dead? Still in the Grove? Transformed into something else?

---

## Naming Reference

| Name | Type | Notes |
|------|------|-------|
| Limwater | Town | Named for chalky mineral deposits |
| The Silter | River | Possibly named for/by Gregor Silter |
| Grimsby Bay | Bay | Inlet of the Briarsea |
| The Briarsea | Sea | Larger body of water |
| The Briarsea March | Region | Coastal borderland; bramble hedgerows |
| Dawnhollow | Town | Market town; Baron's seat; two days north |
| Marram | Village | Fishing village; half day south; rival to Limwater |
| Cairnwell Isle | Island | Abandoned; visible from port; ruins of temple complex |
| The Wethering | Phenomenon | Fog from the bay; carries whispers; the Sleeper's dreams |
| The Sleeper | Entity | Ancient thing beneath/within Cairnwell; dreams leak as fog |
| The Drowned Bell | Object | Church bell; recovered from the drowning; rings as warning |
| Morwen Blackthistle | Person | Last practitioner; accused witch; disappeared three generations ago |
| Gregor Silter | Person | Pirate; stole binding object; hanged in Dawnhollow ~200 years ago |
| The Haunted Grove | Location | Connected to old power; where Morwen disappeared |
| The stolen object | Object | One of the original bindings; cursed; still circulating in Limwater |

---

## Version History

- **v1.0** — Initial specification created from collaborative worldbuilding session
