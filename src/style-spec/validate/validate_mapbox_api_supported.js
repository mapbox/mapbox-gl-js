// @flow
import ValidationError from '../error/validation_error';

const SUPPORTED_SPEC_VERSION = 8;
const MAX_SOURCES_IN_STYLE = 15;

function isValid(value: ?string, regex: RegExp): boolean {
    if (!value) return true;
    return !!value.match(regex);
}

function getSourcesCount(sources: { [string]: { url: string } }) {
    return Object.keys(sources).reduce((count, key) => {
        const source = sources[key];
        return count + source.url.replace('mapbox://', '').split(',').length;
    }, 0);
}

function getAllowedKeyErrors(obj: Object, keys: Array<*>, path: ?string): Array<?Error> {
    const allowed = new Set(keys);
    const errors = [];
    Object.keys(obj).forEach(k => {
        if (!allowed.has(k)) {
            const prop = path ? `${path}.${k}` : k;
            errors.push(new ValidationError(prop, null, `Unsupported property "${prop}"`));
        }
    });
    return errors;
}

function getSourceErrors(source: Object): Array<?Error> {
    const errors = [];

    /*
     * Inlined sources are not supported by the Mapbox Styles API, so only
     * "type", "url", and "tileSize" properties are valid
     */

    const sourceKeys = ['type', 'url', 'tileSize'];
    errors.push(...getAllowedKeyErrors(source, sourceKeys, 'source'));

    if (!source.url) {
        errors.push(new ValidationError('sources', null, 'Source must include url'));
    }

    /*
     * "sprite" is optional. If present, valid examples:
     * mapbox://mapbox.abcd1234
     * mapbox://penny.abcd1234
     * mapbox://mapbox.abcd1234,penny.abcd1234
     */
    const sourceUrlPattern = /^mapbox:\/\/([^/]*)$/;
    if (!isValid(source.url, sourceUrlPattern)) {
        errors.push(new ValidationError('sources', null, 'Style must reference sources hosted by Mapbox'));
    }

    return errors;
}

function getSourcesErrors(sources: Object): Array<?Error> {
    const errors = [];

    if (getSourcesCount(sources) > MAX_SOURCES_IN_STYLE) {
        errors.push(new ValidationError('sources', null, `Styles must contain ${MAX_SOURCES_IN_STYLE} or fewer sources`));
    }

    Object.keys(sources).forEach((s: string) => {
        const sourceErrors = getSourceErrors(sources[s]);
        errors.push(...sourceErrors);
    });

    return errors;
}

function getRootErrors(style: Object, specKeys: Array<any>): Array<?Error> {
    const errors = [];

    /*
     * The following keys are optional but fully managed by the Mapbox Styles
     * API. Values on stylesheet on POST or PATCH will be ignored: "owner",
     * "id", "cacheControl", "draft", "created", "modified"
     *
     * The following keys are optional. The Mapbox Styles API respects value on
     * stylesheet on PATCH, but ignores the value on POST: "visibility"
     */
    const optionalRootProperties = [
        'owner',
        'id',
        'cacheControl',
        'draft',
        'created',
        'modified',
        'visibility'
    ];

    const allowedKeyErrors = getAllowedKeyErrors(style, [...specKeys, ...optionalRootProperties]);
    errors.push(...allowedKeyErrors);

    if (style.version !== SUPPORTED_SPEC_VERSION) {
        errors.push(new ValidationError('version', null, `style version must be ${SUPPORTED_SPEC_VERSION}`));
    }

    /*
     * "glyphs" is optional. If present, valid examples:
     * mapbox://fonts/penny/{fontstack}/{range}.pbf
     * mapbox://fonts/mapbox/{fontstack}/{range}.pbf
     */
    const glyphUrlPattern = /^mapbox:\/\/fonts\/([^/]*)\/{fontstack}\/{range}.pbf$/;
    if (!isValid(style.glyphs, glyphUrlPattern)) {
        errors.push(new ValidationError('glyphs', null, 'Styles must reference glyphs hosted by Mapbox'));
    }

    /*
     * "sprite" is optional. If present, valid examples:
     * mapbox://sprites/penny/abcd1234
     * mapbox://sprites/mapbox/abcd1234/draft
     * mapbox://sprites/cyrus/abcd1234/abcd1234
     */
    const spriteUrlPattern = /^mapbox:\/\/sprites\/([^/]*)\/([^/]*)\/?([^/]*)?$/;
    if (!isValid(style.sprite, spriteUrlPattern)) {
        errors.push(new ValidationError('sprite', null, 'Styles must reference sprites hosted by Mapbox'));
    }

    /*
     * "visibility" is optional. If present, valid examples:
     * "private"
     * "public"
     */
    const visibilityPattern = /^(public|private)/;
    if (!isValid(style.visibility, visibilityPattern)) {
        errors.push(new ValidationError('visibility', null, 'Style visibility must be public or private'));
    }

    return errors;
}

function validateMapboxApiSupported(options: Object): Array<?Error> {
    const value = options.value;
    const specKeys = Object.keys(options.styleSpec.$root);

    return getRootErrors(value, specKeys).concat(getSourcesErrors(value.source));
}

export default validateMapboxApiSupported;
