
export default function(style) {
    let migrated = false;

    if (style.version === 7 || style.version === 8) {
        style = require('./migrate/v8')(style);
        migrated = true;
    }

    if (!migrated) {
        throw new Error('cannot migrate from', style.version);
    }

    return style;
};
