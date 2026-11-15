// The Foundry side of the art resolver: the world's overrides, the compendium art mapping, the compendium
// creatures' own token images and the target token's ring, packaged as the `env` that `resolveFormArt` takes.
import { creaturePacks, parseCompendiumUuid } from './catalogue.mjs';
import { MODULE_ID } from './constants.mjs';
import { catalogue } from './data.mjs';
import { SETTING, getSetting } from './settings.mjs';
import { chooseToken, ringSettingsOf } from './token-image.mjs';

/** Prototype token fields added to the compendium indexes, so creature tokens can be read without loading actors. */
const INDEX_FIELDS = ['prototypeToken.texture.src', 'prototypeToken.ring.subject.texture'];

/** The one indexing run, shared by everyone who needs the creature tokens. */
let indexing = null;

/**
 * Loads the token fields into the index of every pack the catalogue's creatures are in. Runs once: the first call
 * starts it (the module does so when the world is ready) and every call returns the same promise. The picker, the
 * Form Art manager and the cast handler await it, so a cast made right after the world loads still finds the
 * creature tokens. The token image hook is synchronous and cannot wait; by the time it runs for a cast, the cast
 * handler has already waited.
 * @returns {Promise<void>}
 */
export function creatureTokensReady() {
  indexing ??= Promise.all(
    creaturePacks(catalogue).map(async (id) => {
      try {
        await game.packs.get(id)?.getIndex({ fields: INDEX_FIELDS });
      } catch (error) {
        console.warn(`${MODULE_ID} | Could not index ${id}`, error);
      }
    }),
  ).then(() => undefined);
  return indexing;
}

/** A compendium creature's prototype token data from its pack's index, or null when it is not indexed. */
function getCreatureToken(uuid) {
  const parsed = parseCompendiumUuid(uuid);
  const entry = parsed && game.packs.get(parsed.pack)?.index.get(parsed.id);
  return entry ? (foundry.utils.getProperty(entry, 'prototypeToken') ?? null) : null;
}

/**
 * The token that stands for an actor: the one the caller means, else the most specific one the actor has (see
 * `chooseToken`).
 * @param {Actor} [actor]
 * @param {TokenDocument | string | null} [preferred] A token document or its UUID
 * @returns {TokenDocument | PrototypeToken | null}
 */
export function tokenFor(actor, preferred = null) {
  if (!actor) return null;
  return chooseToken({
    actorUuid: actor.uuid,
    preferred: typeof preferred === 'string' ? fromUuidSync(preferred) : preferred,
    own: actor.token,
    active: actor.getActiveTokens?.(true, true) ?? [],
    prototype: actor.prototypeToken,
  });
}

/**
 * The environment for `resolveFormArt` and `planTokenImage`.
 * @param {Actor} [actor] The actor whose token will show the art; without one, art is resolved for a plain token
 * @param {object} [options]
 * @param {TokenDocument | string | null} [options.token] The token the art is for, when the caller knows it
 */
export function artEnvironment(actor, { token = null } = {}) {
  const target = tokenFor(actor, token);
  // Source data, not the prepared values: those may already include the ring of a form that is being replaced.
  const ringSettings = ringSettingsOf(target?._source ?? target?.toObject?.() ?? target);
  return {
    overrides: getSetting(SETTING.OVERRIDES) ?? {},
    getCompendiumArt: (uuid) => game.compendiumArt?.get(uuid) ?? null,
    getCreatureToken,
    // The ring is only written when the target token already uses it; the rule would otherwise switch it on.
    ring: ringSettings.enabled,
    ringSettings,
  };
}
