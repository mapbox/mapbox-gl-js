// @flow

const assert = require('assert');
const {extend, easeCubicInOut} = require('../util/util');
const interpolate = require('../style-spec/util/interpolate');
const {RGBAImage} = require('../util/image');
const {normalizePropertyExpression} = require('../style-spec/expression');
const Color = require('../style-spec/util/color');

import type {StylePropertySpecification} from '../style-spec/style-spec';
import type {CrossFaded} from './cross_faded';
import type {ZoomHistory} from './style';

import type {
    Feature,
    GlobalProperties,
    StylePropertyExpression,
    SourceExpression,
    CompositeExpression
} from '../style-spec/expression';

type TimePoint = number;

type TransitionParameters = {
    now: TimePoint,
    transition: TransitionSpecification
};

export type EvaluationParameters = GlobalProperties & {
    now?: TimePoint,
    defaultFadeDuration?: number,
    zoomHistory?: ZoomHistory
};

export interface Property<T, R> {
    specification: StylePropertySpecification;
    possiblyEvaluate(value: PropertyValue<T, R>, parameters: EvaluationParameters): R;
    interpolate(a: R, b: R, t: number): R;
}

class PropertyValue<T, R> {
    property: Property<T, R>;
    value: PropertyValueSpecification<T> | void;
    expression: StylePropertyExpression;

    constructor(property: Property<T, R>, value: PropertyValueSpecification<T> | void) {
        this.property = property;
        this.value = value;
        this.expression = normalizePropertyExpression(value === undefined ? property.specification.default : value, property.specification);
    }

    isDataDriven(): boolean {
        return this.expression.kind === 'source' || this.expression.kind === 'composite';
    }

    possiblyEvaluate(parameters: EvaluationParameters): R {
        return this.property.possiblyEvaluate(this, parameters);
    }
}

// ------- Transitionable -------

class TransitionablePropertyValue<T, R> {
    property: Property<T, R>;
    value: PropertyValue<T, R>;
    transition: TransitionSpecification | void;

    constructor(property: Property<T, R>) {
        this.property = property;
        this.value = new PropertyValue(property, undefined);
    }

    transitioned(parameters: TransitionParameters,
                 prior: TransitioningPropertyValue<T, R>): TransitioningPropertyValue<T, R> {
        return new TransitioningPropertyValue(this.property, this.value, prior, extend({}, this.transition, parameters.transition), parameters.now); // eslint-disable-line no-use-before-define
    }

    untransitioned(): TransitioningPropertyValue<T, R> {
        return new TransitioningPropertyValue(this.property, this.value, null, {}, 0); // eslint-disable-line no-use-before-define
    }
}

type TransitionablePropertyValues<Properties: Object>
    = $Exact<$ObjMap<Properties, <T, R>(p: Property<T, R>) => TransitionablePropertyValue<T, R>>>

class Transitionable<Properties: Object> {
    _values: TransitionablePropertyValues<Properties>;

    constructor(properties: Properties) {
        const values = this._values = ({}: any);
        for (const property in properties) {
            values[property] = new TransitionablePropertyValue(properties[property]);
        }
    }

    getValue<S: string>(name: S) {
        return this._values[name].value.value;
    }

    setValue<S: string>(name: S, value: *) {
        this._values[name].value = new PropertyValue(this._values[name].property, value === null ? undefined : value);
    }

    getTransition<S: string>(name: S): TransitionSpecification | void {
        return this._values[name].transition;
    }

    setTransition<S: string>(name: S, value: TransitionSpecification | void) {
        this._values[name].transition = value || undefined;
    }

    serialize() {
        const result: any = {};
        for (const property in this._values) {
            const value = this.getValue(property);
            if (value !== undefined) {
                result[property] = value;
            }

            const transition = this.getTransition(property);
            if (transition !== undefined) {
                result[`${property}-transition`] = transition;
            }
        }
        return result;
    }

