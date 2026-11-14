# Sargas PF2e Formidable Forms — Plan

A Foundry VTT v14 module for the PF2e system. When a character casts a battle-form spell, a picker opens, the
player (or GM) picks the form, and the module applies the spell effect, swaps the token art for the chosen creature
and lets the form set the token size. When the effect ends or is removed, the token returns to its normal image and
size.

Status: **draft, waiting for approval.** Nothing is implemented yet.

## Decisions so far

| Topic | Decision |
| --- | --- |
| Foundry / PF2e | Foundry **v14 only**, PF2e **8.6.0+** (same as `sargas-pf2-creature-images`) |
| Scope | All **battle-form spells** plus the druid's **Untamed Form** |
| Trigger | Casting opens the picker automatically; picking a form applies the effect; Cancel applies nothing. Effects applied by hand (from the chat card, compendium or Untamed Form) also get the art. |
| Art sources | 1. GM overrides in a settings screen. 2. Bestiary art through Foundry's compendium art mapping (this picks up `sargas-pf2-creature-images`, Paizo's token packs or any other art module). 3. The effect's own icon as the last fallback. |
| Tooling | Same as `sargas-pf2-creature-images`: plain ESM `.mjs`, ESLint, Prettier, `node:test`, build/package scripts, GitHub Actions release |
| Models | Planning: Opus 5.5 · GitHub issues: Haiku 5.5 · Implementation: Fable 5.2 |

## What the PF2e system already does (and what this module adds)

Research against `foundryvtt/pf2e` (branch `v14-dev`):

- **Form choice already exists.** Most battle-form effects carry a `ChoiceSet` rule (Dragon Form: 40 dragon types,
  Animal Form: 13 animals, Aerial Form: bat/bird/pterosaur/wasp, …). The system shows its own plain prompt when the
  effect is created. If a rule's `selection` is already set in the source, the system skips its prompt
  (`#getPreselection`). The chosen value lands in `flags.system.rulesSelections.<flag>`.
- **Some spells use separate effects per form** instead of a choice: Dinosaur Form (6 effects), and the heightened
  variants of Demon/Devil/Daemon/Angel Form, Element Embodied (6 effects) and Monstrosity Form (Kaiju).
- **Size is handled already.** The `BattleForm` rule sets the creature size (`overrides.size`, per heightened rank).
  The token follows the actor size when the token's *Link to actor size* flag is on (`flags.pf2e.linkToActorSize`,
  on by default for PCs). This is derived data, so it reverts by itself when the effect goes away.
- **The token image is the missing piece.** None of the form effects change the token image. The system has a
  `TokenImage` rule element (texture, scale, tint, dynamic-ring subject, transition animation). It is also derived
  data: **removing the effect automatically restores the original image.** No backup or restore code is needed, and
  reloads, expiring durations, Dismiss and manual deletion all behave the same way.
- **Casting doesn't apply the effect.** The spell chat card only links the effect. The player must drag or click it.
- **Untamed Form** is a `ChoiceSet` over the forms the druid knows (`flags.system.wildShapeForms`). That choice then
  grants the matching spell effect (Animal Form, Insect Form, …), whose own `ChoiceSet` asks for the specific creature.

So the module adds three things: the **auto-apply on cast**, a **better picker with art**, and **injecting a
`TokenImage` rule** with the right art into the effect.

## Supported forms

