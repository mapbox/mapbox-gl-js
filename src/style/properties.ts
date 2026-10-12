import assert from '../style-spec/util/assert';
import {clone, easeCubicInOut, sphericalDirectionToCartesian, sphericalPositionToCartesian} from '../util/util';
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
    StyleExpression,
    StylePropertyExpression,
    SourceExpression,
    CompositeExpression
} from '../style-spec/expression/index';
import type {ConfigOptions} from '../style-spec/types/config_options';
import type {ImageId} from '../style-spec/expression/types/image_id';
import type {Type} from '../style-spec/expression/types';
import type {FormattedSection} from '../style-spec/expression/types/formatted';

export type {ConfigOptions};

type TimePoint = number;

type Overrides = {
    runtimeType: Type;
    getOverride: (o: unknown) => unknown;
    hasOverride: (o: unknown) => boolean;
};

/**
 * Implements a number of classes that define state and behavior for paint and layout properties, most
 * importantly their evaluation chain:
 *
 *       Set value (`PropertyValue`) in a `PropertyValues` entry, with its displayed transition state
 *     → Possibly evaluated value, for the current zoom and other global parameters (`PossiblyEvaluated`)
 *     → Fully evaluated value, for a specific feature
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
 *  one for `heatmap-color` and `line-gradient`, and ones for light directions and positions.
 *
 * @private
 */
export interface Property<T, R> {
    specification: StylePropertySpecification;
    possiblyEvaluate: (
        value: PropertyValue<T, R>,
        parameters: EvaluationParameters,
        canonical?: CanonicalTileID,
        availableImages?: ImageId[],
        iconImageUseTheme?: string
    ) => R;
    interpolate: (a: R, b: R, t: number) => R;
}

// Inputs other than the property value itself that a possibly evaluated value can change with, so a layer can skip
// re-evaluation while none of them change. Config and worldview changes are handled by the style.
export const ZOOM_DEPENDENCY = 1;
export const LIGHT_DEPENDENCY = 2;
export const IMAGE_DEPENDENCY = 4;

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
    deps: number;

    constructor(property: Property<T, R>, value?: PropertyValueSpecification<T>, scope?: string | null, options?: ConfigOptions | null, iconImageUseTheme?: string | null) {
        this.property = property;
        this.value = value;
        this.expression = normalizePropertyExpression(value === undefined ? property.specification.default : value, property.specification, scope, options, iconImageUseTheme);

        // Source and composite values keep their expression and get the available images only at feature
        // evaluation, so just constant and camera values with an `image` expression depend on them. Image
        // and formatted properties count as dependent regardless, since config values can hold `image` too.
        const {kind} = this.expression;
        const type = property.specification.type;
        const styleExpression = (this.expression as {_styleExpression?: StyleExpression})._styleExpression;
        this.deps =
            (kind === 'camera' || kind === 'composite' ? ZOOM_DEPENDENCY : 0)
            | ((this.expression as {isLightConstant?: boolean}).isLightConstant === false ? LIGHT_DEPENDENCY : 0)
            | ((kind === 'constant' || kind === 'camera') &&
                (type === 'resolvedImage' || type === 'formatted' || (styleExpression && styleExpression.isImageDependent)) ? IMAGE_DEPENDENCY : 0);
    }

    isIndoorDependent(): boolean {
        return this.expression.isIndoorDependent;
    }

    isDataDriven(): boolean {
        return this.expression.kind === 'source' || this.expression.kind === 'composite';
    }

    possiblyEvaluate(
        parameters: EvaluationParameters,
        canonical?: CanonicalTileID,
        availableImages?: ImageId[],
        iconImageUseTheme?: string
    ): R {
        return this.property.possiblyEvaluate(this, parameters, canonical, availableImages, iconImageUseTheme);
    }
}

// ------- PropertyValues -------

export type TransitionParameters = {
    now: TimePoint;
    transition: TransitionSpecification;
};

/**
 * The displayed state of a paint property value: as long as a transition is in progress, it keeps a reference to the
 * prior state, and interpolates between it and the new value based on the current time and the configured transition
 * duration and delay.
 *
 * @private
 */
type TransitionState<T, R> = {
    value: PropertyValue<T, R>;
    prior: TransitionState<T, R> | null;
    begin: TimePoint;
    end: TimePoint;
};

