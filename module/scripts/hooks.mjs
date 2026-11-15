// Foundry hooks for the token art. Any way a form effect reaches an actor ends in `preCreateItem`: the module's own
// picker, the link on the spell's chat card, a drag from the compendium, and the effect Untamed Form grants.
//
// Order of events, from ItemPF2e.createDocuments in the PF2e system: the system first runs its rule elements'
// `preCreate` (the ChoiceSet prompt, GrantItem), then calls Foundry's createDocuments, which fires this hook. So the
// chosen form is already in the effect's source when the hook reads it.
import { artEnvironment, tokenFor } from './art-env.mjs';
import { deriveForm, findEffectEntry, sizeAtRank } from './catalogue.mjs';
import { I18N, MODULE_ID } from './constants.mjs';
import { catalogue } from './data.mjs';
import { SETTING, getSetting } from './settings.mjs';
import { planTokenImage } from './token-image.mjs';

/** Actors already warned about their token size in this session. */
const warnedAboutSize = new Set();

/** Adds the TokenImage rule to a form effect that is about to be created on an actor. */
function onPreCreateItem(item, _data, options) {
  if (item.type !== 'effect' || !item.actor) return;
  const hints = options?.[MODULE_ID];
  const plan = planTokenImage(catalogue, item.toObject(), {
    // The cast handler says which token cast the spell; otherwise the actor's most specific token is used.
    ...artEnvironment(item.actor, { token: hints?.token }),
    // The picker passes the form for effects it does not create itself (the one Untamed Form grants).
    hints: hints?.forms,
    animate: getSetting(SETTING.TRANSITION),
  });
  if (plan) item.updateSource(plan.update);
}

/**
 * The system resizes the token with the form only while the token's "Link to actor size" is on. This module leaves
 * that choice alone, and tells the user who applied the effect why the token did not grow.
 */
function onCreateItem(item, options, userId) {
  if (userId !== game.user.id || item.type !== 'effect' || !item.actor) return;
  const source = item.toObject();
  const entry = findEffectEntry(catalogue, source);
  const form = entry && deriveForm(entry, source);
  if (!form || sizeAtRank(form, source.system?.level?.value ?? 0) === null) return;

  const actor = item.actor;
  const token = tokenFor(actor, options?.[MODULE_ID]?.token);
  const linked = token?.flags?.[catalogue.system]?.linkToActorSize;
  if (linked !== false || warnedAboutSize.has(actor.uuid)) return;
  warnedAboutSize.add(actor.uuid);
  ui.notifications.warn(game.i18n.format(`${I18N}.Notify.SizeNotLinked`, { name: token.name || actor.name }));
}

export function registerTokenImageHooks() {
  Hooks.on('preCreateItem', onPreCreateItem);
  Hooks.on('createItem', onCreateItem);
}