| Effect | Form choices |
| --- | --- |
| Aberrant Form | Chuul, Gogiteth, Gug, Ofalth |
| Aerial Form | Bat, Bird, Pterosaur, Wasp |
| Angel Form (+ Monadic Deva, Movanic Deva) | Balisse, Choral, Kuribu, Tennin |
| Animal Form | Ape, Bear, Bull, Canine, Cat, Crab, Crocodile, Deer, Frog, Orca, Seal, Shark, Snake |
| Cosmic Form | Moon, Sun |
| Daemon Form (+ Ceustodaemon, Piscodaemon) | Lacridaemon, Leukodaemon, Meladaemon, Venedaemon |
| Demon Form (+ Babau, Hezrou, Nabasu, Vrock) | Abrikandilu, Brimorak, Kithangian, Vloriak |
| Devil Form (+ Barbazu, Erinys, Osyluth) | Coarti, Levaloch, Sarglagon, Vordine |
| Devouring Dark Form | Tentacle, Shark, Elemental, Cave Worm, Sea Serpent |
| Dinosaur Form | Ankylosaurus, Brontosaurus, Deinonychus, Stegosaurus, Triceratops, Tyrannosaurus (separate effects) |
| Dragon Form | 40 dragon types (Adamantine … Wish) |
| Element Embodied | Air, Earth, Fire, Metal, Water, Wood (separate effects) |
| Elemental Form | Air, Earth, Fire, Metal, Water, Wood |
| Elephant Form | single form |
| Fey Form | Dryad, Elananx, Naiad, Redcap, Unicorn |
| Insect Form | Ant, Beetle, Centipede, Mantis, Scorpion, Spider |
| Monstrosity Form (+ Kaiju) | Cave Worm, Phoenix, Sea Serpent |
| Nature Incarnate | Green Man, Kaiju |
| Ooze Form | Black Pudding, Gelatinous Cube, Gray Ooze, Ochre Jelly |
| Pest Form | single form (the picker offers cosmetic art choices: rat, cat, bird, …) |
| Plant Form | Arboreal, Flytrap |
| Sacred Form | single form |
| Untamed Form | any of the above that the druid has unlocked |

### Art coverage from `sargas-pf2-creature-images`

Checked against that module's portrait list:

- **Full match:** all 40 dragon types, all Dinosaur, Angel, Devil, Fey and Daemon forms (except Piscodaemon), Demon
  forms (except Nabasu), Aberrant (Gogiteth via its elite/mythic variant), Insect (giant ant, stag beetle, centipede,
  mantis, scorpion, spider), Elephant, Phoenix, Sea Serpent, Cave Worm, Green Man, Black Pudding, Gelatinous Cube.
- **Generic categories mapped to a representative creature:** Bear → Grizzly Bear, Canine → Wolf, Cat → Tiger,
  Ape → Gorilla, Bull → Aurochs, Crab → Giant Crab, Frog → Giant Frog, Seal → Leopard Seal, Shark → Great White
  Shark, Snake → Giant Viper, Bat → Giant Bat, Bird → Giant Eagle, Pterosaur → Pteranodon, Wasp → Giant Wasp,
  Elemental Form → Living Whirlwind / Landslide / Wildfire / Waterfall, Flytrap → Giant Flytrap, Arboreal →
  Arboreal Warden.
- **No art found (falls back to the effect icon until the GM sets one):** Deer, Cosmic Form Sun/Moon, Kaiju,
  Piscodaemon, Nabasu, Gray Ooze, Metal and Wood elementals (to be checked during implementation).

The catalogue stores **compendium actor UUIDs**, not file paths, so any art module that uses Foundry's compendium art
mapping works, not just yours.

## How it works

### 1. Cast detection

- Hook `createChatMessage`. React only when the message is a spell cast (`flags.pf2e.context.type`), the spell's
  slug is in the catalogue, and **this client wrote the message** (so only one person sees the picker: the player
  who cast, or the GM for NPCs).
- Read the cast rank and the spellcasting entry (tradition) from the message's origin data.
- Setting to turn auto-apply off.

### 2. Form picker (ApplicationV2 dialog)

- Grid of cards: creature art, form name, resulting size, and the main movement types (fly/swim/burrow/climb).
- Search box (needed for 40 dragons), with dragons grouped by tradition.
- Options that need a higher rank are hidden (heightened Demon/Devil/Daemon/Angel/Dinosaur variants), so the
  player only sees forms the cast rank allows.
