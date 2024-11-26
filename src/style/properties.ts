import assert from 'assert';
import {clone, extend, endsWith, easeCubicInOut, sphericalDirectionToCartesian, sphericalPositionToCartesian} from '../util/util';
import * as interpolate from '../style-spec/util/interpolate';
import {number as interpolateValue} from '../style-spec/util/interpolate';
import {normalizePropertyExpression} from '../style-spec/expression/index';
import {register} from '../util/web_worker_transfer';
import EvaluationParameters from './evaluation_parameters';

import type Color from '../style-spec/util/color';
import type {Direction, Position} from '../util/util';
import type {CanonicalTileID} from '../source/tile_id';
import type {StylePropertySpecification} from '../style-spec/style-spec';
import type {
    TransitionSpecification,
    PropertyValueSpecification
} from '../style-spec/types';
import type {
    Feature,
    FeatureState,
    StylePropertyExpression,
    SourceExpression,
    CompositeExpression
} from '../style-spec/expression/index';
import type {ConfigOptions} from '../style-spec/types/config_options';
export type {ConfigOptions};

type TimePoint = number;

/**
 * Implements a number of classes that define state and behavior for paint and layout properties, most
 * importantly their respective evaluation chains:
 *
 *       Transitionable paint property value
 *     → Transitioning paint property value
 *     → Possibly evaluated paint property value
 *     → Fully evaluated paint property value
 *
 *       Layout property value
 *     → Possibly evaluated layout property value
 *     → Fully evaluated layout property value
 *
 * @module
 * @private
 */

/**
 *  Implementations of the `Property` interface:
 *
 *  * Hold metadata about a property that's independent of any specific value: stuff like the type of the value,
 *    the default value, etc. This comes from the style specification JSON.
 *  * Define behavior that needs to be polymorphic across different properties: "possibly evaluating"
 *    an input value (see below), and interpolating between two possibly-evaluted values.
 *
 *  The type `T` is the fully-evaluated value type (e.g. `number`, `string`, `Color`).
 *  The type `R` is the intermediate "possibly evaluated" value type. See below.
 *
 *  There are two main implementations of the interface -- one for properties that allow data-driven values,
 *  and one for properties that don't. There are a few "special case" implementations as well:
 *  one for `heatmap-color` and `line-gradient`, and one for `light-position`.
 *
 * @private
 */
export interface Property<T, R> {
    specification: StylePropertySpecification;
    possiblyEvaluate: (
        value: PropertyValue<T, R>,
        parameters: EvaluationParameters,
        canonical?: CanonicalTileID,
        availableImages?: Array<string>,
    ) => R;
    interpolate: (a: R, b: R, t: number) => R;
}

/**
 *  `PropertyValue` represents the value part of a property key-value unit. It's used to represent both
 *  paint and layout property values, and regardless of whether or not their property supports data-driven
 *  expressions.
 *
 *  `PropertyValue` stores the raw input value as seen in a style or a runtime styling API call, i.e. one of the
 *  following:
 *
 *    * A constant value of the type appropriate for the property
 *    * A function which produces a value of that type (but functions are quasi-deprecated in favor of expressions)
 *    * An expression which produces a value of that type
 *    * "undefined"/"not present", in which case the property is assumed to take on its default value.
 *
 *  In addition to storing the original input value, `PropertyValue` also stores a normalized representation,
 *  effectively treating functions as if they are expressions, and constant or default values as if they are
 *  (constant) expressions.
 *
 *  @private
 */
export class PropertyValue<T, R> {
    property: Property<T, R>;
    value: PropertyValueSpecification<T> | undefined;
    expression: StylePropertyExpression;

    constructor(property: Property<T, R>, value?: PropertyValueSpecification<T>, scope?: string | null, options?: ConfigOptions | null) {
        this.property = property;
        this.value = value;
        this.expression = normalizePropertyExpression(value === undefined ? property.specification.default : value, property.specification, scope, options);
    }

    isDataDriven(): boolean {
        return this.expression.kind === 'source' || this.expression.kind === 'composite';
    }

    possiblyEvaluate(
        parameters: EvaluationParameters,
        canonical?: CanonicalTileID,
        availableImages?: Array<string>,
    ): R {
        return this.property.possiblyEvaluate(this, parameters, canonical, availableImages);
    }
}

// ------- Transitionable -------

export type TransitionParameters = {
    now: TimePoint;
    transition: TransitionSpecification;
};

