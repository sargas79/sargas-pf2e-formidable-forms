# Sargas PF2e Formidable Forms

A Foundry VTT module for the Pathfinder 2e system. When a character casts a battle-form spell, a picker opens, the
caster chooses the form, and the module applies the spell effect, shows the chosen creature's art on the token and
lets the form set the token size. When the effect ends or is removed, the token returns to its own image and size.

**The module ships no art.** It only knows which creature each form looks like. The images come from the art modules
you have installed, or from pictures you choose yourself.

## Requirements

- Foundry VTT **v14**
- Pathfinder 2e system **8.6.0 or later**
- Recommended, not required: an art module that registers creature art through Foundry's compendium art (see
  [Where the art comes from](#where-the-art-comes-from))

## Install

In Foundry, open **Add-on Modules → Install Module**, paste this manifest URL and press **Install**:

```
https://github.com/sargas79/sargas-pf2e-formidable-forms/releases/latest/download/module.json
```

Then enable **Sargas PF2e Formidable Forms** in your world (**Game Settings → Manage Modules**).

## What it does

- **Applies the form when the spell is cast.** Casting a battle-form spell (or the druid's Untamed Form) opens the
  picker for the player who cast it, or for the GM when an NPC casts. Choosing a form creates the spell effect on the
  caster at the rank the spell was cast, with no further prompt from the system. Cancel applies nothing.
- **Shows the creature on the token.** The effect carries the form's image. On tokens with the dynamic ring, only
  the picture inside the ring changes.
- **Leaves size to the system.** The PF2e battle form already sets the creature's size. The token follows it when
  _Link to actor size_ is on in the token's settings (the default for characters). If it is off, the module tells
  you why the token did not grow; it does not change the setting.
- **Reverts by itself.** Image and size are part of the effect. Deleting or dismissing it, letting it expire, or
  reloading the world all leave the token as it should be. Nothing is backed up or restored.
- **Replaces the previous form.** Casting a second battle form removes the first one's effect.
- **Works for effects applied by hand too.** An effect dragged from the spell's chat card or from the compendium, or
  granted by Untamed Form, gets the same art. Only casting opens the picker.

### The picker

- One card per form the cast rank allows, with the creature's art, the size the form has at that rank and its
  special Speeds (burrow, climb, fly, swim).
- A search box. Dragon Form's 40 dragons are grouped by tradition, and forms from before the remaster are listed
  apart as _Legacy forms_.
- Your last pick for each spell is remembered and preselected.
- Click a card and press **Transform**, or double-click the card.
- Spells with a single form (Elephant Form, Sacred Form, Primal Herd) skip the picker.
- **Untamed Form** has two steps: first the kinds of form the druid has unlocked through feats, then the creature.
- **Pest Form** has one set of statistics, so the picker only asks what the pest looks like.

## Settings

| Setting                        | Scope  | Default | What it does                                                                                                                  |
| ------------------------------ | ------ | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Apply battle forms on cast** | World  | On      | Opens the picker and applies the effect when a battle-form spell is cast. Off: apply effects by hand; they still get the art. |
| **Fade to the form's image**   | Client | On      | Fades the token to its new image. Read on the computer of whoever applies the form.                                           |
| **Form art** (button)          | GM     |         | Opens the Form Art manager.                                                                                                   |

### Form Art manager

**Game Settings → Configure Settings → Sargas PF2e Formidable Forms → Manage form art** (GM only).

It lists every form, grouped by spell, with the image it will show and where that image comes from: _Your image_,
_Art module_, _Compendium creature_ or _No image_. Press the file button on a row to choose your own image or video
for that form, and the reset button to go back to the automatic one. Your image is used the next time the form is
applied; tokens already transformed keep theirs until the effect is applied again.

## Where the art comes from

For each form the module uses the first image it finds:

1. **Your image**, set in the Form Art manager.
2. **An art module**: any module that registers art for PF2e compendium creatures through Foundry's compendium art
   mapping (**Configure Settings → Compendium Art**). The module asks Foundry for the art of the form's creature, so
   whatever you have enabled there is used.
3. **The compendium creature's own token**, when it is not one of the system's default icons.
4. **Nothing.** The token keeps its image, and the effect still applies.

The PF2e system's own compendiums ship without creature art, so with no art module and no images of your own you get
the effects and the picker, but tokens keep their image.

### Art licensing

This module contains no images, and installing it gives you none. It only reads art that is already on your Foundry
server.

`sargas-pf2-creature-images` is a private module for personal use. Its art is not licensed for redistribution: do not
copy it into this module, into a release of it, or anywhere else you share. The same goes for any other art you do
not have the right to distribute. To use your own pictures, put them in your Foundry user data and point to them from
the Form Art manager.

## Supported forms

Taken from the module's catalogue, which is generated from the PF2e system's compendiums. Forms marked \* have no
matching creature in the compendiums and show no image until you set one in the Form Art manager. _Legacy_ forms are
the pre-remaster spell effects that the system still includes.

<!-- forms:start -->

| Spell               | Rank | Forms                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aberrant Form       | 5    | Chuul, Gogiteth, Gug, Ofalth                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Aerial Form         | 4    | Bat, Bird, Pterosaur, Wasp                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Angel Form          | 7    | Balisse, Choral, Kuribu, Tennin, Monadic Deva (legacy), Movanic Deva (legacy)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Animal Form         | 2    | Ape, Bear, Bull, Canine, Cat, Crab, Crocodile, Deer, Frog, Orca, Seal, Shark, Snake                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Cosmic Form         | 7    | Moon\*, Sun\*                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Daemon Form         | 6    | Lacridaemon, Leukodaemon, Meladaemon, Venedaemon, Ceustodaemon (legacy), Piscodaemon (legacy)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Demon Form          | 6    | Abrikandilu, Brimorak, Kithangian, Vloriak, Babau (legacy), Hezrou (legacy), Nabasu (legacy), Vrock (legacy)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Devil Form          | 6    | Coarti, Levaloch, Sarglagon, Vordine, Barbazu (legacy), Erinys (legacy), Osyluth (legacy)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Devouring Dark Form | 1    | Tentacle, Shark, Water Elemental, Cave Worm, Sea Serpent                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Dinosaur Form       | 4    | Ankylosaurus, Brontosaurus, Deinonychus, Stegosaurus, Triceratops, Tyrannosaurus                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Dragon Form         | 6    | Adamantine Dragon, Barrage Dragon, Bog Dragon, Brine Dragon, Cinder Dragon, Cloud Dragon, Conspirator Dragon, Coral Dragon, Crystal Dragon, Delight Dragon, Despair Dragon, Diabolic Dragon, Empyreal Dragon, Executor Dragon, Forest Dragon, Fortune Dragon, Horned Dragon, Magma Dragon, Mirage Dragon, Mocking Dragon, Oath Dragon, Omen Dragon, Phase Dragon, Requiem Dragon, Resurrection Dragon, Rime Dragon, Rune Dragon, Sage Dragon, Sea Dragon, Sky Dragon, Sovereign Dragon, Stormcrown Dragon, Time Dragon, Umbral Dragon, Underworld Dragon, Vizier Dragon, Vorpal Dragon, Wailing Dragon, Whisper Dragon, Wish Dragon |
| Element Embodied    | 10   | Air, Earth, Fire, Metal, Water, Wood                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Elemental Form      | 5    | Air, Earth, Fire, Metal, Water, Wood                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Elephant Form       | 4    | Single form                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Fey Form            | 4    | Dryad, Elananx, Naiad, Redcap, Unicorn                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Insect Form         | 3    | Ant, Beetle, Centipede, Mantis, Scorpion, Spider                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Monstrosity Form    | 8    | Cave Worm, Phoenix, Sea Serpent, Kaiju (legacy, Untamed Form only)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Nature Incarnate    | 10   | Green Man, Kaiju                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Ooze Form           | 3    | Black Pudding, Gelatinous Cube, Gray Ooze, Ochre Jelly                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Pest Form           | 1    | Rat, Cat, Fox, Frog, Monkey, Snake, Weasel, Raven                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Plant Form          | 5    | Arboreal, Flytrap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Primal Herd         | 10   | Single form                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Sacred Form         | 6    | Single form\*                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

<!-- forms:end -->

Notes:

- Generic forms use a representative creature: Bear is a Grizzly Bear, Canine a Wolf, Cat a Tiger, Deer a Moose, Bird
  a Giant Eagle, and so on. The Form Art manager shows the creature for each form.
- Devouring Dark Form's _Tentacle_ is not a battle form, so it never changes the token.
- Monstrosity Form's _Kaiju_ is granted by the Heart of the Kaiju feat and is only available through Untamed Form.
- Dragon Form taken through Untamed Form shows the system's "already has this item" notice once. It is harmless.

## Limits

- Only spells and effects from the PF2e system's compendiums are recognised. A renamed copy of a spell still works as
  long as it was made from the compendium spell.
- The picker opens when a spell is actually cast. Sending a spell to chat without casting it does nothing.
- The picker opens for whoever cast the spell. If that user cannot edit the caster, nothing is applied.

## Development

```
npm install
npm run lint          # ESLint
npm run format:check  # Prettier
npm test              # node:test, offline
npm run build         # copy module/ to dist/sargas-pf2e-formidable-forms/
npm run package       # build, then zip to dist/ with dist/module.json
```

`module/` is the module as Foundry loads it. Logic that does not need Foundry lives in plain functions
(`catalogue.mjs`, `art.mjs`, `cast.mjs`, `token-image.mjs`, `picker-logic.mjs`, `overrides.mjs`, `predicate.mjs`) and
is unit tested with plain objects. What can only be checked in a running Foundry is listed in
[docs/TESTING.md](docs/TESTING.md).

### The form catalogue

`module/data/forms.json` is generated. Do not edit it by hand.

```
npm run check:pf2e    # compare the catalogue with the current PF2e source (network)
npm run fetch:pf2e    # refresh scripts/data/pf2e-snapshot.json at the pinned PF2e commit (network)
npm run build:forms   # regenerate module/data/forms.json from the snapshot (offline)
npm run readme:forms  # write the table above into this file
```

- `scripts/data/pf2e-snapshot.json` is the part of the PF2e packs the catalogue is built from, committed so the build
  and the tests run offline. The commit it was taken from is `PF2E_REF` in `scripts/lib/pf2e.mjs`.
- `scripts/data/form-config.json` says which creature stands for each form, which forms have none, and Pest Form's
  cosmetic choices.
- A test fails when the snapshot has a form choice the catalogue does not list. After a PF2e update, run
  `npm run check:pf2e`; if it reports differences, set `PF2E_REF` to the new commit, run `npm run fetch:pf2e`, add
  creatures for the new forms to the config, and run `npm run build:forms` and `npm run readme:forms`.

### Releasing

Set the version in `module/module.json` (also in its `download` URL) and `package.json`, add the notes to
`CHANGELOG.md`, and push a tag `v<version>`. The release workflow checks the code, builds the package and attaches
`module.json` and `sargas-pf2e-formidable-forms.zip` to the GitHub release for that tag.

## License

MIT. See [LICENSE](LICENSE). Pathfinder and its creatures are the property of Paizo Inc.; this module contains no
Paizo art or text.
