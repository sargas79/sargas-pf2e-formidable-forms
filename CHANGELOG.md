# Changelog

## 0.1.0

First release. For Foundry VTT v14 and the Pathfinder 2e system 8.6.0 or later.

- **Form picker on cast.** Casting a battle-form spell or the druid's Untamed Form opens a picker for the caster,
  with a card for each form the cast rank allows: the creature's art, the resulting size and its special Speeds.
  It has a search box, groups Dragon Form's 40 dragons by tradition, remembers your last pick, and takes two steps
  for Untamed Form.
- **The effect is applied for you**, at the rank the spell was cast and with the caster as its origin, without the
  system's own prompt. A new form replaces the previous one. Cancel applies nothing.
- **Token art.** The form's image is shown on the token while the effect lasts, and the token returns to its own
  image when the effect is removed, dismissed or expires. Tokens with the dynamic ring keep their ring. Effects
  applied by hand, from the chat card or the compendium, get the art too.
- **Token size** is left to the PF2e system's battle form, which follows the token's _Link to actor size_ setting.
- **Art sources.** Your own image for a form, then any art module that uses Foundry's compendium art, then the
  compendium creature's token. The module ships no art.
- **Form Art manager** for the GM: see the image of every form and where it comes from, and set or reset your own.
- **Settings**: apply battle forms on cast (world), fade to the form's image (client).
- Supports 23 spells and 147 forms from the PF2e compendiums; see the README for the list.
