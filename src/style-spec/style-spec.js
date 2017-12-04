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
    default?: string
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

exports.v8 = require('./reference/v8.json');
exports.latest = require('./reference/latest');

exports.format = require('./format');
exports.migrate = require('./migrate');
exports.composite = require('./composite');
exports.diff = require('./diff');
exports.ValidationError = require('./error/validation_error');
exports.ParsingError = require('./error/parsing_error');
exports.expression = require('./expression');
exports.featureFilter = require('./feature_filter');

exports.function = require('./function');
exports.function.convertFunction = require('./function/convert');

exports.validate = require('./validate_style');
exports.validate.parsed = require('./validate_style');
exports.validate.latest = require('./validate_style');
