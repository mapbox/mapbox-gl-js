// @flow

type ExpressionType = 'data-driven' | 'cross-faded' | 'cross-faded-data-driven' | 'color-ramp' | 'data-constant';
type ExpressionParameters = Array<'zoom' | 'feature' | 'heatmap-density' | 'line-progress'>;

type ExpressionSpecification = {
    type: ExpressionType,
    interpolated: boolean,
    parameters: ExpressionParameters
}

export type StylePropertySpecification = {
    type: 'number',
    expression?: ExpressionSpecification,
    default?: number
} | {
    type: 'string',
    expression?: ExpressionSpecification,
    default?: string,
    tokens?: boolean
} | {
    type: 'boolean',
    expression?: ExpressionSpecification,
    default?: boolean
} | {
    type: 'enum',
    expression?: ExpressionSpecification,
    values: {[string]: {}},
    default?: string
} | {
    type: 'color',
    expression?: ExpressionSpecification,
    default?: string
} | {
    type: 'array',
    value: 'number',
    expression?: ExpressionSpecification,
    length?: number,
    default?: Array<number>
} | {
    type: 'array',
    value: 'string',
    expression?: ExpressionSpecification,
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
import { StyleExpression, isExpression, createExpression, createPropertyExpression, normalizePropertyExpression, ZoomConstantExpression, ZoomDependentExpression, StylePropertyFunction } from './expression';
import featureFilter from './feature_filter';
import Color from './util/color';
import { createFunction, isFunction } from './function';
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
    expression: {
        StyleExpression,
        isExpression,
        createExpression,
        createPropertyExpression,
        normalizePropertyExpression,
        ZoomConstantExpression,
        ZoomDependentExpression,
        StylePropertyFunction
    },
    featureFilter,
    Color,
    function: {
        convertFunction,
        createFunction,
        isFunction
    },
    validate
};

export default exported;

validate.parsed = validate;
validate.latest = validate;
