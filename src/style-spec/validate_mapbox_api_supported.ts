import {validateStyle} from './validate_style.min';
import {v8} from './style-spec';
import readStyle from './read_style';
import ValidationError from './error/validation_error';
import {isString, isBoolean} from './util/get_type';

import type {StyleReference} from './reference/latest';
import type {ValidationErrors} from './validate_style.min';
import type {
    StyleSpecification,
    SourceSpecification,
    SourcesSpecification,
    ImportSpecification
} from './types';

type MapboxStyleSpecification = StyleSpecification & {
    visibility?: 'public' | 'private';
    protected?: boolean;
};

const SUPPORTED_SPEC_VERSION = 8;
const MAX_SOURCES_IN_STYLE = 15;

function isValid(value: string | null | undefined, regex: RegExp): boolean {
    if (!value || !isString(value)) return true;
    return !!value.match(regex);
}

function getSourceCount(source: SourceSpecification): number {
    if ('url' in source) {
        return source.url.split(',').length;
    } else {
        return 0;
    }
}

function getAllowedKeyErrors(obj: object, keys: string[], path?: string | null): Array<ValidationError> {
    const allowed = new Set(keys);
    const errors: ValidationError[] = [];
    Object.keys(obj).forEach(k => {
        if (!allowed.has(k)) {
            const prop = path ? `${path}.${k}` : null;
            errors.push(new ValidationError(prop, obj[k], `Unsupported property "${k}"`));
        }
    });
    return errors;
}

const acceptedSourceTypes = new Set<SourceSpecification['type']>(['vector', 'raster', 'raster-dem', 'raster-array', 'model', 'batched-model']);
function getSourceErrors(source: SourceSpecification, i: number): Array<ValidationError> {
    const errors: ValidationError[] = [];

    /*
     * Inlined sources are not supported by the Mapbox Styles API, so only
     * "type", "url", and "tileSize", "promoteId" properties are valid
     */
    const sourceKeys = ['type', 'url', 'tileSize', 'promoteId'];
    errors.push(...getAllowedKeyErrors(source, sourceKeys, 'source'));

    /*
     * "type" is required and must be one of "vector", "raster", "raster-dem", "raster-array"
     */
    if (!acceptedSourceTypes.has(String(source.type) as SourceSpecification['type'])) {
        errors.push(new ValidationError(`sources[${i}].type`, source.type, `Expected one of [${Array.from(acceptedSourceTypes).join(", ")}]`));
    }

    /*
     * "source" is required. Valid examples:
     * mapbox://mapbox.abcd1234
     * mapbox://penny.abcd1234
     * mapbox://mapbox.abcd1234,penny.abcd1234
     */
    const sourceUrlPattern = /^mapbox:\/\/([^/]*)$/;
    if (!('url' in source) || !isValid(source.url, sourceUrlPattern)) {
        errors.push(new ValidationError(`sources[${i}].url`, (source as {url?: string}).url, 'Expected a valid Mapbox tileset url'));
    }

    return errors;
}

function getMaxSourcesErrors(sourcesCount: number): Array<ValidationError> {
    const errors: ValidationError[] = [];
    if (sourcesCount > MAX_SOURCES_IN_STYLE) {
        errors.push(new ValidationError('sources', null, `Styles must contain ${MAX_SOURCES_IN_STYLE} or fewer sources`));
    }
    return errors;
}

function getSourcesErrors(sources: SourcesSpecification): {
    errors: Array<ValidationError>;
    sourcesCount: number;
} {
    const errors = [];
    let sourcesCount = 0;

    Object.keys(sources).forEach((s: string, i: number) => {
        const sourceErrors = getSourceErrors(sources[s], i);

        // If source has errors, skip counting
        if (!sourceErrors.length) {
            sourcesCount = sourcesCount + getSourceCount(sources[s]);
        }

        errors.push(...sourceErrors);
    });

    return {errors, sourcesCount};
}

function getImportErrors(imports: ImportSpecification[] = []): {errors: Array<ValidationError>; sourcesCount: number} {
    let errors: Array<ValidationError> = [];

    let sourcesCount = 0;
    const validateImports = (imports: ImportSpecification[] = []) => {
        for (const importSpec of imports) {
            const style = importSpec.data;
            if (!style) continue;

            if (style.imports) {
                validateImports(style.imports);
            }

            errors = errors.concat(getRootErrors(style, Object.keys(v8.$root)));

            if (style.sources) {
                const sourcesErrors = getSourcesErrors(style.sources);
                sourcesCount += sourcesErrors.sourcesCount;
                errors = errors.concat(sourcesErrors.errors);
            }
        }
    };

    validateImports(imports);
    if (imports.length !== (new Set(imports.map(i => i.id))).size) {
        errors.push(new ValidationError(null, null, 'Duplicate ids of imports'));
    }

    return {errors, sourcesCount};
}

function getRootErrors(style: MapboxStyleSpecification, specKeys: string[]): Array<ValidationError> {
    const errors: ValidationError[] = [];

    /*
     * The following keys are optional but fully managed by the Mapbox Styles
     * API. Values on stylesheet on POST or PATCH will be ignored: "owner",
     * "id", "cacheControl", "draft", "created", "modified", "protected"
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
        'visibility',
        'protected',
        'models',
        'lights'
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

    if (style.protected !== undefined && !isBoolean(style.protected)) {
        errors.push(new ValidationError('protected', style.protected, 'Style protection must be true or false'));
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
export default function validateMapboxApiSupported(style: MapboxStyleSpecification, styleSpec: StyleReference = v8): ValidationErrors {
    let s = style;
    try {
        s = readStyle(s);
    } catch (e) {
        return [e] as ValidationErrors;
    }

    let errors = validateStyle(s, styleSpec)
        .concat(getRootErrors(s, Object.keys(v8.$root)));

    let sourcesCount = 0;
    if (s.sources) {
        const sourcesErrors = getSourcesErrors(s.sources);
        sourcesCount += sourcesErrors.sourcesCount;
        errors = errors.concat(sourcesErrors.errors);
    }

    if (s.imports) {
        const importsErrors = getImportErrors(s.imports);
        sourcesCount += importsErrors.sourcesCount;
        errors = errors.concat(importsErrors.errors);
    }

    errors = errors.concat(getMaxSourcesErrors(sourcesCount));

    return errors;
}
