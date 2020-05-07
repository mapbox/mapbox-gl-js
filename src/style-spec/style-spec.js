// @flow

type ExpressionType = 'data-driven' | 'cross-faded' | 'cross-faded-data-driven' | 'color-ramp' | 'data-constant' | 'constant';
type ExpressionParameters = Array<'zoom' | 'feature' | 'feature-state' | 'heatmap-density' | 'line-progress' | 'sky-radial-progress'>;

type ExpressionSpecification = {
    interpolated: boolean,
    parameters: ExpressionParameters
}

export type StylePropertySpecification = {
    type: 'number',
    'property-type': ExpressionType,
    expression?: ExpressionSpecification,
    transition: boolean,
    default?: number
} | {
    type: 'string',
    'property-type': ExpressionType,
    expression?: ExpressionSpecification,
    transition: boolean,
    default?: string,
    tokens?: boolean
} | {
    type: 'boolean',
    'property-type': ExpressionType,
    expression?: ExpressionSpecification,
    transition: boolean,
    default?: boolean
} | {
    type: 'enum',
    'property-type': ExpressionType,
    expression?: ExpressionSpecification,
    values: {[_: string]: {}},
    transition: boolean,
    default?: string
} | {
    type: 'color',
    'property-type': ExpressionType,
    expression?: ExpressionSpecification,
    transition: boolean,
    default?: string,
    overridable: boolean
} | {
    type: 'array',
    value: 'number',
    'property-type': ExpressionType,
    expression?: ExpressionSpecification,
    length?: number,
    transition: boolean,
    default?: Array<number>
} | {
    type: 'array',
    value: 'string',
    'property-type': ExpressionType,
    expression?: ExpressionSpecification,
    length?: number,
    transition: boolean,
    default?: Array<string>
};

import v8 from './reference/v8.json';
import latest from './reference/latest';
import format from './format';
import migrate from './migrate';
import composite from './composite';
import derefLayers from './deref';
import diff from './diff';
import ValidationError from './error/validation_error';
import ParsingError from './error/parsing_error';
import {StyleExpression, isExpression, createExpression, createPropertyExpression, normalizePropertyExpression, ZoomConstantExpression, ZoomDependentExpression, StylePropertyFunction} from './expression';
import featureFilter, {isExpressionFilter} from './feature_filter';

import convertFilter from './feature_filter/convert';
import Color from './util/color';
import {createFunction, isFunction} from './function';
import convertFunction from './function/convert';
import {eachSource, eachLayer, eachProperty} from './visit';

import validate from './validate_style';
import validateMapboxApiSupported from './validate_mapbox_api_supported';

const expression = {
    StyleExpression,
    isExpression,
    isExpressionFilter,
    createExpression,
    createPropertyExpression,
    normalizePropertyExpression,
    ZoomConstantExpression,
    ZoomDependentExpression,
    StylePropertyFunction
};

const styleFunction = {
    convertFunction,
    createFunction,
    isFunction
};

const visit = {eachSource, eachLayer, eachProperty};

export {
    v8,
    latest,
    format,
    migrate,
    composite,
    derefLayers,
    diff,
    ValidationError,
    ParsingError,
    expression,
    featureFilter,
    convertFilter,
    Color,
    styleFunction as function,
    validate,
    validateMapboxApiSupported,
    visit
};

validate.parsed = validate;
validate.latest = validate;
