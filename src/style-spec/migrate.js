
import migrateToV8 from './migrate/v8';

export default function(style) {
    let migrated = false;

    if (style.version === 7 || style.version === 8) {
        style = migrateToV8(style);
        migrated = true;
    }

    if (!migrated) {
        throw new Error('cannot migrate from', style.version);
    }

    return style;
}
