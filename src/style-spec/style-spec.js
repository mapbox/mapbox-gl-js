// @flow

type ExpressionType = 'data-driven' | 'cross-faded' | 'cross-faded-data-driven' | 'color-ramp' | 'data-constant' | 'constant';
type ExpressionParameters = Array<'zoom' | 'feature' | 'feature-state' | 'heatmap-density' | 'line-progress' | 'sky-radial-progress' | 'pitch' | 'distance-from-center'>;

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
import latest from './reference/latest.js';
import format from './format.js';
import migrate from './migrate.js';
import composite from './composite.js';
import derefLayers from './deref.js';
import diff from './diff.js';
import ValidationError from './error/validation_error.js';
import ParsingError from './error/parsing_error.js';
import {StyleExpression, isExpression, createExpression, createPropertyExpression, normalizePropertyExpression, ZoomConstantExpression, ZoomDependentExpression, StylePropertyFunction} from './expression/index.js';
import featureFilter, {isExpressionFilter} from './feature_filter/index.js';

import convertFilter from './feature_filter/convert.js';
import Color from './util/color.js';
import {createFunction, isFunction} from './function/index.js';
import convertFunction from './function/convert.js';
import {eachSource, eachLayer, eachProperty} from './visit.js';

import validate from './validate_style.js';
import validateMapboxApiSupported from './validate_mapbox_api_supported.js';

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
