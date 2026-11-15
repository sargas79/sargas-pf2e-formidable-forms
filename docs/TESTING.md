# Testing

## Automated

```
npm run lint
npm run format:check
npm test
```

The unit tests run offline in Node, with plain objects in place of Foundry documents. They cover:

- the catalogue: that it is reproducible from the PF2e snapshot, covers every form choice in it, and reports choices
  PF2e adds or removes (`test/forms.test.mjs`);
- the catalogue lookups, rank gating and predicates (`test/catalogue.test.mjs`, `test/predicate.test.mjs`);
- the art resolver's order of sources and the dynamic ring case (`test/art.test.mjs`);
- the `TokenImage` rule that is added to an effect, and that it is never added twice (`test/token-image.test.mjs`);
- cast detection, the effect source (rank, origin context, preselected choice) and the Untamed Form plan
  (`test/cast.test.mjs`);
- the picker's filter, grouping and opening state (`test/picker.test.mjs`);
- the override read and write functions and the Form Art rows (`test/overrides.test.mjs`);
- the manifest, the language file and the README's form list.

`npm run check:pf2e` (network) compares the catalogue with the current PF2e source.

## Manual checks in Foundry

None of the following can run in Node: they need Foundry VTT v14 with the PF2e system 8.6.0 or later. **Nothing in
this list has been run yet for v0.1.0.** The module was written against the PF2e source (`v14-dev`) without a
Foundry server, so every item is a real check, not a formality.

### Setup

- A world with the PF2e system, this module enabled, and at least one art module that registers compendium art
  (for example `sargas-pf2-creature-images`), switched on in **Configure Settings → Compendium Art**.
- A scene with tokens for:
  - **Caster A**: a character with Animal Form, Dragon Form, Demon Form, Elephant Form, Pest Form, Dinosaur Form and
    Devouring Dark Form available at several ranks. A linked token **without** the dynamic ring.
  - **Caster B**: a character whose token has the **dynamic ring** on.
  - **Druid**: a druid of level 12 or more with Untamed Form and the feats Insect Shape, Ferocious Shape, Soaring
    Shape and Dragon Shape.
  - **NPC**: a spellcasting NPC with a battle-form spell, with **two unlinked tokens** placed from it.
- A second browser logged in as a player who owns Caster A, next to the GM's.
- Keep the console open (F12). No step should log an error from the module or the system.

### 1. Loading (#1)

- [ ] The module loads with no console error. The console shows `sargas-pf2e-formidable-forms | Loaded`.
- [ ] With the module enabled and nothing cast, nothing in the world changes.
- [ ] The zip from the GitHub release installs through the manifest URL, and the installed module loads.

### 2. Token image on effects applied by hand (#4)

- [ ] Drag **Spell Effect: Animal Form** from the compendium onto Caster A. The system's prompt asks for the
      animal. After choosing, the token shows that creature's art.
- [ ] Cast Animal Form with auto-apply **off**, then drag the effect link from the chat card onto the token. Same
      result, and the effect has the cast rank.
- [ ] Do the same on Caster B. The token **keeps its ring**; only the picture inside it changes. The ring is not
      switched on for Caster A.
