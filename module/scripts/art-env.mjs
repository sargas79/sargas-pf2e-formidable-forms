// The Foundry side of the art resolver: the world's overrides, the compendium art mapping and the compendium
// creatures' own token images, packaged as the `env` that `resolveFormArt` takes.
import { allForms } from './catalogue.mjs';
import { catalogue } from './data.mjs';
import { SETTING, getSetting } from './settings.mjs';

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

/** Whether the token that stands for an actor uses the dynamic token ring. Source data, not the derived value. */
export function usesTokenRing(actor) {
  const token = actor?.token ?? actor?.getActiveTokens?.(true, true)?.[0] ?? actor?.prototypeToken;
  return Boolean(token?._source?.ring?.enabled ?? token?.ring?.enabled);
}

/**
 * The environment for `resolveFormArt`.
 * @param {Actor} [actor] The actor whose token will show the art; without one, art is resolved for a plain token
 */
export function artEnvironment(actor) {
  return {
    overrides: getSetting(SETTING.OVERRIDES) ?? {},
    getCompendiumArt: (uuid) => game.compendiumArt?.get(uuid) ?? null,
    getCreatureToken,
    ring: usesTokenRing(actor),
  };
}
