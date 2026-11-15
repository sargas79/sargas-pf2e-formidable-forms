// Writes the "Supported forms" table in README.md from the catalogue, between the forms:start and forms:end
// markers. A test keeps the README in step with the catalogue.
//
// Usage: npm run readme:forms
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORMS_FILE, ROOT } from './lib/paths.mjs';
import { readJson } from './lib/util.mjs';

export const README_FILE = path.join(ROOT, 'README.md');
const START = '<!-- forms:start -->';
const END = '<!-- forms:end -->';

/** Marks a form that has no creature, and so no automatic image. Escaped so Markdown shows a plain asterisk. */
const NO_CREATURE = String.raw`\*`;

/** The text between the markers of a README, or null when they are missing. */
export function tableIn(readme) {
  const [start, end] = [readme.indexOf(START), readme.indexOf(END)];
  return start === -1 || end < start ? null : readme.slice(start + START.length, end).trim();
}

/** The table's cells: one array per spell with its name, rank and forms. */
export function formsRows(catalogue) {
  return Object.values(catalogue.spells).map((spell) => {
    const forms = spell.effects
      .map((uuid) => catalogue.effects[uuid])
      .flatMap((effect) =>
        effect.forms.map((form) => {
          const notes = [effect.legacy ? 'legacy' : null, effect.untamedOnly ? 'Untamed Form only' : null];
          const note = notes.filter(Boolean).join(', ');
          const mark = form.creature || form.battleForm === false ? '' : NO_CREATURE;
          return { text: `${form.name}${mark}${note ? ` (${note})` : ''}`, mark };
        }),
      );
    const text = forms.length === 1 ? `Single form${forms[0].mark}` : forms.map((form) => form.text).join(', ');
    return [spell.name, String(spell.rank), text];
  });
}

/** The table as Markdown. */
export function formsTable(catalogue) {
  const rows = [['Spell', 'Rank', 'Forms'], ['---', '---', '---'], ...formsRows(catalogue)];
  return rows.map((cells) => `| ${cells.join(' | ')} |`).join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const readme = await readFile(README_FILE, 'utf8');
  if (tableIn(readme) === null) throw new Error('README.md has no forms:start / forms:end markers');
  const table = formsTable(await readJson(FORMS_FILE));
  const [before, after] = [readme.slice(0, readme.indexOf(START)), readme.slice(readme.indexOf(END))];
  await writeFile(README_FILE, `${before}${START}\n\n${table}\n\n${after}`);
  // Prettier pads the table's columns.
  const prettier = path.join(ROOT, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
  execFileSync(process.execPath, [prettier, '--write', README_FILE], { stdio: 'ignore' });
  console.log('Updated the supported forms table in README.md');
}
