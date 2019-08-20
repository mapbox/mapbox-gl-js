// @flow
import ValidationError from '../error/validation_error';

const SUPPORTED_SPEC_VERSION = 8;
const MAX_SOURCES_IN_STYLE = 15;
const SOURCE_KEYS = ['type', 'url', 'tileSize'];

function validateKeys(obj: Object, keys: Array<*>, errors: Array<?Error>, path: ?string): void {
    const allowed = new Set(keys);
    Object.keys(obj).forEach(k => {
        if (!allowed.has(k)) {
            const prop = path ? `${path}.${k}` : k;
            errors.push(new ValidationError(prop, null, `Unsupported property "${prop}"`));
        }
    });
}

function isValidSpriteURL(url: string): boolean {
    const validPattern = /^mapbox:\/\/sprites\/([^/]*)\/([^/]*)\/([^/]*)?$/;
    return !!url.match(validPattern);
}

function isValidGlyphsURL(url: string): boolean {
    const validPattern = /^mapbox:\/\/fonts\/([^/]*)\/{fontstack}\/{range}.pbf$/;
    return !!url.match(validPattern);
}

function validateSource(sources: Object, errors: Array<?Error>): void {
    const count = Object.keys(sources).reduce((count, key) => {
        const source = sources[key];
        return count + source.url.replace('mapbox://', '').split(',').length;
    }, 0);

    if (count > MAX_SOURCES_IN_STYLE) {
        errors.push(new ValidationError('sources', null, `Styles must contain ${MAX_SOURCES_IN_STYLE} or fewer sources`));
    }

    for (const q in sources) {
        if (!sources[q].url) {
            errors.push(new ValidationError('sources', null, 'Source must include url'));
        }

        if (sources[q].url.indexOf('mapbox://') !== 0) {
            errors.push(new ValidationError('sources.url', null, 'Style must reference sources hosted by Mapbox'));
        }

        validateKeys(sources[q], SOURCE_KEYS, errors, 'source');
    }

}

function validate(style: Object, errors: Array<?Error>): void {
    if (style.version !== SUPPORTED_SPEC_VERSION) {
        errors.push(new ValidationError('version', null, `style version must be ${SUPPORTED_SPEC_VERSION}`));
    }

    if (style.sprite && !isValidGlyphsURL(style.glyphs)) {
        errors.push(new ValidationError('glyphs', null, 'Styles must reference glyphs hosted by Mapbox'));
    }

    if (style.sprite && !isValidSpriteURL(style.sprite)) {
        errors.push(new ValidationError('sprite', null, 'Styles must reference sprites hosted by Mapbox'));
    }

    if (style.visibility && style.visibility.match(/^(public|private)/)) {
        errors.push(new ValidationError('visibility', null, 'Style visibility must be public or private'));
    }
}

function validateRootKeys(value: Object, specKeys: Array<any>, errors: Array<?Error>): void {
    const optionalRootProperties = [
        'owner',
        'id',
        'cacheControl',
        'visibility',
        'draft',
        'created',
        'modified'
    ];
    validateKeys(value, [...specKeys, ...optionalRootProperties], errors);
}

function validateMapboxApiSupported(options: Object) {
    const value = options.value;
    const specKeys = Object.keys(options.styleSpec.$root);
    const errors = [];

    validateRootKeys(value, specKeys, errors);
    validateSource(value.source, errors);
    validate(value, errors);

    return errors;
}

export default validateMapboxApiSupported;
