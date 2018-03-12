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

import v8 from './reference/v8.json';
export {v8};

import latest from './reference/latest';
import format from './format';
import migrate from './migrate';
import composite from './composite';
import diff from './diff';
import ValidationError from './error/validation_error';
import ParsingError from './error/parsing_error';
import expression from './expression';
import featureFilter from './feature_filter';
import Color from './util/color';
import styleFunction from './function';
import convertFunction from './function/convert';

import validate from './validate_style';

const exported = {
    latest,
    format,
    migrate,
    composite,
    diff,
    ValidationError,
    ParsingError,
    expression,
    featureFilter,
    Color,
    function: styleFunction,
    validate
};

export default exported;

exported.function.convertFunction = convertFunction;

validate.parsed = validate;
validate.latest = validate;
