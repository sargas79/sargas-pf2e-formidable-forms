// The form catalogue (module/data/forms.json), imported as a JSON module. A static import is resolved while the
// browser loads the module's scripts, before any of them runs, so the catalogue is there for every hook from `init`
// on and nothing has to wait for it. If the file is missing or broken, the module fails to load with an error in
// the console, instead of running without its data.
import catalogue from '../data/forms.json' with { type: 'json' };

export { catalogue };