export function possiblyEvaluateTransition<T, R>(
    state: TransitionState<T, R>,
    parameters: EvaluationParameters,
    canonical?: CanonicalTileID,
    availableImages?: ImageId[],
    iconImageUseTheme?: string,
): R {
    const now = parameters.now || 0;
    const finalValue = state.value.possiblyEvaluate(parameters, canonical, availableImages, iconImageUseTheme);
    const prior = state.prior;
    if (!prior) {
        // No prior value.
        return finalValue;
    } else if (now > state.end) {
        // Transition from prior value is now complete.
        state.prior = null;
        return finalValue;
    } else if (state.value.isDataDriven()) {
        // Transitions to data-driven properties are not supported.
        // We snap immediately to the data-driven value so that, when we perform layout,
        // we see the data-driven function and can use it to populate vertex buffers.
        state.prior = null;
        return finalValue;
    } else if (now < state.begin) {
        // Transition hasn't started yet.
        return possiblyEvaluateTransition(prior, parameters, canonical, availableImages, iconImageUseTheme);
    } else {
        // Interpolate between recursively-calculated prior value and final.
        const t = (now - state.begin) / (state.end - state.begin);
        return state.value.property.interpolate(possiblyEvaluateTransition(prior, parameters, canonical, availableImages, iconImageUseTheme), finalValue, easeCubicInOut(t));
    }
}

/**
 * `PropertyValueEntry` stores the latest set value of a layout or paint property, its transition configuration,
 * and the displayed `state`. Paint properties are _transitionable_: they can change in a fluid manner, interpolating
 * or cross-fading between old and new value, with a configurable duration and delay. Their displayed state only
 * catches up with the set value on the next `updateTransitions` or `snap`; other values are displayed once set,
 * including layout values that the spec marks as transitionable.
 *
 * @private
 */
class PropertyValueEntry<T, R> {
    property: Property<T, R>;
    value: PropertyValue<T, R>;
    transition: TransitionSpecification | undefined;
    state: TransitionState<T, R>;
    // The last evaluated value and the property value it was evaluated from
    evaluated: R | undefined;
    evaluatedFrom: PropertyValue<T, R> | null;

    constructor(property: Property<T, R>, scope?: string | null, options?: ConfigOptions | null, iconImageUseTheme?: string | null) {
        this.property = property;
        this.value = new PropertyValue(property, undefined, scope, options, iconImageUseTheme);
        this.state = {value: this.value, prior: null, begin: 0, end: 0};
        this.evaluated = undefined;
        this.evaluatedFrom = null;
    }
}

/**
 * A helper type: given an object type `Properties` whose values are each of type `Property<T, R>`, it calculates
 * an object type with the same keys and values of type `PropertyValueEntry<T, R>`.
 *
 * @private
 */
type PropertyValueEntries<Properties> = {
    [Key in keyof Properties]: Properties[Key] extends Property<infer T, infer R> ?
        PropertyValueEntry<T, R> :
        never;
};

/**
 * A helper type: given an object type `Properties` whose values are each of type `Property<T, R>`, it calculates
 * an object type with the same keys and values of type `PropertyValueSpecification<T>`.
 *
 * @private
 */
export type PropertyValueSpecifications<Props> = Partial<{
    [Key in keyof Props]: Props[Key] extends Property<infer T, unknown> ?
        PropertyValueSpecification<T extends Color ? string : T> :
        never;
}>;

/**
 * `PropertyValues` stores a map of all (property name, `PropertyValueEntry`) pairs for the layout or paint properties
 * of a given layer type. It advances their transitions and calculates their possibly-evaluated values all at once,
 * producing a `PossiblyEvaluated` instance for the same set of properties.
 *
 * @private
 */
export class PropertyValues<Props extends {[Key in keyof Props]: Props[Key]}> {
    _properties: Properties<Props>;
    _canTransition: boolean;
    _values: PropertyValueEntries<Props>;
    _scope: string | null | undefined;
    _options: ConfigOptions | null | undefined;
    _iconImageUseTheme?: string | null;
    _isIndoorDependent: boolean;
    configDependencies: Set<string>;
    deps: number;
    // Whether any displayed value has a prior state, updated whenever transitions start, snap or get evaluated
    _hasTransition: boolean;

    constructor(properties: Properties<Props>, canTransition: boolean, scope?: string | null, options?: ConfigOptions | null, iconImageUseTheme?: string | null) {
        this._properties = properties;
        this._canTransition = canTransition;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this._values = (Object.create(properties.defaultPropertyValues));
        this._scope = scope;
        this._options = options;
        this._iconImageUseTheme = iconImageUseTheme;
        this._isIndoorDependent = false;
        this.configDependencies = new Set();
        this.deps = 0;
        this._hasTransition = false;
    }

    getValue<S extends keyof Props, T>(name: S): PropertyValueSpecification<T> | undefined {
        return clone(this._values[name].value.value as PropertyValueSpecification<T> | undefined);
    }

