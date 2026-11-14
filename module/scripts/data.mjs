// Loads the form catalogue once, when the module script is imported. Foundry waits for module scripts (including
// this top-level await) before it fires `init`, so the catalogue is ready for every hook.

const EMPTY = { system: 'pf2e', pf2e: {}, untamed: null, spells: {}, effects: {} };

async function load() {
  try {
    const response = await fetch(new URL('../data/forms.json', import.meta.url));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('sargas-pf2e-formidable-forms | Could not load the form catalogue', error);
    return EMPTY;
  }
}

/** The form catalogue (module/data/forms.json). */
export const catalogue = await load();

/** False when the catalogue failed to load; the module then does nothing. */
export const hasCatalogue = catalogue.untamed !== null;
