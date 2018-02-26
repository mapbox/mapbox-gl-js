// @flow

export type StylePropertySpecification = {
    type: 'number',
    'function': boolean,
    'property-function': boolean,
    'zoom-function': boolean,
    default?: number
} | {
    type: 'string',
    'function': boolean,
    'property-function': boolean,
    'zoom-function': boolean,
    default?: string,
    tokens?: boolean
} | {
    type: 'boolean',
    'function': boolean,
    'property-function': boolean,
    'zoom-function': boolean,
    default?: boolean
} | {
    type: 'enum',
    'function': boolean,
    'property-function': boolean,
    'zoom-function': boolean,
    values: {[string]: {}},
    default?: string
} | {
    type: 'color',
    'function': boolean,
    'property-function': boolean,
    'zoom-function': boolean,
    default?: string
} | {
    type: 'array',
    value: 'number',
    'function': boolean,
    'property-function': boolean,
    'zoom-function': boolean,
    length?: number,
    default?: Array<number>
} | {
    type: 'array',
    value: 'string',
    'function': boolean,
    'property-function': boolean,
    'zoom-function': boolean,
    length?: number,
    default?: Array<string>
};

export const v8 = require('./reference/v8.json');
export const latest = require('./reference/latest');
export const format = require('./format');
export const migrate = require('./migrate');
export const composite = require('./composite');
export const diff = require('./diff');
export const ValidationError = require('./error/validation_error');
export const ParsingError = require('./error/parsing_error');
export const expression = require('./expression');
export const featureFilter = require('./feature_filter');
export const Color = require('./util/color');
export const function = require('./function');
exports.function.convertFunction = require('./function/convert');

export const validate = require('./validate_style');
exports.validate.parsed = require('./validate_style');
exports.validate.latest = require('./validate_style');