    transitioned(parameters: TransitionParameters, prior: Transitioning<Properties>): Transitioning<Properties> {
        const result: any = {};
        for (const property in this._values) {
            result[property] = this._values[property].transitioned(parameters, prior._values[property]);
        }
        return new Transitioning(result); // eslint-disable-line no-use-before-define
    }

    untransitioned(): Transitioning<Properties> {
        const result: any = {};
        for (const property in this._values) {
            result[property] = this._values[property].untransitioned();
        }
        return new Transitioning(result); // eslint-disable-line no-use-before-define
    }
}

// ------- Transitioning -------

class TransitioningPropertyValue<T, R> {
    property: Property<T, R>;
    value: PropertyValue<T, R>;
    prior: ?TransitioningPropertyValue<T, R>;
    begin: TimePoint;
    end: TimePoint;

    constructor(property: Property<T, R>,
                value: PropertyValue<T, R>,
                prior: ?TransitioningPropertyValue<T, R>,
                transition: TransitionSpecification,
                now: TimePoint) {
        this.property = property;
        this.value = value;
        this.begin = now + transition.delay || 0;
        this.end = this.begin + transition.duration || 0;
        if (transition.delay || transition.duration) {
            this.prior = prior;
        }
    }

    possiblyEvaluate(parameters: EvaluationParameters): R {
        const now = parameters.now || 0;
        const finalValue = this.value.possiblyEvaluate(parameters);
        const prior = this.prior;
        if (!prior) {
            // No prior value.
            return finalValue;
        } else if (now > this.end) {
            // Transition from prior value is now complete.
            this.prior = null;
            return finalValue;
        } else if (this.value.isDataDriven()) {
            // Transitions to data-driven properties are not supported.
            // We snap immediately to the data-driven value so that, when we perform layout,
            // we see the data-driven function and can use it to populate vertex buffers.
            this.prior = null;
            return finalValue;
        } else if (now < this.begin) {
            // Transition hasn't started yet.
            return prior.possiblyEvaluate(parameters);
        } else {
            // Interpolate between recursively-calculated prior value and final.
            const t = (now - this.begin) / (this.end - this.begin);
            return this.property.interpolate(prior.possiblyEvaluate(parameters), finalValue, easeCubicInOut(t));
        }
    }
}

type TransitioningPropertyValues<Properties: Object>
    = $Exact<$ObjMap<Properties, <T, R>(p: Property<T, R>) => TransitioningPropertyValue<T, R>>>

class Transitioning<Properties: Object> {
    _values: TransitioningPropertyValues<Properties>;

    constructor(values: TransitioningPropertyValues<Properties>) {
        this._values = values;
    }

    possiblyEvaluate(parameters: EvaluationParameters): PossiblyEvaluated<Properties> {
        const result: any = {};
        for (const property in this._values) {
            result[property] = this._values[property].possiblyEvaluate(parameters);
        }
        return new PossiblyEvaluated(result); // eslint-disable-line no-use-before-define
    }

    hasTransition() {
        for (const property in this._values) {
            if (this._values[property].prior) {
                return true;
            }
        }
        return false;
    }
}

// ------- Layout -------

type LayoutPropertyValues<Properties: Object>
    = $Exact<$ObjMap<Properties, <T, R>(p: Property<T, R>) => PropertyValue<T, R>>>

class Layout<Properties: Object> {
    _values: LayoutPropertyValues<Properties>;

    constructor(properties: Properties) {
        const values = this._values = ({}: any);
        for (const property in properties) {
            values[property] = new PropertyValue(properties[property], undefined);
        }
    }

    getValue<S: string>(name: S) {
        return this._values[name].value;
    }

    setValue<S: string>(name: S, value: *) {
        this._values[name] = new PropertyValue(this._values[name].property, value === null ? undefined : value);
    }

    serialize() {
        const result: any = {};
        for (const property in this._values) {
            const value = this.getValue(property);
            if (value !== undefined) {
                result[property] = value;
            }
        }
        return result;
    }

