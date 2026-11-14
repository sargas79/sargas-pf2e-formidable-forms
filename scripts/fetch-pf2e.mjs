// Builds scripts/data/pf2e-snapshot.json from the PF2e system source: the battle-form spell effects, their spells,
// the druid feats that extend Untamed Form, and the creatures the catalogue may point at.
//
// Needs network access and git. It sparse-checks out only the folders it reads into scripts/.cache.
//
// Usage:
//   npm run fetch:pf2e                 refresh the snapshot at the pinned commit (PF2E_REF in scripts/lib/pf2e.mjs)
//   npm run fetch:pf2e -- --ref <ref>  take it from another commit, tag or branch (then update PF2E_REF)
//
// Afterwards run `npm run build:forms` to regenerate module/data/forms.json.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { wantedCreatureNames } from './lib/forms.mjs';
import { CACHE_DIR, FORM_CONFIG_FILE, SNAPSHOT_FILE } from './lib/paths.mjs';
import {
  PF2E_REF,
  PF2E_REPO,
  createLocalizer,
  isBattleFormEffect,
  isUntamedFormEffect,
  parseEffectName,
  trimActor,
  trimEffect,
  trimSpell,
  wildShapeUnlocks,
} from './lib/pf2e.mjs';
import { readJson, writeJson } from './lib/util.mjs';

/** Folders read before the manifest tells us where the actor packs are. */
const BASE_PATHS = [
  '/system.pf2e.json',
  '/static/lang/',
  '/packs/pf2e/spell-effects/',
  '/packs/pf2e/spells/',
  '/packs/pf2e/feats/',
];

async function* jsonFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* jsonFiles(full);
    else if (entry.name.endsWith('.json') && !entry.name.startsWith('_')) yield full;
  }
}

async function* documents(dir) {
  if (!existsSync(dir)) return;
  for await (const file of jsonFiles(dir)) yield JSON.parse(await readFile(file, 'utf8'));
}

/** Checks out `ref` of the PF2e repository, sparsely, and returns the checkout folder and a git runner for it. */
async function checkout(ref) {
  const dir = path.join(CACHE_DIR, `pf2e-${ref.replace(/[^\w.-]/g, '_')}`);
  const git = (...args) =>
    execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  if (!existsSync(path.join(dir, '.git'))) {
    await mkdir(dir, { recursive: true });
    git('init', '--quiet');
    git('remote', 'add', 'origin', PF2E_REPO);
  }
  git('sparse-checkout', 'set', '--no-cone', ...BASE_PATHS);
  console.log(`Fetching ${PF2E_REPO} at ${ref} (sparse)...`);
  git('fetch', '--quiet', '--depth', '1', '--filter=blob:none', 'origin', ref);
  git('checkout', '--quiet', '--detach', 'FETCH_HEAD');
  return { dir, git };
}

/**
 * Reads a PF2e checkout into a snapshot.
 * @param {string} ref A commit, tag or branch of the PF2e repository
 * @returns {Promise<object>} The snapshot
 */
export async function fetchSnapshot(ref = PF2E_REF) {
  const { dir, git } = await checkout(ref);
  const manifest = await readJson(path.join(dir, 'system.pf2e.json'));
  // The manifest points at built packs (packs/<name>); their JSON sources live in packs/pf2e/<name>.
  const packs = manifest.packs.map((p) => ({ name: p.name, type: p.type, dir: `packs/pf2e/${path.basename(p.path)}` }));
  const packOf = (folder) => {
    const pack = packs.find((p) => p.dir === `packs/pf2e/${folder}`);
    if (!pack) throw new Error(`No pack for packs/pf2e/${folder} in the system manifest`);
    return pack;
  };

  const langDir = path.join(dir, 'static', 'lang');
  const localize = createLocalizer(
    await readJson(path.join(langDir, 're-en.json')),
    await readJson(path.join(langDir, 'en.json')),
  );

  const effectPack = packOf('spell-effects');
  const effects = [];
  for await (const doc of documents(path.join(dir, effectPack.dir))) {
    if (isBattleFormEffect(doc) || isUntamedFormEffect(doc)) effects.push(trimEffect(doc, effectPack.name, localize));
  }
  effects.sort((a, b) => a.name.localeCompare(b.name));

  const spellNames = new Set(effects.map((effect) => parseEffectName(effect.name).spell));
  const spellPack = packOf('spells');
  const spells = [];
  for await (const doc of documents(path.join(dir, spellPack.dir))) {
    if (doc.type === 'spell' && spellNames.has(doc.name)) spells.push(trimSpell(doc, spellPack.name));
  }
  spells.sort((a, b) => a.name.localeCompare(b.name));

  const untamedUnlocks = [];
  for await (const doc of documents(path.join(dir, packOf('feats').dir))) {
    for (const effect of wildShapeUnlocks(doc)) untamedUnlocks.push({ feat: doc.name, effect });
  }
  untamedUnlocks.sort((a, b) => a.feat.localeCompare(b.feat) || a.effect.localeCompare(b.effect));

  // Only the creatures the catalogue may point at are kept, from every actor pack so the pack preference is real.
  const partial = { effects, spells, untamedUnlocks, creatures: [] };
  const wanted = wantedCreatureNames(partial, await readJson(FORM_CONFIG_FILE));
  const actorPacks = packs.filter((p) => p.type === 'Actor');
  git('sparse-checkout', 'set', '--no-cone', ...BASE_PATHS, ...actorPacks.map((p) => `/${p.dir}/`));
  const creatures = [];
  for (const pack of actorPacks) {
    for await (const doc of documents(path.join(dir, pack.dir))) {
      const creature = wanted.has(doc.name) ? trimActor(doc, pack.name) : null;
      if (creature) creatures.push(creature);
    }
  }
  creatures.sort((a, b) => a.name.localeCompare(b.name) || a.pack.localeCompare(b.pack) || a.id.localeCompare(b.id));

  return {
    repo: PF2E_REPO,
    ref: git('rev-parse', 'HEAD').trim(),
    version: manifest.version,
    effects,
    spells,
    untamedUnlocks,
    creatures,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const refIndex = process.argv.indexOf('--ref');
  const snapshot = await fetchSnapshot(refIndex === -1 ? PF2E_REF : process.argv[refIndex + 1]);
  await writeJson(SNAPSHOT_FILE, snapshot);
  console.log(
    `Saved PF2e ${snapshot.version} (${snapshot.ref.slice(0, 8)}): ${snapshot.effects.length} effects, ` +
      `${snapshot.spells.length} spells, ${snapshot.creatures.length} creatures.`,
  );
}