/**
 * Paint properties are _transitionable_: they can change in a fluid manner, interpolating or cross-fading between
 * old and new value. The duration of the transition, and the delay before it begins, is configurable.
 *
 * `TransitionablePropertyValue` is a compositional class that stores both the property value and that transition
 * configuration.
 *
 * A `TransitionablePropertyValue` can calculate the next step in the evaluation chain for paint property values:
 * `TransitioningPropertyValue`.
 *
 * @private
 */
class TransitionablePropertyValue<T, R> {
    property: Property<T, R>;
    value: PropertyValue<T, R>;
    transition: TransitionSpecification | undefined;

    constructor(property: Property<T, R>, scope?: string | null, options?: ConfigOptions | null) {
        this.property = property;
        this.value = new PropertyValue(property, undefined, scope, options);
    }

    transitioned(parameters: TransitionParameters, prior: TransitioningPropertyValue<T, R>): TransitioningPropertyValue<T, R> {
        return new TransitioningPropertyValue(this.property, this.value, prior, // eslint-disable-line no-use-before-define
            extend({}, parameters.transition, this.transition), parameters.now);
    }

    untransitioned(): TransitioningPropertyValue<T, R> {
        return new TransitioningPropertyValue(this.property, this.value, null, {}, 0); // eslint-disable-line no-use-before-define
    }
}

/**
 * A helper type: given an object type `Properties` whose values are each of type `Property<T, R>`, it calculates
 * an object type with the same keys and values of type `TransitionablePropertyValue<T, R>`.
 *
 * @private
 */
type TransitionablePropertyValues<Properties> = {
    [Key in keyof Properties]: Properties[Key] extends Property<infer T, infer R>
    ? TransitionablePropertyValue<T, R>
    : never;
};

/**
 * `Transitionable` stores a map of all (property name, `TransitionablePropertyValue`) pairs for paint properties of a
 * given layer type. It can calculate the `TransitioningPropertyValue`s for all of them at once, producing a
 * `Transitioning` instance for the same set of properties.
 *
 * @private
 */
export class Transitionable<Props extends {[Key in keyof Props]: Props[Key]}> {
    _properties: Properties<Props>;
    _values: TransitionablePropertyValues<Props>;
    _scope: string | null | undefined;
    _options: ConfigOptions | null | undefined;
    configDependencies: Set<string>;

    constructor(properties: Properties<Props>, scope?: string | null, options?: ConfigOptions | null) {
        this._properties = properties;
        this._values = (Object.create(properties.defaultTransitionablePropertyValues));
        this._scope = scope;
        this._options = options;
        this.configDependencies = new Set();
    }

    getValue<S extends keyof Props, T>(name: S): PropertyValueSpecification<T> | undefined {
        return clone(this._values[name].value.value as PropertyValueSpecification<T> | undefined);
    }

    setValue<S extends keyof Props, T>(name: S, value?: PropertyValueSpecification<T>) {
        if (!this._values.hasOwnProperty(name)) {
            this._values[name] = new TransitionablePropertyValue(this._values[name].property, this._scope, this._options) as TransitionablePropertyValues<Props>[S];
        }
        // Note that we do not _remove_ an own property in the case where a value is being reset
        // to the default: the transition might still be non-default.
        this._values[name].value = new PropertyValue(this._values[name].property, value === null ? undefined : clone(value), this._scope, this._options);
        if (this._values[name].value.expression.configDependencies) {
            this.configDependencies = new Set([...this.configDependencies, ...this._values[name].value.expression.configDependencies]);
        }
    }

    setTransitionOrValue<P extends PropertyValueSpecifications<Props>>(properties?: P, options?: ConfigOptions) {
        if (options) this._options = options;

        const specProperties = this._properties.properties;
        if (properties) {
            for (const name in properties) {
                const value = properties[name];
                if (endsWith(name, '-transition')) {
                    const propName = name.slice(0, -'-transition'.length) as keyof Props;
                    if (specProperties[propName]) {
                        this.setTransition(propName, value as TransitionSpecification);
                    }
                } else if (specProperties.hasOwnProperty(name)) { // skip unrecognized properties
                    this.setValue(name as unknown as keyof Props, value);
                }
            }
        }
    }

    getTransition<S extends keyof Props>(name: S): TransitionSpecification | undefined {
        return clone(this._values[name].transition);
    }

