import v8 from './reference/v8.json';
import latest from './reference/latest';
import format from './format';
import migrate from './migrate';
import composite from './composite';
import derefLayers from './deref';
import diff from './diff';
import ValidationError from './error/validation_error';
import ParsingError from './error/parsing_error';
import {StyleExpression, isExpression, createExpression, createPropertyExpression, normalizePropertyExpression, ZoomConstantExpression, ZoomDependentExpression, StylePropertyFunction} from './expression/index';
import featureFilter, {isExpressionFilter} from './feature_filter/index';
import convertFilter from './feature_filter/convert';
import Color from './util/color';
import {createFunction, isFunction} from './function/index';
import convertFunction from './function/convert';
import {eachSource, eachLayer, eachProperty} from './visit';
import validate from './validate_style';
import validateMapboxApiSupported from './validate_mapbox_api_supported';

export type * from './types';

type ExpressionType = 'data-driven' | 'color-ramp' | 'data-constant' | 'constant';

type ExpressionParameter =
    | 'zoom'
    | 'pitch'
    | 'feature'
    | 'raster-value'
    | 'feature-state'
    | 'line-progress'
    | 'measure-light'
    | 'heatmap-density'
    | 'sky-radial-progress'
    | 'distance-from-center'
    | 'raster-particle-speed';

export type PropertyExpressionSpecification = {
    interpolated: boolean,
    parameters?: ExpressionParameter[],
    relaxZoomRestriction?: boolean
};

export type ArrayPropertySpecification =
    {
        type: 'array';
        'property-type': ExpressionType;
        value: 'enum';
        expression?: PropertyExpressionSpecification,
        transition?: boolean,
        default?: string[],
        length?: number,
        values?: {[_: string]: unknown},
        experimental?: boolean,
        private?: boolean,
        requires?: unknown,
        appearance?: boolean,
        tokens?: never,
        minimum?: never,
        maximum?: never,
    } | {
        type: 'array';
        'property-type': ExpressionType;
        value: 'number';
        expression?: PropertyExpressionSpecification;
        transition?: boolean;
        default?: number[];
        minimum?: number;
        maximum?: number;
        length?: number;
        period?: number;
        units?: string;
        experimental?: boolean;
        private?: boolean;
        requires?: unknown;
        appearance?: boolean;
        tokens?: never;
        values?: never;
    } | {
        type: 'array';
        'property-type': ExpressionType;
        value: 'string';
        expression?: PropertyExpressionSpecification;
        transition?: boolean;
        default?: string[];
        length?: number;
        experimental?: boolean;
        private?: boolean;
        requires?: unknown;
        appearance?: boolean;
        tokens?: never;
        minimum?: never;
        maximum?: never;
        values?: never;
    };

export type BooleanPropertySpecification = {
    type: 'boolean';
    'property-type': ExpressionType;
    expression?: PropertyExpressionSpecification;
    transition?: boolean;
    default?: boolean;
    overridable?: boolean;
    experimental?: boolean;
    private?: boolean;
    requires?: unknown;
    appearance?: boolean;
    tokens?: never;
};

export type ColorPropertySpecification = {
    type: 'color';
    'property-type': ExpressionType;
    expression?: PropertyExpressionSpecification;
    transition?: boolean;
    default?: string;
    'use-theme'?: boolean;
    overridable?: boolean;
    experimental?: boolean;
    private?: boolean;
    requires?: unknown;
    appearance?: boolean;
    tokens?: never;
};

export type EnumPropertySpecification = {
    type: 'enum';
    'property-type': ExpressionType;
    expression?: PropertyExpressionSpecification;
    transition?: boolean;
    default?: string;
    values?: {[_: string]: unknown};
    experimental?: boolean;
    private?: boolean;
    requires?: unknown;
    appearance?: boolean;
    tokens?: never;
};

export type FormattedPropertySpecification = {
    type: 'formatted';
    'property-type': ExpressionType;
    expression?: PropertyExpressionSpecification;
    transition?: boolean;
    default?: string;
    tokens?: boolean;
    experimental?: boolean;
    private?: boolean;
    requires?: unknown;
    appearance?: boolean;
};

export type NumberPropertySpecification = {
    type: 'number';
    'property-type': ExpressionType;
    expression?: PropertyExpressionSpecification;
    transition?: boolean;
    default?: number;
    minimum?: number;
    maximum?: number;
    period?: number;
    units?: string;
    experimental?: boolean;
    private?: boolean;
    requires?: unknown;
    appearance?: boolean;
    tokens?: never;
};

export type ResolvedImagePropertySpecification = {
    type: 'resolvedImage';
    'property-type': ExpressionType;
    expression?: PropertyExpressionSpecification;
    transition?: boolean;
    default?: string;
    tokens?: boolean;
    'use-theme'?: boolean;
    experimental?: boolean;
    private?: boolean;
    requires?: unknown;
    appearance?: boolean;
};

export type StringPropertySpecification = {
    type: 'string';
    'property-type': ExpressionType;
    expression?: PropertyExpressionSpecification;
    transition?: boolean;
    default?: string;
    tokens?: boolean;
    experimental?: boolean;
    private?: boolean;
    requires?: unknown;
    appearance?: boolean;
};

/**
 * A style property specification is used to describe a value of some style property reference in the v8.json
 */
export type StylePropertySpecification =
    | ArrayPropertySpecification
    | BooleanPropertySpecification
    | ColorPropertySpecification
    | EnumPropertySpecification
    | FormattedPropertySpecification
    | NumberPropertySpecification
    | ResolvedImagePropertySpecification
    | StringPropertySpecification;

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
