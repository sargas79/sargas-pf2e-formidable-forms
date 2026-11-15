// The Foundry side of the art resolver: the world's overrides, the compendium art mapping, the compendium
// creatures' own token images and the target token's ring, packaged as the `env` that `resolveFormArt` takes.
import { allForms } from './catalogue.mjs';
import { catalogue } from './data.mjs';
import { SETTING, getSetting } from './settings.mjs';
import { chooseToken, ringSettingsOf } from './token-image.mjs';

/** Prototype token fields added to the compendium indexes, so creature tokens can be read without loading actors. */
const INDEX_FIELDS = ['prototypeToken.texture.src', 'prototypeToken.ring.subject.texture'];

/**
 * Loads the token fields into the index of every pack the catalogue points at. The token image hook cannot wait
 * for a compendium, so this runs once when the world is ready; until it finishes, creature tokens are skipped.
 */
export async function preloadCreatureTokens() {
  const packIds = new Set(
    allForms(catalogue)
      .map(({ form }) => parseCreatureUuid(form.creature)?.pack)
      .filter(Boolean),
  );
  await Promise.all(
    [...packIds].map(async (id) => {
      try {
        await game.packs.get(id)?.getIndex({ fields: INDEX_FIELDS });
      } catch (error) {
        console.warn(`sargas-pf2e-formidable-forms | Could not index ${id}`, error);
      }
    }),
  );
}

/** Splits "Compendium.pf2e.pathfinder-monster-core.Actor.<id>" into the pack's collection id and the document id. */
function parseCreatureUuid(uuid) {
  const [type, scope, pack, , id] = (uuid ?? '').split('.');
  return type === 'Compendium' && id ? { pack: `${scope}.${pack}`, id } : null;
}

/** A compendium creature's prototype token data from its pack's index, or null when it is not indexed. */
function getCreatureToken(uuid) {
  const parsed = parseCreatureUuid(uuid);
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