    setValue<S extends keyof Props>(name: S, value?: unknown) {
        if (!Object.hasOwn(this._values, name)) {
            this._values[name] = new PropertyValueEntry(this._values[name].property, this._scope, this._options, this._iconImageUseTheme) as PropertyValueEntries<Props>[S];
        }
        // Note that we do not _remove_ an own property in the case where a value is being reset
        // to the default: the transition might still be non-default.
        const entry = this._values[name];
        const propertyValue = new PropertyValue(entry.property, value === null ? undefined : clone(value), this._scope, this._options, this._iconImageUseTheme);
        entry.value = propertyValue;
        if (!this._canTransition || !entry.property.specification.transition) entry.state = {value: propertyValue, prior: null, begin: 0, end: 0};
        this.deps |= propertyValue.deps;
        if (propertyValue.expression.configDependencies) {
            for (const key of propertyValue.expression.configDependencies) this.configDependencies.add(key);
            this._isIndoorDependent = this._isIndoorDependent || propertyValue.isIndoorDependent();
        }
    }

    setTransitionOrValue<P extends PropertyValueSpecifications<Props>>(properties?: P, options?: ConfigOptions) {
        if (options) this._options = options;

        const specProperties = this._properties.properties;
        if (properties) {
            for (const name in properties) {
                const value = properties[name];
                if (name.endsWith('-transition')) {
                    const propName = name.slice(0, -'-transition'.length) as keyof Props;
                    if (specProperties[propName]) {
                        this.setTransition(propName, value);
                    }
                } else if (Object.hasOwn(specProperties, name)) { // skip unrecognized properties
                    this.setValue(name, value);
                }
            }
        }
    }

    getTransition<S extends keyof Props>(name: S): TransitionSpecification | undefined {
        return clone(this._values[name].transition);
    }

    setTransition<S extends keyof Props>(name: S, value?: TransitionSpecification) {
        if (!Object.hasOwn(this._values, name)) {
            this._values[name] = new PropertyValueEntry(this._values[name].property) as PropertyValueEntries<Props>[S];
        }
        this._values[name].transition = clone(value) || undefined;
    }