    possiblyEvaluate(parameters: EvaluationParameters): PossiblyEvaluated<Properties> {
        const result: any = {};
        for (const property in this._values) {
            result[property] = this._values[property].possiblyEvaluate(parameters);
        }
        return new PossiblyEvaluated(result); // eslint-disable-line no-use-before-define
    }
}

// ------- PossiblyEvaluated -------

export type PossiblyEvaluatedValue<T> =
    | {kind: 'constant', value: T}
    | SourceExpression
    | CompositeExpression;

class PossiblyEvaluatedPropertyValue<T> {
    property: DataDrivenProperty<T>;
    value: PossiblyEvaluatedValue<T>;
    globals: GlobalProperties;

    constructor(property: DataDrivenProperty<T>, value: PossiblyEvaluatedValue<T>, globals: GlobalProperties) {
        this.property = property;
        this.value = value;
        this.globals = globals;
    }

    isConstant(): boolean {
        return this.value.kind === 'constant';
    }

    constantOr(value: T): T {
        if (this.value.kind === 'constant') {
            return this.value.value;
        } else {
            return value;
        }
    }

    evaluate(feature: Feature): T {
        return this.property.evaluate(this.value, this.globals, feature);
    }
}

type PossiblyEvaluatedPropertyValues<Properties: Object>
    = $Exact<$ObjMap<Properties, <T, R>(p: Property<T, R>) => R>>

class PossiblyEvaluated<Properties: Object> {
    _values: PossiblyEvaluatedPropertyValues<Properties>;

    constructor(values: PossiblyEvaluatedPropertyValues<Properties>) {
        this._values = values;
    }

    get<S: string>(name: S): $ElementType<PossiblyEvaluatedPropertyValues<Properties>, S> {
        return this._values[name];
    }
}

class DataConstantProperty<T> implements Property<T, T> {
    specification: StylePropertySpecification;

    constructor(specification: StylePropertySpecification) {
        this.specification = specification;
    }

    possiblyEvaluate(value: PropertyValue<T, T>, parameters: EvaluationParameters): T {
        assert(!value.isDataDriven());
        return value.expression.evaluate(parameters);
    }

    interpolate(a: T, b: T, t: number): T {
        const interp: ?(a: T, b: T, t: number) => T = (interpolate: any)[this.specification.type];
        if (interp) {
            return interp(a, b, t);
        } else {
            return a;
        }
    }
}

class DataDrivenProperty<T> implements Property<T, PossiblyEvaluatedPropertyValue<T>> {
    specification: StylePropertySpecification;
    useIntegerZoom: boolean;

    constructor(specification: StylePropertySpecification, useIntegerZoom: boolean = false) {
        this.specification = specification;
        this.useIntegerZoom = useIntegerZoom;
    }

    possiblyEvaluate(value: PropertyValue<T, PossiblyEvaluatedPropertyValue<T>>, parameters: EvaluationParameters): PossiblyEvaluatedPropertyValue<T> {
        if (this.useIntegerZoom) {
            parameters = extend({}, parameters, {zoom: Math.floor(parameters.zoom)});
        }
        if (value.expression.kind === 'constant' || value.expression.kind === 'camera') {
            return new PossiblyEvaluatedPropertyValue(this, {kind: 'constant', value: value.expression.evaluate(parameters)}, parameters);
        } else {
            return new PossiblyEvaluatedPropertyValue(this, value.expression, parameters);
        }
    }

    interpolate(a: PossiblyEvaluatedPropertyValue<T>,
                b: PossiblyEvaluatedPropertyValue<T>,
                t: number): PossiblyEvaluatedPropertyValue<T> {
        if (a.value.kind !== 'constant' || b.value.kind !== 'constant') {
            return a;
        }

        // Special case hack solely for fill-outline-color.
        if (a.value.value === undefined || a.value.value === undefined)
            return (undefined: any);

        const interp: ?(a: T, b: T, t: number) => T = (interpolate: any)[this.specification.type];
        if (interp) {
            return new PossiblyEvaluatedPropertyValue(this, {kind: 'constant', value: interp(a.value.value, b.value.value, t)}, a.globals);
        } else {
            return a;
        }
    }