    setTransition<S extends keyof Props>(name: S, value?: TransitionSpecification) {
        if (!this._values.hasOwnProperty(name)) {
            this._values[name] = new TransitionablePropertyValue(this._values[name].property) as TransitionablePropertyValues<Props>[S];
        }
        this._values[name].transition = clone(value) || undefined;
    }

    serialize(): PropertyValueSpecifications<Props> {
        const result: any = {};
        for (const property of Object.keys(this._values) as Array<keyof Props>) {
            const value = this.getValue(property);
            if (value !== undefined) {
                result[property] = value;
            }

            const transition = this.getTransition(property);
            if (transition !== undefined) {
                result[`${property as string}-transition`] = transition;
            }
        }
        return result;
    }

    transitioned(parameters: TransitionParameters, prior: Transitioning<Props>): Transitioning<Props> {
        const result = new Transitioning(this._properties); // eslint-disable-line no-use-before-define
        for (const property of Object.keys(this._values)) {
            result._values[property] = this._values[property].transitioned(parameters, prior._values[property]);
        }
        return result;
    }

    untransitioned(): Transitioning<Props> {
        const result = new Transitioning(this._properties); // eslint-disable-line no-use-before-define
        for (const property of Object.keys(this._values)) {
            result._values[property] = this._values[property].untransitioned();
        }
        return result;
    }
}

// ------- Transitioning -------

/**
 * `TransitioningPropertyValue` implements the first of two intermediate steps in the evaluation chain of a paint
 * property value. In this step, transitions between old and new values are handled: as long as the transition is in
 * progress, `TransitioningPropertyValue` maintains a reference to the prior value, and interpolates between it and
 * the new value based on the current time and the configured transition duration and delay. The product is the next
 * step in the evaluation chain: the "possibly evaluated" result type `R`. See below for more on this concept.
 *
 * @private
 */
class TransitioningPropertyValue<T, R> {
    property: Property<T, R>;
    value: PropertyValue<T, R>;
    prior: TransitioningPropertyValue<T, R> | null | undefined;
    begin: TimePoint;
    end: TimePoint;

    constructor(property: Property<T, R>,
        value: PropertyValue<T, R>,
        prior: TransitioningPropertyValue<T, R> | null | undefined,
        transition: TransitionSpecification,
        now: TimePoint) {
        const delay = transition.delay || 0;
        const duration = transition.duration || 0;
        now = now || 0;
        this.property = property;
        this.value = value;
        this.begin = now + delay;
        this.end = this.begin + duration;
        if (property.specification.transition && (transition.delay || transition.duration)) {
            this.prior = prior;
        }
    }

    possiblyEvaluate(
        parameters: EvaluationParameters,
        canonical?: CanonicalTileID,
        availableImages?: Array<string>,
    ): R {
        const now = parameters.now || 0;
        const finalValue = this.value.possiblyEvaluate(parameters, canonical, availableImages);
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
            return prior.possiblyEvaluate(parameters, canonical, availableImages);
        } else {
            // Interpolate between recursively-calculated prior value and final.
            const t = (now - this.begin) / (this.end - this.begin);
            return this.property.interpolate(prior.possiblyEvaluate(parameters, canonical, availableImages), finalValue, easeCubicInOut(t));
        }
    }
}

/**
 * A helper type: given an object type `Properties` whose values are each of type `Property<T, R>`, it calculates
 * an object type with the same keys and values of type `TransitioningPropertyValue<T, R>`.
 *
 * @private
 */
type TransitioningPropertyValues<Properties> = {
    [Key in keyof Properties]: Properties[Key] extends Property<infer T, infer R>
    ? TransitioningPropertyValue<T, R>
    : never;
};

/**
 * `Transitioning` stores a map of all (property name, `TransitioningPropertyValue`) pairs for paint properties of a
 * given layer type. It can calculate the possibly-evaluated values for all of them at once, producing a
 * `PossiblyEvaluated` instance for the same set of properties.
 *
 * @private
 */
