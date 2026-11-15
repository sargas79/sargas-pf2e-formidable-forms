// GM window opened from the module settings: every form in the catalogue, grouped by spell, with the image the
// resolver picks for it and where that image comes from. The GM can set an image of their own for any form, and
// reset it. Overrides win over every other source the next time the form is applied.
import { artEnvironment, creatureTokensReady } from './art-env.mjs';
import { I18N, MODULE_ID, MODULE_PATH } from './constants.mjs';
import { catalogue } from './data.mjs';
import { formName } from './form-picker.mjs';
import { listArtRows, readOverride, withOverride, withoutOverride } from './overrides.mjs';
import { matchesQuery } from './picker-logic.mjs';
import { SETTING, getSetting } from './settings.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const t = (key, data) => game.i18n.format(`${I18N}.${key}`, data);

export class FormArtManager extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-art-manager`,
    classes: ['sargas-forms', 'sargas-forms-art'],
    window: { title: `${I18N}.Art.Title`, icon: 'fa-solid fa-paw', resizable: true },
    position: { width: 620, height: 'auto' },
    actions: {
      browse: FormArtManager.#onBrowse,
      reset: FormArtManager.#onReset,
    },
  };

  static PARTS = {
    body: { template: `${MODULE_PATH}/templates/form-art.hbs`, scrollable: ['.sargas-forms-scroll'] },
  };

  #query = '';

  async _prepareContext() {
    await creatureTokensReady();
    // Art is resolved for a plain token; a token with the dynamic ring may show the ring subject an art module
    // registers instead.
    const spells = listArtRows(catalogue, artEnvironment()).map((spell) => ({
      name: spell.name,
      rows: spell.rows.map(({ key, form, effect, art, overridden }) => {
        const name = formName(form);
        return {
          key,
          name,
          // What the search box matches: the form and its spell.
          search: `${name} ${spell.name}`,
          creature: form.creatureName,
          img: art.image ?? effect.img,
          hasImage: art.image !== null,
          source: art.source,
          sourceLabel: t(`Art.Source.${art.source}`),
          overridden,
        };
      }),
    }));
    return {
      intro: t('Art.Intro'),
      searchPlaceholder: t('Art.Search'),
      query: this.#query,
      spells,
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
  }

  /** Hides the rows that don't match the search box, and the spells left without rows. */
  #applySearch() {
    for (const row of this.element.querySelectorAll('.sargas-forms-row')) {
      row.hidden = !matchesQuery(row.dataset.search, this.#query);
    }
    for (const group of this.element.querySelectorAll('.sargas-forms-group')) {
      group.hidden = !group.querySelector('.sargas-forms-row:not([hidden])');
    }
  }

  /** Saves the overrides and shows the rows again, so the image and its source are current. */
  async #save(overrides) {
    await game.settings.set(MODULE_ID, SETTING.OVERRIDES, overrides);
    this.render();
  }

  /** Opens the file picker to set an image for a form. */
  static #onBrowse(_event, target) {
    const { key } = target.closest('[data-key]').dataset;
    const overrides = getSetting(SETTING.OVERRIDES) ?? {};
    const FilePicker = foundry.applications.apps.FilePicker.implementation;
    new FilePicker({
      type: 'imagevideo',
      current: readOverride(overrides, key) ?? '',
      // Read the setting again when a file is chosen: another row may have changed in the meantime.
      callback: (path) => this.#save(withOverride(getSetting(SETTING.OVERRIDES) ?? {}, key, path)),
    }).browse();
  }

  /** Removes a form's override, returning it to the automatic image. */
  static #onReset(_event, target) {
    const { key } = target.closest('[data-key]').dataset;
    return this.#save(withoutOverride(getSetting(SETTING.OVERRIDES) ?? {}, key));
  }
}
