// The form picker: a dialog of cards, one per form the cast allows, with the creature's art, the resulting size and
// the special movement types. Untamed Form gets two steps: the spell form first, then the creature.
//
// The cast handler only depends on `pickForm(actor, spellEntry, castRank)`.
import { artEnvironment, creatureTokensReady } from './art-env.mjs';
import { resolveFormArt } from './art.mjs';
import { movementAtRank, sizeAtRank } from './catalogue.mjs';
import { I18N, MODULE_ID, MODULE_PATH } from './constants.mjs';
import { catalogue } from './data.mjs';
import { groupChoices, initialState, listChoices, matchesQuery, spellsOf, toResult } from './picker-logic.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Actor flag: the last form picked for each spell, `{ [spellSlug]: formKey }`. */
const LAST_FORMS_FLAG = 'lastForms';

const MOVEMENT_ICONS = {
  burrow: 'fa-solid fa-mound',
  climb: 'fa-solid fa-mountain',
  fly: 'fa-solid fa-dove',
  swim: 'fa-solid fa-water',
};

const t = (key, data) => game.i18n.format(`${I18N}.${key}`, data);

/** A form's name in the user's language. PF2e's own labels are used where the form comes from a PF2e choice. */
export function formName(form) {
  return form.label && game.i18n.has(form.label) ? game.i18n.localize(form.label) : form.name;
}