export class Transitioning<Props extends {
    [Prop in keyof Props]: Props[Prop]
}> {
    _properties: Properties<Props>;
    _values: TransitioningPropertyValues<Props>;

    constructor(properties: Properties<Props>) {
        this._properties = properties;
        this._values = (Object.create(properties.defaultTransitioningPropertyValues));
    }

    possiblyEvaluate(
        parameters: EvaluationParameters,
        canonical?: CanonicalTileID,
        availableImages?: Array<string>,
    ): PossiblyEvaluated<Props> {
        const result = new PossiblyEvaluated(this._properties); // eslint-disable-line no-use-before-define
        for (const property of Object.keys(this._values)) {
            result._values[property] = this._values[property].possiblyEvaluate(parameters, canonical, availableImages);
        }
        return result;
    }

    hasTransition(): boolean {
        for (const property of Object.keys(this._values)) {
            if (this._values[property].prior) {
                return true;
            }
        }
        return false;
    }
}

// ------- Layout -------

/**
 * A helper type: given an object type `Properties` whose values are each of type `Property<T, R>`, it calculates
 * an object type with the same keys and values of type `PropertyValue<T, R>`.
 *
 * @private
 */
type PropertyValues<Props> = {
    [Key in keyof Props]: Props[Key] extends Property<infer T, infer R> ? PropertyValue<T, R> : never;
};

/**
 * A helper type: given an object type `Properties` whose values are each of type `Property<T, R>`, it calculates
 * an object type with the same keys and values of type `PropertyValueSpecification<T>`.
 *
 * @private
 */
type PropertyValueSpecifications<Props> = {
    [Key in keyof Props]: Props[Key] extends Property<infer T, any> ? PropertyValueSpecification<T> : never;
};

/**
 * Because layout properties are not transitionable, they have a simpler representation and evaluation chain than
 * paint properties: `PropertyValue`s are possibly evaluated, producing possibly evaluated values, which are then
 * fully evaluated.
 *
 * `Layout` stores a map of all (property name, `PropertyValue`) pairs for layout properties of a
 * given layer type. It can calculate the possibly-evaluated values for all of them at once, producing a
 * `PossiblyEvaluated` instance for the same set of properties.
 *
 * @private
 */
export class Layout<Props extends {
    [Prop in keyof Props]: Props[Prop]
}> {
    _properties: Properties<Props>;
    _values: PropertyValues<Props>;
    _scope: string;
    _options: ConfigOptions | null | undefined;
    configDependencies: Set<string>;

    constructor(properties: Properties<Props>, scope: string, options?: ConfigOptions | null) {
        this._properties = properties;
        this._values = (Object.create(properties.defaultPropertyValues));
        this._scope = scope;
        this._options = options;
        this.configDependencies = new Set();
    }

    getValue<S extends keyof Props, T>(name: S): PropertyValueSpecification<T> | void {
        return clone(this._values[name].value as PropertyValueSpecification<T> | void);
    }

    setValue<S extends keyof Props>(name: S, value: any) {
        this._values[name] = new PropertyValue(this._values[name].property, value === null ? undefined : clone(value), this._scope, this._options) as PropertyValues<Props>[S];
        if (this._values[name].expression.configDependencies) {
            this.configDependencies = new Set([...this.configDependencies, ...this._values[name].expression.configDependencies]);
        }
    }

    serialize(): PropertyValueSpecifications<Props> {
        const result: any = {};
        for (const property of Object.keys(this._values) as Array<keyof Props>) {
            const value = this.getValue(property);
            if (value !== undefined) {
                result[property] = value;
            }
        }
        return result;
    }

    possiblyEvaluate(
        parameters: EvaluationParameters,
        canonical?: CanonicalTileID,
        availableImages?: Array<string>,
    ): PossiblyEvaluated<Props> {
        const result = new PossiblyEvaluated(this._properties); // eslint-disable-line no-use-before-define
        for (const property of Object.keys(this._values)) {
            result._values[property] = this._values[property].possiblyEvaluate(parameters, canonical, availableImages);
        }
        return result;
    }
}

// ------- PossiblyEvaluated -------

/**
 * "Possibly evaluated value" is an intermediate stage in the evaluation chain for both paint and layout property
 * values. The purpose of this stage is to optimize away unnecessary recalculations for data-driven properties. Code
 * which uses data-driven property values must assume that the value is dependent on feature data, and request that it
 * be evaluated for each feature. But when that property value is in fact a constant or camera function, the calculation
 * will not actually depend on the feature, and we can benefit from returning the prior result of having done the
 * evaluation once, ahead of time, in an intermediate step whose inputs are just the value and "global" parameters
 * such as current zoom level.
 *
 * `PossiblyEvaluatedValue` represents the three possible outcomes of this step: if the input value was a constant or
 * camera expression, then the "possibly evaluated" result is a constant value. Otherwise, the input value was either
 * a source or composite expression, and we must defer final evaluation until supplied a feature. We separate
 * the source and composite cases because they are handled differently when generating GL attributes, buffers, and
 * uniforms.
 *
 * Note that `PossiblyEvaluatedValue` (and `PossiblyEvaluatedPropertyValue`, below) are _not_ used for properties that
 * do not allow data-driven values. For such properties, we know that the "possibly evaluated" result is always a constant
 * scalar value. See below.
 *
 * @private
 */