- [ ] Delete the effect: the token image returns to the original **immediately**.
- [ ] Apply again and use the effect's **Dismiss** (right-click on the effect panel): image returns.
- [ ] Apply again with a combat running and let the duration **expire**: image returns when the effect is removed
      (or when it is shown as expired, depending on the system's "remove expired effects" setting).
- [ ] Apply again and **reload** the world (F5): the form's image is still shown. Delete the effect: image returns.
- [ ] **Size**: at a rank where the form is Large or bigger, the token grows while the effect is on and returns to
      its size afterwards. The module has no size code; this confirms the system does it.
- [ ] Turn **Link to actor size** off in the token's settings and apply a form that changes size: a warning explains
      why the token did not grow. It appears once per actor per session, only for the user who applied the effect.
- [ ] Apply the same effect twice (drag it again while one is active): the first effect is removed, and the one
      that stays has **one** `TokenImage` rule (open the effect's Rules tab), not two.
- [ ] With Animal Form active, drag **Dragon Form** onto the token by hand: Animal Form is removed once Dragon Form
      is created, and its granted Dragon Breath action stays. Cancelling the system's prompt leaves Animal Form on.
- [ ] With an Untamed Form (and its granted form) active, drag another form by hand: both old effects are removed.
      Drag **Spell Effect: Untamed Form** by hand onto an actor with a form: the old form goes, and the new Untamed
      Form effect and the form it grants both stay.
- [ ] Duplicate an owned form effect to another actor's sheet (drag between sheets): the copy has one rule, written
      for the new actor's token.
- [ ] Drag an effect that is not a battle form (for example Spell Effect: Bless): it has no `TokenImage` rule.
- [ ] Apply Devouring Dark Form and choose **Tentacle**: the token keeps its image.
- [ ] Apply a form with no art (Cosmic Form, or any form with the art module switched off): the effect applies and
      the token keeps its image.
- [ ] **Unlinked tokens**: apply a form to one of the NPC's two tokens. Only that token changes. Apply a different
      form to the other: each shows its own. Delete one effect: only that token reverts.
- [ ] The **transition**: the image fades in. With the client setting off, it changes at once (see 5).

### 3. Cast detection and auto-apply (#5)

- [ ] As the player, cast Animal Form from Caster A's sheet. The picker opens **for the player only**, not for the
      GM. After picking, one effect is on the actor, and the **system's own prompt does not appear**.
- [ ] As the GM, cast a battle-form spell from the NPC: the picker opens for the GM only.
- [ ] The effect's level is the rank the spell was cast at. Cast Animal Form heightened to rank 4: the form is Large.
- [ ] **Dragon Form** from a primal caster, choosing a primal dragon (Adamantine): the effect grants resistance 5 to
      physical damage. From an arcane caster with an arcane dragon: resistance 5 to spells. This shows the origin
      context is right (the rules test `parent:spellcasting:tradition:*`). The dragon breath action is granted.
- [ ] The effect shows the caster as its origin (hover the effect), and it counts as "from spell".
- [ ] **Cancel** (the button, or closing the window): no effect is created, and the previous form stays.
- [ ] Cast Animal Form, then Dragon Form: the Animal Form effect is gone, only Dragon Form is active.
- [ ] Turn **Apply battle forms on cast** off: a cast opens nothing and creates nothing.
- [ ] Cast a spell that is not a battle form (Fireball), roll a Strike, post an item to chat: nothing happens.
- [ ] Use a spell's "send to chat" without casting: nothing happens.
- [ ] Cast a battle-form spell from a **scroll or wand**, and from a **staff**: note whether the picker opens and
      whether the origin context is right. (Expected to work, since those casts post the same message; not verified.)
- [ ] Cast as a player who does not own the caster (through a macro, if possible): nothing is applied and there is
      no error.

### 4. The picker (#6)

- [ ] Dragon Form shows 40 dragons under four headings (Arcane, Divine, Occult, Primal). Typing in the search box
      narrows the list; headings with no match disappear; a search with no match shows the "no form matches" line.
- [ ] Each card shows the art (or the effect's icon when there is none), the name, the size at the cast rank and
      icons for burrow, climb, fly and swim Speeds, with tooltips.
- [ ] Demon Form at rank 6 shows Abrikandilu, Brimorak, Kithangian and Vloriak, and Babau, Hezrou, Nabasu and Vrock
      under **Legacy forms**. Picking a legacy form applies its own effect.
- [ ] Devouring Dark Form at rank 1 applies Tentacle without a dialog (only one choice). At rank 2 the dialog offers
      Tentacle and Shark; at rank 5 also Water Elemental. Cave Worm and Sea Serpent need the feats as well as rank 8.
- [ ] Dinosaur Form offers six dinosaurs, and Element Embodied six elements, each applying its own effect.
- [ ] Elephant Form, Sacred Form and Primal Herd apply **without** a dialog.
- [ ] Pest Form asks what the pest looks like; the choice only changes the art. Raven appears from rank 4.
- [ ] Pick Frog for Animal Form. Cast Animal Form again: **Frog is preselected** and scrolled into view. Another
      actor has its own memory.
- [ ] Click a card, then **Transform**; double-click a card; focus a card and press Enter. All three apply it.
      Transform is disabled until a card is selected.
- [ ] **Untamed Form** (Druid): the first step shows the kinds of form the druid has unlocked (Pest Form, Animal
      Form, Insect Form, Dinosaur Form, Aerial Form, Dragon Form). Choosing one shows its creatures; **Back** returns.
- [ ] Untamed Form, Animal Form, Bear: one **Untamed Form** effect and one **Animal Form** effect, linked (deleting
      either removes both), no system prompt, the bear's art on the token, and the +2 status bonus rule present.
- [ ] Untamed Form, Aerial Form: Pterosaur appears only with Ferocious Shape, Wasp only with Insect Shape.
- [ ] Untamed Form, **Dragon Form**: both effects are created and linked (deleting either removes both), the dragon
      type is the one picked, and there is no system prompt for the dragon. An "already has" notice appears once.
      If the druid has Dragon Shape, the system's own resistance prompt for Untamed Form may appear; that is the
      system's.
- [ ] Untamed Form, Pest Form, Cat: the granted Pest Form effect shows the cat's art.
- [ ] A druid with only Pest Form unlocked (level 1) goes straight to the pest list.
- [ ] A character with the Untamed Form spell but no unlocked forms gets a "no form available" warning.
- [ ] **Phone width**: open the picker in a window about 380 px wide (or on a phone). The cards reflow, the list
      scrolls vertically, there is **no horizontal scrolling**, and the buttons stay reachable.

### 5. Settings and Form Art manager (#7)

- [ ] **Configure Settings → Sargas PF2e Formidable Forms** shows "Apply battle forms on cast" and "Fade to the
      form's image" with their hints, and the **Manage form art** button.
- [ ] As a player, the Manage form art button is **not shown**, and "Apply battle forms on cast" cannot be changed.
- [ ] Turn "Apply battle forms on cast" off: the next cast applies nothing (see 3).
- [ ] Turn "Fade to the form's image" off on one client: the next form applied **from that client** changes the image
      without a fade. On again: it fades.
- [ ] The Form Art window lists the forms grouped by spell. Each row shows the image and the right source: _Art
      module_ for creatures the art module covers, _No image_ (faded effect icon) for those it does not.
- [ ] The search box filters by form and by spell name.
- [ ] Press the file button on a row and choose an image: the row shows it with source **Your image**, and the reset
      button becomes available. Apply that form: the token shows the chosen image.
- [ ] Choose a **video** (webm) for a form and apply it to Caster A: the token plays it. On Caster B (ring token) the
      video replaces the token texture and the ring stays on.
- [ ] Press reset: the row returns to its automatic image and source. Apply the form: the automatic image is used.
- [ ] Set an override for Cosmic Form (no creature): the form now shows that image.
- [ ] Switch the art module off in Compendium Art and reopen the window: rows fall back to _Compendium creature_ or
      _No image_.

### 6. Other

- [ ] Two players cast at the same time: each gets their own picker and their own effect.
- [ ] A world without the module's art sources (no art module, no overrides) works with no error.
- [ ] After disabling the module, existing form effects keep their `TokenImage` rule (it is the system's) and still
      revert when removed.
