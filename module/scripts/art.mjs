// Picks the image for a form. Pure: the Foundry lookups (world setting, compendium art, compendium index) are passed
// in, so this file can be unit tested and is shared by the token image hook, the picker and the Form Art manager.

/** Where a form's image came from. */
export const ART_SOURCE = Object.freeze({
  /** Set by the GM in the Form Art manager. */
  OVERRIDE: 'override',
  /** From a module that registers art through Foundry's compendium art mapping. */
  ART_MODULE: 'art-module',
  /** The compendium creature's own token image. */
  COMPENDIUM: 'compendium',
  /** Nothing found: the token keeps its image. */
  NONE: 'none',
});

/** Images that count as "no image chosen": the PF2e default icons and Foundry's placeholder. */
export const DEFAULT_IMAGES = Object.freeze({
  prefixes: ['systems/pf2e/icons/default-icons/', 'systems/sf2e/icons/default-icons/'],
  files: ['icons/svg/mystery-man.svg'],
});

const VIDEO_EXTENSION = /\.(webm|mp4|m4v|ogv|ogg)(\?.*)?$/i;

export function isDefaultImage(src) {
  if (typeof src !== 'string' || src === '') return true;
  return DEFAULT_IMAGES.prefixes.some((prefix) => src.startsWith(prefix)) || DEFAULT_IMAGES.files.includes(src);
}

/** The dynamic token ring's subject must be a still image, so a video can only replace the whole texture. */
export const isVideo = (src) => typeof src === 'string' && VIDEO_EXTENSION.test(src);

/** The first usable image: a non-empty string that is not a default icon. */
const firstImage = (...candidates) => candidates.find((src) => !isDefaultImage(src)) ?? null;

/**
 * The image to show from token data: a path, or a (partial) prototype token such as an art module provides.
 * A token with the dynamic ring shows the ring's subject texture, so that is preferred when `ring` is set.
 */
function tokenImage(token, ring) {
  if (typeof token === 'string') return firstImage(token);
  const texture = token?.texture?.src;
  const subject = token?.ring?.subject?.texture;
  return ring ? firstImage(subject, texture) : firstImage(texture, subject);
}

/**
 * Resolves the image for a form. The first source that has one wins:
 *  1. the GM's override for the form,
 *  2. art a module registered for the form's creature (`game.compendiumArt`),
 *  3. the compendium creature's own token image, unless it is a default icon,
 *  4. nothing: the token keeps its image.
 *
 * @param {{ key: string, creature?: string | null }} form A catalogue form
 * @param {object} [env]
 * @param {Record<string, string>} [env.overrides] GM overrides by form key
 * @param {(uuid: string) => ({ actor?: string, token?: string | object } | null | undefined)} [env.getCompendiumArt]
 *   `game.compendiumArt.get`
 * @param {(uuid: string) => (string | object | null | undefined)} [env.getCreatureToken] The compendium creature's
 *   token image, or its prototype token data
 * @param {boolean} [env.ring] Whether the actor's token uses the dynamic token ring
 * @returns {{ image: string | null, source: string, ringSafe: boolean }} `ringSafe` tells the caller to write the
 *   image to the ring's subject texture only, because setting the token texture's rule would switch the ring on.
 */
export function resolveFormArt(form, env = {}) {
  const { overrides = {}, getCompendiumArt = () => null, getCreatureToken = () => null, ring = false } = env;
  const result = (image, source) => ({ image, source, ringSafe: ring && !isVideo(image) });

  const override = overrides[form.key];
  if (typeof override === 'string' && override.trim() !== '') return result(override.trim(), ART_SOURCE.OVERRIDE);

  if (form.creature) {
    const art = getCompendiumArt(form.creature);
    const fromModule = art ? (tokenImage(art.token, ring) ?? firstImage(art.actor)) : null;
    if (fromModule) return result(fromModule, ART_SOURCE.ART_MODULE);

    const fromCompendium = tokenImage(getCreatureToken(form.creature), ring);
    if (fromCompendium) return result(fromCompendium, ART_SOURCE.COMPENDIUM);
  }

  return { image: null, source: ART_SOURCE.NONE, ringSafe: false };
}