export type PossiblyEvaluatedValue<T> = {
    kind: 'constant';
    value: T;
} | SourceExpression | CompositeExpression;

/**
 * `PossiblyEvaluatedPropertyValue` is used for data-driven paint and layout property values. It holds a
 * `PossiblyEvaluatedValue` and the `GlobalProperties` that were used to generate it. You're not allowed to supply
 * a different set of `GlobalProperties` when performing the final evaluation because they would be ignored in the
 * case where the input value was a constant or camera function.
 *
 * @private
 */
export class PossiblyEvaluatedPropertyValue<T> {
    property: DataDrivenProperty<T>;
    value: PossiblyEvaluatedValue<T>;
    parameters: EvaluationParameters;

    constructor(property: DataDrivenProperty<T>, value: PossiblyEvaluatedValue<T>, parameters: EvaluationParameters) {
        this.property = property;
        this.value = value;
        this.parameters = parameters;
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

    evaluate(
        feature: Feature,
        featureState: FeatureState,
        canonical?: CanonicalTileID,
        availableImages?: Array<string>,
    ): T {
        return this.property.evaluate(this.value, this.parameters, feature, featureState, canonical, availableImages);
    }
}

/**
 * A helper type: given an object type `Properties` whose values are each of type `Property<T, R>`, it calculates
 * an object type with the same keys, and values of type `R`.
 *
 * For properties that don't allow data-driven values, `R` is a scalar type such as `number`, `string`, or `Color`.
 * For data-driven properties, it is `PossiblyEvaluatedPropertyValue`. Critically, the type definitions are set up
 * in a way that allows flow to know which of these two cases applies for any given property name, and if you attempt
 * to use a `PossiblyEvaluatedPropertyValue` as if it was a scalar, or vice versa, you will get a type error. (However,
 * there's at least one case in which flow fails to produce a type error that you should be aware of: in a context such
 * as `layer.paint.get('foo-opacity') === 0`, if `foo-opacity` is data-driven, than the left-hand side is of type
 * `PossiblyEvaluatedPropertyValue<number>`, but flow will not complain about comparing this to a number using `===`.
 * See https://github.com/facebook/flow/issues/2359.)
 *
 * @private
 */
type PossiblyEvaluatedPropertyValues<Properties> = {
    [Key in keyof Properties]: Properties[Key] extends Property<any, infer R> ? R : never;
};

/**
 * `PossiblyEvaluated` stores a map of all (property name, `R`) pairs for paint or layout properties of a
 * given layer type.
 * @private
 */
export class PossiblyEvaluated<Props extends {
    [Prop in keyof Props]: Props[Prop]
}> {
    _properties: Properties<Props>;
    _values: PossiblyEvaluatedPropertyValues<Props>;

    constructor(properties: Properties<Props>) {
        this._properties = properties;
        this._values = Object.create(properties.defaultPossiblyEvaluatedValues);
    }

    get<S extends keyof Props>(name: S): PossiblyEvaluatedPropertyValues<Props>[S] {
        return this._values[name];
    }
}

/**
 * An implementation of `Property` for properties that do not permit data-driven (source or composite) expressions.
 * This restriction allows us to declare statically that the result of possibly evaluating this kind of property
 * is in fact always the scalar type `T`, and can be used without further evaluating the value on a per-feature basis.
 *
 * @private
 */
export class DataConstantProperty<T> implements Property<T, T> {
    specification: StylePropertySpecification;

    constructor(specification: StylePropertySpecification) {
        this.specification = specification;
    }

    possiblyEvaluate(value: PropertyValue<T, T>, parameters: EvaluationParameters): T {
        assert(!value.isDataDriven());
        return value.expression.evaluate(parameters);
    }

