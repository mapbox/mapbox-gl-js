// @flow

import validateStyle from './validate_style.min.js';
import {v8} from './style-spec.js';
import readStyle from './read_style.js';
import ValidationError from './error/validation_error.js';
import getType from './util/get_type.js';

const SUPPORTED_SPEC_VERSION = 8;
const MAX_SOURCES_IN_STYLE = 15;

function isValid(value: ?string, regex: RegExp): boolean {
    if (!value || getType(value) !== 'string') return true;
    return !!value.match(regex);
}

function getSourceCount(source: Object): number {
    if (source.url) {
        return source.url.split(',').length;
    } else {
        return 0;
    }
}

function getAllowedKeyErrors(obj: Object, keys: Array<*>, path: ?string): Array<?ValidationError> {
    const allowed = new Set(keys);
    const errors = [];
    Object.keys(obj).forEach(k => {
        if (!allowed.has(k)) {
            const prop = path ? `${path}.${k}` : null;
            errors.push(new ValidationError(prop, obj[k], `Unsupported property "${k}"`));
        }
    });
    return errors;
}

const acceptedSourceTypes = new Set(["vector", "raster", "raster-dem"]);
function getSourceErrors(source: Object, i: number): Array<?ValidationError> {
    const errors = [];

    /*
     * Inlined sources are not supported by the Mapbox Styles API, so only
     * "type", "url", and "tileSize" properties are valid
     */
    const sourceKeys = ['type', 'url', 'tileSize'];
    errors.push(...getAllowedKeyErrors(source, sourceKeys, 'source'));

    /*
     * "type" is required and must be one of "vector", "raster", "raster-dem"
     */
    if (!acceptedSourceTypes.has(String(source.type))) {
        errors.push(new ValidationError(`sources[${i}].type`, source.type, `Expected one of [${Array.from(acceptedSourceTypes).join(", ")}]`));
    }

    /*
     * "source" is required. Valid examples:
     * mapbox://mapbox.abcd1234
     * mapbox://penny.abcd1234
     * mapbox://mapbox.abcd1234,penny.abcd1234
     */
    const sourceUrlPattern = /^mapbox:\/\/([^/]*)$/;
    if (!source.url || !isValid(source.url, sourceUrlPattern)) {
        errors.push(new ValidationError(`sources[${i}].url`, source.url, 'Expected a valid Mapbox tileset url'));
    }

    return errors;
}

function getSourcesErrors(sources: Object): Array<?ValidationError> {
    const errors = [];
    let count = 0;

    Object.keys(sources).forEach((s: string, i: number) => {
        const sourceErrors = getSourceErrors(sources[s], i);

        // If source has errors, skip counting
        if (!sourceErrors.length) {
            count = count + getSourceCount(sources[s]);
        }

        errors.push(...sourceErrors);
    });

    if (count > MAX_SOURCES_IN_STYLE) {
        errors.push(new ValidationError('sources', null, `Styles must contain ${MAX_SOURCES_IN_STYLE} or fewer sources`));
    }

    return errors;
}

function getRootErrors(style: Object, specKeys: Array<any>): Array<?ValidationError> {
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

    if (style.version > SUPPORTED_SPEC_VERSION || style.version < SUPPORTED_SPEC_VERSION) {
        errors.push(new ValidationError('version', style.version, `Style version must be ${SUPPORTED_SPEC_VERSION}`));
    }

    /*
     * "glyphs" is optional. If present, valid examples:
     * mapbox://fonts/penny/{fontstack}/{range}.pbf
     * mapbox://fonts/mapbox/{fontstack}/{range}.pbf
     */
    const glyphUrlPattern = /^mapbox:\/\/fonts\/([^/]*)\/{fontstack}\/{range}.pbf$/;
    if (!isValid(style.glyphs, glyphUrlPattern)) {
        errors.push(new ValidationError('glyphs', style.glyphs, 'Styles must reference glyphs hosted by Mapbox'));
    }

    /*
     * "sprite" is optional. If present, valid examples:
     * mapbox://sprites/penny/abcd1234
     * mapbox://sprites/mapbox/abcd1234/draft
     * mapbox://sprites/cyrus/abcd1234/abcd1234
     */
    const spriteUrlPattern = /^mapbox:\/\/sprites\/([^/]*)\/([^/]*)\/?([^/]*)?$/;
    if (!isValid(style.sprite, spriteUrlPattern)) {
        errors.push(new ValidationError('sprite', style.sprite, 'Styles must reference sprites hosted by Mapbox'));
    }

    /*
     * "visibility" is optional. If present, valid examples:
     * "private"
     * "public"
     */
    const visibilityPattern = /^(public|private)$/;
    if (!isValid(style.visibility, visibilityPattern)) {
        errors.push(new ValidationError('visibility', style.visibility, 'Style visibility must be public or private'));
    }

    return errors;
}

/**
 * Validate a Mapbox GL style against the style specification and check for
 * compatibility with the Mapbox Styles API.
 *
 * @param {Object} style The style to be validated.
 * @returns {Array<ValidationError>}
 * @example
 *   var validateMapboxApiSupported = require('mapbox-gl-style-spec/lib/validate_style_mapbox_api_supported.js');
 *   var errors = validateMapboxApiSupported(style);
 */
export default function validateMapboxApiSupported(style: Object): Array<?ValidationError> {
    let s = style;
    try {
        s = readStyle(s);
    } catch (e) {
        return [e];
    }

    let errors = validateStyle(s, v8)
        .concat(getRootErrors(s, Object.keys(v8.$root)));

    if (s.sources) {
        errors = errors.concat(getSourcesErrors(s.sources));
    }

    return errors;
}
