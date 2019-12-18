import latest from './reference/latest';

export default function emptyStyle() {
    const style = {};

    const version = latest['$version'];
    for (const styleKey in latest['$root']) {
        const spec = latest['$root'][styleKey];

        if (spec.required) {
            let value = null;
            if (styleKey === 'version') {
                value = version;
            } else {
                if (spec.type === 'array') {
                    value = [];
                } else {
                    value = {};
                }
            }

            if (value != null) {
                style[styleKey] = value;
            }
        }
    }

    return style;
}