    interpolate(a: T, b: T, t: number): T {
        const interp: (a: T, b: T, t: number) => T | null | undefined = (interpolate as any)[this.specification.type];
        if (interp) {
            return interp(a, b, t);
        } else {
            return a;
        }
    }
}

/**
 * An implementation of `Property` for properties that permit data-driven (source or composite) expressions.
 * The result of possibly evaluating this kind of property is `PossiblyEvaluatedPropertyValue<T>`; obtaining
 * a scalar value `T` requires further evaluation on a per-feature basis.
 *
 * @private
 */
export class DataDrivenProperty<T> implements Property<T, PossiblyEvaluatedPropertyValue<T>> {
    specification: StylePropertySpecification;
    overrides: {
        [key: string]: any;
    } | null | undefined;
    useIntegerZoom: boolean | null | undefined;

    constructor(specification: StylePropertySpecification, overrides?: {
        [key: string]: any;
    }) {
        this.specification = specification;
        this.overrides = overrides;
    }

    possiblyEvaluate(
        value: PropertyValue<T, PossiblyEvaluatedPropertyValue<T>>,
        parameters: EvaluationParameters,
        canonical?: CanonicalTileID,
        availableImages?: Array<string>,
    ): PossiblyEvaluatedPropertyValue<T> {
        if (value.expression.kind === 'constant' || value.expression.kind === 'camera') {
            return new PossiblyEvaluatedPropertyValue(this, {kind: 'constant', value: value.expression.evaluate(parameters, (null as any), {}, canonical, availableImages)}, parameters);
        } else {
            return new PossiblyEvaluatedPropertyValue(this, value.expression, parameters);
        }
    }

    interpolate(
        a: PossiblyEvaluatedPropertyValue<T>,
        b: PossiblyEvaluatedPropertyValue<T>,
        t: number,
    ): PossiblyEvaluatedPropertyValue<T> {
        // If either possibly-evaluated value is non-constant, give up: we aren't able to interpolate data-driven values.
        if (a.value.kind !== 'constant' || b.value.kind !== 'constant') {
            return a;
        }

        // Special case hack solely for fill-outline-color. The undefined value is subsequently handled in
        // FillStyleLayer#recalculate, which sets fill-outline-color to the fill-color value if the former
        // is a PossiblyEvaluatedPropertyValue containing a constant undefined value. In addition to the
        // return value here, the other source of a PossiblyEvaluatedPropertyValue containing a constant
        // undefined value is the "default value" for fill-outline-color held in
        // `Properties#defaultPossiblyEvaluatedValues`, which serves as the prototype of
        // `PossiblyEvaluated#_values`.
        if (a.value.value === undefined || b.value.value === undefined) {
            return new PossiblyEvaluatedPropertyValue(this, {kind: 'constant', value: (undefined as any)}, a.parameters);
        }

        const interp: (a: T, b: T, t: number) => T | null | undefined = (interpolate as any)[this.specification.type];
        if (interp) {
            return new PossiblyEvaluatedPropertyValue(this, {kind: 'constant', value: interp(a.value.value, b.value.value, t)}, a.parameters);
        } else {
            return a;
        }
    }

    evaluate(
        value: PossiblyEvaluatedValue<T>,
        parameters: EvaluationParameters,
        feature: Feature,
        featureState: FeatureState,
        canonical?: CanonicalTileID,
        availableImages?: Array<string>,
    ): T {
        if (value.kind === 'constant') {
            return value.value;
        } else {
            return value.evaluate(parameters, feature, featureState, canonical, availableImages);
        }
    }
}

/**
 * An implementation of `Property` for `heatmap-color` and `line-gradient`. Interpolation is a no-op, and
 * evaluation returns a boolean value in order to indicate its presence, but the real
 * evaluation happens in StyleLayer classes.
 *
 * @private
 */
export class ColorRampProperty implements Property<Color, boolean> {
    specification: StylePropertySpecification;

    constructor(specification: StylePropertySpecification) {
        this.specification = specification;
    }

    possiblyEvaluate(
        value: PropertyValue<Color, boolean>,
        parameters: EvaluationParameters,
        canonical?: CanonicalTileID,
        availableImages?: Array<string>,
    ): boolean {
        return !!value.expression.evaluate(parameters, (null as any), {}, canonical, availableImages);
    }

    interpolate(): boolean { return false; }
}

export class DirectionProperty implements Property<[number, number], Direction> {
    specification: StylePropertySpecification;

    constructor(specification: StylePropertySpecification) {
        this.specification = specification;
    }

