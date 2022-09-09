// @flow

import ar from './locales/ar.js';
import ca from './locales/ca.js';
import da from './locales/da.js';
import de from './locales/de.js';
import en from './locales/en.js';
import es from './locales/es.js';
import fa from './locales/fa.js';
import fi from './locales/fi.js';
import fr from './locales/fr.js';
import he from './locales/he.js';
import hu from './locales/hu.js';
import it from './locales/it.js';
import ja from './locales/ja.js';
import ko from './locales/ko.js';
import nl from './locales/nl.js';
import pl from './locales/pl.js';
import pt from './locales/pt.js';
import ro from './locales/ro.js';
import ru from './locales/ru.js';
import sr from './locales/sr.js';
import sv from './locales/sv.js';
import tl from './locales/tl.js';
import tr from './locales/tr.js';
import uk from './locales/uk.js';
import vi from './locales/vi.js';
import zhHans from './locales/zh-Hans.js';

const locales = {
    ar,
    ca,
    da,
    de,
    en,
    es,
    fa,
    fi,
    fr,
    he,
    hu,
    it,
    ja,
    ko,
    nl,
    pl,
    pt,
    ro,
    ru,
    sr,
    sv,
    tl,
    tr,
    uk,
    vi,
    zhHans
};

function getUIString(language: string, key: string): ?string {
    const locale = locales[language] || locales['en'];
    return locale[key] || null;
}

export default getUIString;
