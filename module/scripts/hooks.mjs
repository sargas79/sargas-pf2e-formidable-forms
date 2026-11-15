// Foundry hooks for the token art. Any way a form effect reaches an actor ends in `preCreateItem`: the module's own
// picker, the link on the spell's chat card, a drag from the compendium, and the effect Untamed Form grants.
//
// Order of events, from ItemPF2e.createDocuments in the PF2e system: the system first runs its rule elements'
// `preCreate` (the ChoiceSet prompt, GrantItem), then calls Foundry's createDocuments, which fires this hook. So the
// chosen form is already in the effect's source when the hook reads it.
import { artEnvironment, tokenFor } from './art-env.mjs';
import { findReplacedFormEffectIds } from './cast.mjs';
import { deriveForm, findEffectEntry, sizeAtRank } from './catalogue.mjs';
import { I18N, MODULE_ID } from './constants.mjs';
import { catalogue } from './data.mjs';
import { SETTING, getSetting } from './settings.mjs';
import { planTokenImage } from './token-image.mjs';

/** Actors already warned about their token size in this session. */
const warnedAboutSize = new Set();

/**
 * Items this client created that have not been looked at yet, by actor UUID. Foundry reports the documents of one
 * create operation one after the other; they are collected here and handled together once all have arrived.
 * @type {Map<string, { actor: Actor, created: Set<string>, byHand: boolean }>}
 */
const createdItems = new Map();

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
 * Battle forms don't stack. The cast handler removes the old form before it creates the new one; a form applied by
 * hand (chat-card link, drag and drop, compendium) arrives here instead, and the old form is removed afterwards.
 */
function trackCreatedItem(item, options) {
  const actor = item.actor;
  let batch = createdItems.get(actor.uuid);
  if (!batch) {
    batch = { actor, created: new Set(), byHand: false };
    createdItems.set(actor.uuid, batch);
    // After the current operation's documents have all been reported.
    setTimeout(() => replaceOtherForms(actor.uuid), 0);
  }
  batch.created.add(item.id);
  // Effects the cast handler created are marked: it has already made room for them.
  const applied = options?.[MODULE_ID]?.applied === true;
  if (!applied && item.type === 'effect' && findEffectEntry(catalogue, item._source)) batch.byHand = true;
}

async function replaceOtherForms(actorUuid) {
  const batch = createdItems.get(actorUuid);
  createdItems.delete(actorUuid);
  if (!batch?.byHand) return;
  const { actor, created } = batch;
  try {
    const effects = actor.items.filter((item) => item.type === 'effect' || created.has(item.id));
    const replaced = findReplacedFormEffectIds(
      effects.map((item) => item.toObject()),
      catalogue,
      [...created],
    ).filter((id) => actor.items.has(id));
    if (replaced.length) await actor.deleteEmbeddedDocuments('Item', replaced);
  } catch (error) {
    console.error(`${MODULE_ID} | Could not remove the previous battle form`, error);
  }
}

/**
 * The system resizes the token with the form only while the token's "Link to actor size" is on. This module leaves
 * that choice alone, and tells the user who applied the effect why the token did not grow.
 */
function warnAboutSize(item, options) {
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

/** Runs on the client of the user who created the item. */
function onCreateItem(item, options, userId) {
  if (userId !== game.user.id || !item.actor) return;
  trackCreatedItem(item, options);
  if (item.type === 'effect') warnAboutSize(item, options);
}

export function registerTokenImageHooks() {
  Hooks.on('preCreateItem', onPreCreateItem);
  Hooks.on('createItem', onCreateItem);
}