    possiblyEvaluate(
        value: PropertyValue<[number, number], Direction>,
        parameters: EvaluationParameters,
    ): Direction {
        return sphericalDirectionToCartesian(value.expression.evaluate(parameters));
    }

    interpolate(a: Direction, b: Direction, t: number): Direction {
        return {
            x: interpolateValue(a.x, b.x, t),
            y: interpolateValue(a.y, b.y, t),
            z: interpolateValue(a.z, b.z, t)
        };
    }
}

export class PositionProperty implements Property<[number, number, number], Position> {
    specification: StylePropertySpecification;

    constructor(specification: StylePropertySpecification) {
        this.specification = specification;
    }

    possiblyEvaluate(
        value: PropertyValue<[number, number, number], Position>,
        parameters: EvaluationParameters,
    ): Position {
        return sphericalPositionToCartesian(value.expression.evaluate(parameters));
    }

    interpolate(a: Position, b: Position, t: number): Position {
        return {
            x: interpolateValue(a.x, b.x, t),
            y: interpolateValue(a.y, b.y, t),
            z: interpolateValue(a.z, b.z, t),
            azimuthal: interpolateValue(a.azimuthal, b.azimuthal, t),
            polar: interpolateValue(a.polar, b.polar, t),
        };
    }
}

/**
 * `Properties` holds objects containing default values for the layout or paint property set of a given
 * layer type. These objects are immutable, and they are used as the prototypes for the `_values` members of
 * `Transitionable`, `Transitioning`, `Layout`, and `PossiblyEvaluated`. This allows these classes to avoid
 * doing work in the common case where a property has no explicit value set and should be considered to take
 * on the default value: using `for (const property of Object.keys(this._values))`, they can iterate over
 * only the _own_ properties of `_values`, skipping repeated calculation of transitions and possible/final
 * evaluations for defaults, the result of which will always be the same.
 *
 * @private
 */
export class Properties<Props extends {[Key in keyof Props]: Props[Key]}> {
    properties: Props;
    defaultPropertyValues: PropertyValues<Props>;
    defaultTransitionablePropertyValues: TransitionablePropertyValues<Props>;
    defaultTransitioningPropertyValues: TransitioningPropertyValues<Props>;
    defaultPossiblyEvaluatedValues: PossiblyEvaluatedPropertyValues<Props>;
    overridableProperties: Array<string>;

    constructor(properties: Props) {
        this.properties = properties;
        this.defaultPropertyValues = {} as PropertyValues<Props>;
        this.defaultTransitionablePropertyValues = {} as TransitionablePropertyValues<Props>;
        this.defaultTransitioningPropertyValues = {} as TransitioningPropertyValues<Props>;
        this.defaultPossiblyEvaluatedValues = {} as PossiblyEvaluatedPropertyValues<Props>;
        this.overridableProperties = [] as Array<string>;

        const defaultParameters = new EvaluationParameters(0, {});
        for (const property in properties) {
            const prop = properties[property];
            // @ts-expect-error - TS2339 - Property 'overridable' does not exist on type 'StylePropertySpecification'.
            if (prop.specification.overridable) {
                this.overridableProperties.push(property);
            }

            type PropertyValueType = typeof this.defaultPropertyValues[typeof property];
            type TransitionablePropertyValueType = typeof this.defaultTransitionablePropertyValues[typeof property];
            type TransitioningPropertyValueType = typeof this.defaultTransitioningPropertyValues[typeof property];
            type PossiblyEvaluatedValueType = typeof this.defaultPossiblyEvaluatedValues[typeof property];

            const defaultPropertyValue = this.defaultPropertyValues[property] =
                new PropertyValue(prop, undefined) as PropertyValueType;

            const defaultTransitionablePropertyValue = this.defaultTransitionablePropertyValues[property] =
                new TransitionablePropertyValue(prop) as TransitionablePropertyValueType;

            this.defaultTransitioningPropertyValues[property] =
                defaultTransitionablePropertyValue.untransitioned() as TransitioningPropertyValueType;

            this.defaultPossiblyEvaluatedValues[property] =
                defaultPropertyValue.possiblyEvaluate(defaultParameters) as PossiblyEvaluatedValueType;
        }
    }
}

register(DataDrivenProperty, 'DataDrivenProperty');
register(DataConstantProperty, 'DataConstantProperty');
register(ColorRampProperty, 'ColorRampProperty');