class FormPicker extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ['sargas-forms', 'sargas-forms-picker'],
    window: { icon: 'fa-solid fa-paw', resizable: true },
    position: { width: 660, height: 'auto' },
    actions: {
      chooseSpell: FormPicker.#onChooseSpell,
      back: FormPicker.#onBack,
      select: FormPicker.#onSelect,
      confirm: FormPicker.#onConfirm,
      cancel: FormPicker.#onCancel,
    },
  };

  static PARTS = {
    body: { template: `${MODULE_PATH}/templates/form-picker.hbs`, scrollable: ['.sargas-forms-scroll'] },
  };

  /**
   * Opens the picker and waits for the user.
   * @param {object} config
   * @param {Actor} config.actor The caster
   * @param {object} config.spell The catalogue spell that was cast
   * @param {number} config.rank The cast rank
   * @param {object[]} config.choices The choices on offer, from `listChoices`
   * @param {string} [config.lastKey] The form picked last time
   * @returns {Promise<object | null>} The chosen entry of `choices`, or null when the dialog was closed
   */
  static wait(config) {
    return new Promise((resolve) => {
      // Phones and tablets: never wider than the screen.
      const width = Math.min(FormPicker.DEFAULT_OPTIONS.position.width, window.innerWidth - 16);
      new FormPicker({ ...config, resolve, position: { width } }).render({ force: true });
    });
  }

  #actor;
  #spell;
  #rank;
  #choices;
  #resolve;
  /** The spell whose forms are listed, or null while the user still has to choose one (Untamed Form). */
  #spellSlug;
  #selectedKey;
  #query = '';
  /** Whether there is a spell step to go back to. */
  #hasSpellStep;

  constructor({ actor, spell, rank, choices, lastKey, resolve, ...options }) {
    super(options);
    this.#actor = actor;
    this.#spell = spell;
    this.#rank = rank;
    this.#choices = choices;
    this.#resolve = resolve;
    const state = initialState(catalogue, choices, lastKey);
    this.#spellSlug = state.spellSlug;
    this.#selectedKey = state.selectedKey;
    this.#hasSpellStep = spellsOf(catalogue, choices).length > 1;
  }

  get title() {
    return t('Picker.Title', { spell: this.#spell.name });
  }

  async _prepareContext() {
    const context = {
      searchPlaceholder: t('Picker.Search'),
      query: this.#query,
      rankLabel: t('Picker.Rank', { rank: this.#rank }),
    };
    if (this.#spellSlug === null) {
      return {
        ...context,
        step: 'spell',
        prompt: t('Picker.ChooseSpell'),
        spells: spellsOf(catalogue, this.#choices).map((spell) => ({
          ...spell,
          countLabel: t('Picker.FormCount', { count: spell.count }),
        })),
      };
    }

    const env = artEnvironment(this.#actor);
    const choices = this.#choices.filter((choice) => choice.effect.spell === this.#spellSlug);
    const groups = groupChoices(choices).map(({ group, choices: grouped }) => ({
      label: group ? t(`Group.${group}`) : null,
      cards: grouped.map(({ effect, form }) => this.#card(effect, form, env)),
    }));
    return {
      ...context,
      step: 'form',
      prompt: catalogue.spells[this.#spellSlug].name,
      canGoBack: this.#hasSpellStep,
      groups,
      hasSelection: choices.some((choice) => choice.form.key === this.#selectedKey),
    };
  }

  /** The data for one form's card. */
  #card(effect, form, env) {
    const size = sizeAtRank(form, this.#rank);
    const name = formName(form);
    return {
      key: form.key,
      name,
      // Without creature art the card shows the effect's icon, which is also what the token keeps showing.
      img: resolveFormArt(form, env).image ?? effect.img,
      size: size ? t(`Size.${size}`) : t('Size.own'),
      movement: movementAtRank(form, this.#rank).map((type) => ({
        icon: MOVEMENT_ICONS[type],
        label: t(`Movement.${type}`),
      })),
      selected: form.key === this.#selectedKey,
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const search = this.element.querySelector('input[type="search"]');
    search?.addEventListener('input', () => {
      this.#query = search.value;
      this.#applySearch();
    });
    this.#applySearch();
    // Double click, or Enter on a card, picks it and confirms in one go.
    for (const card of this.element.querySelectorAll('[data-action="select"]')) {
      card.addEventListener('dblclick', () => this.#confirm(card.dataset.key));
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') this.#confirm(card.dataset.key);
      });
    }
    this.element.querySelector('.sargas-forms-card.selected')?.scrollIntoView({ block: 'nearest' });
  }

  /** Hides the cards that don't match the search box, and the headings left without cards. */
  #applySearch() {
    for (const card of this.element.querySelectorAll('.sargas-forms-card')) {
      card.hidden = !matchesQuery(card.dataset.name, this.#query);
    }
    for (const group of this.element.querySelectorAll('.sargas-forms-group')) {
      group.hidden = !group.querySelector('.sargas-forms-card:not([hidden])');
    }
    const empty = this.element.querySelector('.sargas-forms-empty');
    if (empty) empty.hidden = Boolean(this.element.querySelector('.sargas-forms-card:not([hidden])'));
  }

  #confirm(key = this.#selectedKey) {
    const choice = this.#choices.find((c) => c.form.key === key);
    if (!choice) return;
    this.#resolve(choice);
    this.#resolve = null;
    this.close();
  }

  static #onChooseSpell(_event, target) {
    this.#spellSlug = target.dataset.slug;
    this.#selectedKey = null;
    this.#query = '';
    this.render();
  }

  static #onBack() {
    this.#spellSlug = null;
    this.#selectedKey = null;
    this.#query = '';
    this.render();
  }

  static #onSelect(_event, target) {
    this.#selectedKey = target.dataset.key;
    for (const card of this.element.querySelectorAll('[data-action="select"]')) {
      const selected = card === target;
      card.classList.toggle('selected', selected);
      card.setAttribute('aria-pressed', String(selected));
    }
    this.element.querySelector('[data-action="confirm"]').disabled = false;
  }

  static #onConfirm() {
    this.#confirm();
  }

  static #onCancel() {
    this.close();
  }

  /** Closing the window any other way than Transform is a cancel. */
  _onClose(options) {
    super._onClose(options);
    this.#resolve?.(null);
    this.#resolve = null;
  }
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
    ui.notifications.warn(t('Notify.NoForms', { spell: spellEntry.name, actor: actor.name }));
    return null;
  }
  // Nothing to choose (Elephant Form, Sacred Form): apply the only form without asking.
  if (choices.length === 1) return toResult(choices[0]);

  // The cards show the creatures' compendium tokens, which need the pack indexes.
  await creatureTokensReady();
  const lastKey = actor.getFlag(MODULE_ID, LAST_FORMS_FLAG)?.[spellEntry.slug];
  const choice = await FormPicker.wait({ actor, spell: spellEntry, rank: castRank, choices, lastKey });
  if (!choice) return null;

  // Remember the pick for next time. Not worth failing the cast over.
  try {
    await actor.setFlag(MODULE_ID, LAST_FORMS_FLAG, { [spellEntry.slug]: choice.form.key });
  } catch (error) {
    console.warn(`${MODULE_ID} | Could not remember the last form`, error);
  }
  return toResult(choice);
}
