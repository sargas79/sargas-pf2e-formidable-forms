// Applies a battle form when its spell is cast: the Foundry side of cast.mjs.
import { creatureTokensReady } from './art-env.mjs';
import { findForm } from './catalogue.mjs';
import { buildEffectSource, buildOriginContext, findFormEffectIds, parseCast, planUntamedForm } from './cast.mjs';
import { I18N, MODULE_ID } from './constants.mjs';
import { catalogue } from './data.mjs';
import { pickForm } from './form-picker.mjs';
import { SETTING, getSetting } from './settings.mjs';

/**
 * The origin context for an effect applied from a spell's chat message, read the way the system's drag handler
 * reads it (scripts/system/dragstart-handler.ts).
 */
function contextFromMessage(message, actor, spell) {
  const entry = spell?.spellcasting;
  const spellcasting = entry
    ? {
        attribute: { type: spell.attribute, mod: entry.statistic?.attributeModifier?.value ?? 0 },
        tradition: entry.tradition ?? null,
      }
    : null;
  return buildOriginContext({
    actor: actor.uuid,
    token: (message.token ?? actor.token)?.uuid ?? null,
    item: spell?.uuid ?? null,
    spellcasting,
    rollOptions: message.flags[catalogue.system]?.origin?.rollOptions ?? spell?.getOriginData?.().rollOptions ?? [],
  });
}

/** The spell's traits an effect may carry; the system copies them onto effects that have none. */
function effectTraits(spell) {
  const valid = CONFIG.PF2E?.effectTraits ?? {};
  return (spell?.system?.traits?.value ?? []).filter((trait) => trait in valid);
}

async function compendiumSource(uuid) {
  const document = await fromUuid(uuid);
  if (!document) throw new Error(`${uuid} is not in the compendium`);
  return document.toObject();
}

/**
 * Creates the chosen form's effect on the caster, replacing any battle form already there.
 * @param {Actor} actor The caster
 * @param {object} choice What `pickForm` returned
 * @param {object} cast What `parseCast` returned
 * @param {object} origin
 * @param {ChatMessage} origin.message The cast message
 * @param {Item | null} origin.spell The spell that was cast
 */
export async function applyForm(actor, choice, cast, { message, spell }) {
  const found = findForm(catalogue, choice.formKey);
  if (!found) return;
  const { effect: entry, form } = found;
  const context = contextFromMessage(message, actor, spell);
  const traits = effectTraits(spell);
  const { castRank } = cast;

  // Load everything before touching the actor, so a failure leaves the current form in place. That includes the
  // pack indexes the token image hook reads creature tokens from: it runs synchronously and cannot wait for them.
  await creatureTokensReady();
  const formSource = await compendiumSource(entry.uuid);
  const steps = choice.untamedValue
    ? planUntamedForm({
        catalogue,
        untamedSource: await compendiumSource(catalogue.untamed.effect),
        formSource,
        entry,
        form,
        untamedValue: choice.untamedValue,
        castRank,
        context,
        traits,
        untamedId: foundry.utils.randomID(),
      })
    : [{ sources: [buildEffectSource(formSource, { entry, form, castRank, context, traits })], operation: {} }];

  // Battle forms don't stack. The system deletes effects linked by a grant together with their partner.
  const existing = findFormEffectIds(
    actor.items.filter((item) => item.type === 'effect').map((item) => item.toObject()),
    catalogue,
  );
  if (existing.length) await actor.deleteEmbeddedDocuments('Item', existing);

  // Tell the token image hook which token cast the spell: its ring settings decide how the art is written.
  const token = message.token?.uuid ?? null;
  for (const { sources, operation } of steps) {
    // `applied` tells the createItem hook that room was already made for these effects.
    const hints = { ...operation[MODULE_ID], token, applied: true };
    await actor.createEmbeddedDocuments('Item', sources, { ...operation, [MODULE_ID]: hints });
  }
}

/** Reacts to a chat message this client created: a cast of a catalogue spell opens the picker. */
async function onCreateChatMessage(message, _options, userId) {
  // Only the client that wrote the message handles it, so one person gets the picker and one effect is created.
  if (userId !== game.user.id || !getSetting(SETTING.AUTO_APPLY)) return;
  if (!message.flags?.[catalogue.system]?.origin) return;

  const spell = message.item ?? null;
  const cast = parseCast({ flags: message.flags }, catalogue, { slug: spell?.slug, sourceId: spell?.sourceId });
  if (!cast) return;
  const actor = message.actor;
  if (!actor?.isOwner) return;

  try {
    const choice = await pickForm(actor, cast.spell, cast.castRank);
    if (choice) await applyForm(actor, choice, cast, { message, spell });
  } catch (error) {
    console.error(`${MODULE_ID} | Could not apply the form`, error);
    ui.notifications.error(game.i18n.format(`${I18N}.Notify.ApplyFailed`, { spell: cast.spell.name }));
  }
}

export function registerAutoApplyHook() {
  Hooks.on('createChatMessage', onCreateChatMessage);
}