    serialize(): PropertyValueSpecifications<Props> {
        const result = {} as PropertyValueSpecifications<Props>;
        for (const property of Object.keys(this._values) as Array<keyof Props>) {
            const value = this.getValue(property) as Props[keyof Props];
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

    // Starts a transition from the displayed state to the latest set value for every property set since the last update
    updateTransitions(parameters: TransitionParameters) {
        const now = parameters.now || 0;
        for (const entry of Object.values<PropertyValueEntry<unknown, unknown>>(this._values)) {
            if (entry.value === entry.state.value) continue;
            const transition = {...parameters.transition, ...entry.transition};
            const begin = now + (transition.delay || 0);
            const prior = transition.delay || transition.duration ? entry.state : null;
            entry.state = {value: entry.value, prior, begin, end: begin + (transition.duration || 0)};
            if (prior) this._hasTransition = true;
        }
    }

    // Displays the latest set values right away, dropping any transitions in progress
    snap() {
        for (const entry of Object.values<PropertyValueEntry<unknown, unknown>>(this._values)) {
            entry.state = {value: entry.value, prior: null, begin: 0, end: 0};
        }
        this._hasTransition = false;
    }

    hasTransition(): boolean {
        return this._hasTransition;
    }

    // Evaluates the displayed values, interpolating transitions in progress. If `changedDeps` (the `*_DEPENDENCY` flags
    // of parameters that changed since the last evaluation) is given, values that don't depend on any of them and aren't
    // transitioning are reused from the last evaluation.
    possiblyEvaluate(
        parameters: EvaluationParameters,
        canonical?: CanonicalTileID,
        availableImages?: ImageId[],
        iconImageUseTheme?: string,
        changedDeps?: number
    ): PossiblyEvaluated<Props> {
        const result = new PossiblyEvaluated(this._properties);
        let hasTransition = false;
        for (const name of Object.keys(this._values)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const entry: PropertyValueEntry<unknown, unknown> = this._values[name];
            const state = entry.state;
            if (changedDeps === undefined || state.prior || entry.evaluatedFrom !== state.value || (state.value.deps & changedDeps)) {
                entry.evaluated = possiblyEvaluateTransition(state, parameters, canonical, availableImages, iconImageUseTheme);
                entry.evaluatedFrom = state.value;
                if (state.prior) hasTransition = true;
            }
            result._values[name] = entry.evaluated;
        }
        this._hasTransition = hasTransition;
        return result;
    }

    isIndoorDependent(): boolean {
        return this._isIndoorDependent;
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
export type PossiblyEvaluatedValue<T> = {kind: 'constant'; value: T} | SourceExpression | CompositeExpression;

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
    iconImageUseTheme: string | null | undefined;

    constructor(property: DataDrivenProperty<T>, value: PossiblyEvaluatedValue<T>, parameters: EvaluationParameters, iconImageUseTheme?: string) {
        this.property = property;
        this.value = value;
        this.parameters = parameters;
        this.iconImageUseTheme = iconImageUseTheme;
    }

    isConstant(): boolean {
        return this.value.kind === 'constant';
    }

    constantOr<U>(value: U): T | U {
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
        availableImages?: ImageId[],
        formattedSection?: FormattedSection
    ): T {
        return this.property.evaluate(this.value, this.parameters, feature, featureState, canonical, availableImages, this.iconImageUseTheme, formattedSection);
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
    [Key in keyof Properties]: Properties[Key] extends Property<unknown, infer R> ? R : never;
};

/**
 * `PossiblyEvaluated` stores a map of all (property name, `R`) pairs for paint or layout properties of a
 * given layer type.
 * @private
 */
export class PossiblyEvaluated<Props extends {[Prop in keyof Props]: Props[Prop]}> {
    _properties: Properties<Props>;
    _values: PossiblyEvaluatedPropertyValues<Props>;

    constructor(properties: Properties<Props>) {
        this._properties = properties;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const interp: (a: T, b: T, t: number) => T | null | undefined = interpolate[this.specification.type];
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
    overrides?: Overrides;
    useIntegerZoom: boolean | null | undefined;

    constructor(specification: StylePropertySpecification, overrides?: Overrides) {
        this.specification = specification;
        this.overrides = overrides;
    }

    possiblyEvaluate(
        value: PropertyValue<T, PossiblyEvaluatedPropertyValue<T>>,
        parameters: EvaluationParameters,
        canonical?: CanonicalTileID,
        availableImages?: ImageId[],
        iconImageUseTheme?: string
    ): PossiblyEvaluatedPropertyValue<T> {
        if (value.expression.kind === 'constant' || value.expression.kind === 'camera') {
            return new PossiblyEvaluatedPropertyValue<T>(this, {kind: 'constant', value: value.expression.evaluate(parameters, null, {}, canonical, availableImages, undefined, iconImageUseTheme)}, parameters);
        } else {
            return new PossiblyEvaluatedPropertyValue(this, value.expression, parameters, iconImageUseTheme);
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
            return new PossiblyEvaluatedPropertyValue<T>(this, {kind: 'constant', value: undefined}, a.parameters);
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const interp: (a: T, b: T, t: number) => T | null | undefined = interpolate[this.specification.type];
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
        availableImages?: ImageId[],
        iconImageUseTheme?: string,
        formattedSection?: FormattedSection
    ): T {
        if (value.kind === 'constant') {
            return value.value;
        } else {
            return value.evaluate(parameters, feature, featureState, canonical, availableImages, formattedSection, iconImageUseTheme);
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
        availableImages?: ImageId[],
    ): boolean {
        return !!value.expression.evaluate(parameters, null, {}, canonical, availableImages);
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
 * `PropertyValues` and `PossiblyEvaluated`. This allows these classes to avoid
 * doing work in the common case where a property has no explicit value set and should be considered to take
 * on the default value: using `for (const property of Object.keys(this._values))`, they can iterate over
 * only the _own_ properties of `_values`, skipping repeated calculation of transitions and possible/final
 * evaluations for defaults, the result of which will always be the same.
 *
 * @private
 */
export class Properties<Props extends {[Key in keyof Props]: Props[Key]}> {
    properties: Props;
    defaultPropertyValues: PropertyValueEntries<Props>;
    defaultPossiblyEvaluatedValues: PossiblyEvaluatedPropertyValues<Props>;
    overridableProperties: Array<string>;

    constructor(properties: Props) {
        this.properties = properties;
        this.defaultPropertyValues = {} as PropertyValueEntries<Props>;
        this.defaultPossiblyEvaluatedValues = {} as PossiblyEvaluatedPropertyValues<Props>;
        this.overridableProperties = [] as Array<string>;

        const defaultParameters = new EvaluationParameters(0, {});
        for (const property in properties) {
            const prop = properties[property];
            const spec = (prop as {specification?: {overridable?: boolean}}).specification;
            if (spec && spec.overridable) {
                this.overridableProperties.push(property);
            }

            type PropertyValueEntryType = typeof this.defaultPropertyValues[typeof property];
            type PossiblyEvaluatedValueType = typeof this.defaultPossiblyEvaluatedValues[typeof property];

            const defaultEntry = this.defaultPropertyValues[property] =
                new PropertyValueEntry(prop) as PropertyValueEntryType;

            this.defaultPossiblyEvaluatedValues[property] =
                defaultEntry.value.possiblyEvaluate(defaultParameters) as PossiblyEvaluatedValueType;
        }
    }
}

register(DataDrivenProperty, 'DataDrivenProperty');
register(DataConstantProperty, 'DataConstantProperty');
register(ColorRampProperty, 'ColorRampProperty');