- The actor's last pick is preselected.
- Untamed Form: two steps (spell form → creature), limited to the forms the druid has unlocked.
- Single-form effects (Elephant, Sacred, Element Embodied variant chosen) skip the picker.

### 3. Applying the effect

- Load the effect from the compendium and set the cast rank (`system.level.value`) and origin context like the
  system does when you drag the effect from the chat card. This matters because some rules check it, for example
  Dragon Form's resistances check `parent:spellcasting:tradition:*`.
- Pre-fill the `ChoiceSet` `selection` with the pick so the system's own prompt does not show.
- Replace an existing effect of the same spell instead of stacking (battle forms don't stack anyway).

### 4. Token art (any creation path)

- Hook `preCreateItem` for effects in the catalogue, whether the module, the chat-card link or Untamed Form's grant
  created them. Read the selection and add a `TokenImage` rule to the effect source:
  - `value`: the resolved image.
  - `ring.subject.texture` instead, only when the actor's token already uses the dynamic ring. The rule would
    otherwise switch the ring on.
  - A short fade transition (`animation`).
- When the effect is removed, the system drops the rule and the token returns to normal on its own.

### 5. Art resolution (first hit wins)

1. GM override for that form (world setting).
2. `game.compendiumArt.get(<creature UUID>)` (your module, Paizo token packs, others).
3. The compendium creature's own token image, if it is not a PF2e default icon.
4. No image change (the effect icon is still shown on the token's status).

### 6. Size

- Handled by the system's `BattleForm` rule. If the token's *Link to actor size* is off, the module shows a one-time
  warning to the token's owner explaining why the size didn't change. It does not flip the flag on its own.

### 7. Settings

- **Auto-apply on cast** (world, on).
- **Form art** menu (GM): the catalogue grouped by spell, each row showing the resolved image and its source
  (override / art module / compendium / none), a file picker to override it, and a reset button.
- **Transition animation** (client, on/off).

## Proposed GitHub issues

Each one is a separate issue, to be done in this order:

1. **Scaffold the module.** `module.json` (v14, PF2e 8.6.0+), `lang/en.json`, ESLint/Prettier/`node:test`, build and
   package scripts, CI and release workflows modelled on `sargas-pf2-creature-images`.
2. **Form catalogue.** `forms.json`: every supported effect UUID, its `ChoiceSet` flag and values, rank gating and
   the representative creature UUID. A generator script reads the PF2e packs. A test fails if a PF2e update adds a
   form choice the catalogue doesn't know.
3. **Art resolver.** The resolution order above, with unit tests for each fallback and the ring/no-ring case.
4. **Token image injection.** The `preCreateItem` hook that adds the `TokenImage` rule. Covers manual apply and
   Untamed Form grants. Check that image and size revert on delete, expiry and reload.
5. **Cast detection and auto-apply.** The `createChatMessage` hook, author-only, building the effect with cast rank,
   origin context and the preselected choice, replacing an existing form.
6. **Form picker dialog.** ApplicationV2 cards with art, search, rank gating, last-pick memory and the Untamed Form
   two-step flow.
7. **Settings and Form Art manager.** The settings and GM override screen.
8. **Docs and first release.** README, `docs/TESTING.md` manual test checklist, v0.1.0 release.

## Risks and open points

- **Effect origin context.** The exact source shape the system builds when an effect is applied from a spell must be
  copied faithfully. Issue 5 starts by reading the system's code for it.
- **Hook order.** Assumes the system's `ChoiceSet` prompt resolves before Foundry's `preCreateItem` hook fires, so
  the selection can be read there. To be confirmed in issue 4. The fallback is `createItem` plus an update of the
  rules.
- **Unlinked tokens** (NPCs placed from the same actor): the rule applies per token actor, which is correct, but
  needs testing.
- **Art module licensing.** `sargas-pf2-creature-images` art is personal use only. This module ships **no art**, only
  creature references, so it can be public.