    evaluate(value: PossiblyEvaluatedValue<T>, globals: GlobalProperties, feature: Feature): T {
        if (this.useIntegerZoom) {
            globals = extend({}, globals, {zoom: Math.floor(globals.zoom)});
        }
        if (value.kind === 'constant') {
            return value.value;
        } else {
            return value.evaluate(globals, feature);
        }
    }
}

class CrossFadedProperty<T> implements Property<T, ?CrossFaded<T>> {
    specification: StylePropertySpecification;

    constructor(specification: StylePropertySpecification) {
        this.specification = specification;
    }

    possiblyEvaluate(value: PropertyValue<T, ?CrossFaded<T>>, parameters: EvaluationParameters): ?CrossFaded<T> {
        if (value.value === undefined) {
            return undefined;
        } else if (value.expression.kind === 'constant') {
            const constant = value.expression.evaluate(parameters);
            return this._calculate(constant, constant, constant, parameters);
        } else {
            assert(!value.isDataDriven());
            return this._calculate(
                value.expression.evaluate({zoom: parameters.zoom - 1.0}),
                value.expression.evaluate({zoom: parameters.zoom}),
                value.expression.evaluate({zoom: parameters.zoom + 1.0}),
                parameters);
        }
    }

    _calculate(min: T, mid: T, max: T, parameters: any): ?CrossFaded<T> {
        const z = parameters.zoom;
        const fraction = z - Math.floor(z);
        const d = parameters.defaultFadeDuration;
        const t = d !== 0 ? Math.min((parameters.now - parameters.zoomHistory.lastIntegerZoomTime) / d, 1) : 1;
        return z > parameters.zoomHistory.lastIntegerZoom ?
            { from: min, to: mid, fromScale: 2, toScale: 1, t: fraction + (1 - fraction) * t } :
            { from: max, to: mid, fromScale: 0.5, toScale: 1, t: 1 - (1 - t) * fraction };
    }

    interpolate(a: ?CrossFaded<T>): ?CrossFaded<T> {
        return a;
    }
}

class HeatmapColorProperty implements Property<Color, RGBAImage> {
    specification: StylePropertySpecification;

    constructor(specification: StylePropertySpecification) {
        this.specification = specification;
    }

    possiblyEvaluate(value: PropertyValue<Color, RGBAImage>, parameters: EvaluationParameters): RGBAImage {
        const colorRampData = new Uint8Array(256 * 4);
        const len = colorRampData.length;
        for (let i = 4; i < len; i += 4) {
            const pxColor = value.expression.evaluate(extend({heatmapDensity: i / len}, parameters));
            // the colors are being unpremultiplied because Color uses
            // premultiplied values, and the Texture class expects unpremultiplied ones
            colorRampData[i + 0] = Math.floor(pxColor.r * 255 / pxColor.a);
            colorRampData[i + 1] = Math.floor(pxColor.g * 255 / pxColor.a);
            colorRampData[i + 2] = Math.floor(pxColor.b * 255 / pxColor.a);
            colorRampData[i + 3] = Math.floor(pxColor.a * 255);
        }
        return RGBAImage.create({width: 256, height: 1}, colorRampData);
    }

    interpolate(a: RGBAImage): RGBAImage {
        return a;
    }
}

module.exports = {
    PropertyValue,
    Transitionable,
    Transitioning,
    Layout,
    PossiblyEvaluatedPropertyValue,
    PossiblyEvaluated,
    DataConstantProperty,
    DataDrivenProperty,
    CrossFadedProperty,
    HeatmapColorProperty
};
