// Asks the caster which form to take. This is a plain placeholder: a list of the form names the cast rank allows.
// The cast handler only depends on `pickForm`, so the dialog can be replaced without touching it.
import { I18N } from './constants.mjs';
import { catalogue } from './data.mjs';
import { listChoices, toResult } from './picker-logic.mjs';

const { DialogV2 } = foundry.applications.api;

/** A form's name in the user's language. PF2e's own labels are used where the form comes from a PF2e choice. */
export function formName(form) {
  return form.label && game.i18n.has(form.label) ? game.i18n.localize(form.label) : form.name;
}

/**
 * Lets the user pick a form for a spell that was just cast.
 * @param {Actor} actor The caster
 * @param {object} spellEntry The catalogue spell (an entry of `catalogue.spells`, or `catalogue.untamed`)
 * @param {number} castRank The rank the spell was cast at
 * @returns {Promise<{ effectUuid: string, formKey: string, untamedValue?: string } | null>} The choice, or null when
 *   the user cancelled or there is nothing to choose
 */
export async function pickForm(actor, spellEntry, castRank) {
  const choices = listChoices(catalogue, spellEntry, {
    rank: castRank,
    options: actor.getRollOptions?.() ?? [],
    wildShapeForms: actor.flags?.[catalogue.system]?.wildShapeForms,
  });
  if (choices.length === 0) {
    ui.notifications.warn(game.i18n.format(`${I18N}.Notify.NoForms`, { spell: spellEntry.name, actor: actor.name }));
    return null;
  }
  // Nothing to choose: apply the only form.
  if (choices.length === 1) return toResult(choices[0]);

  const select = document.createElement('select');
  select.name = 'form';
  choices.forEach((choice, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = formName(choice.form);
    select.append(option);
  });
  const index = await DialogV2.prompt({
    window: { title: game.i18n.format(`${I18N}.Picker.Title`, { spell: spellEntry.name }) },
    content: select.outerHTML,
    ok: {
      label: game.i18n.localize(`${I18N}.Picker.Apply`),
      callback: (_event, button) => button.form.elements.form.value,
    },
    rejectClose: false,
  });
  return index === null || index === undefined ? null : toResult(choices[Number(index)]);
}
