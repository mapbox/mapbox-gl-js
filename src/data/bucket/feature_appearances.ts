import {isFeatureConstant, isStateConstant, isGlobalPropertyConstant} from '../../style-spec/expression/is_constant';

import type SymbolAppearance from '../../style/appearance';
import type {GlobalProperties} from '../../style-spec/expression';

// Discriminated union returned by FeatureAppearances.update().
// 'no-changes'   — nothing changed, skip the feature loop entirely.
// 'all-features' — one appearance index applies to every feature (no per-feature condition eval needed).
// 'per-feature'  — caller must evaluate conditions per feature.
export type AppearanceUpdateResult =
    | {kind: 'no-changes'}
    | {kind: 'all-features'; appearanceIndex: number}
    | {kind: 'per-feature'};

type ConditionDeps = {
    featureDependent: boolean;
    stateDependent: boolean;
    zoomDependent: boolean;
    pitchDependent: boolean;
    brightnessDependent: boolean;
    worldviewDependent: boolean;
};

type RuntimeParams = {
    zoom: number;
    pitch: number;
    brightness: number;
    worldview: string | undefined;
};

// Sentinel for "not yet initialized" appearance indices. Used by both FeatureAppearances
// (lastAllFeaturesIndex) and AppearanceFeatureData (activeAppearanceIndex) to force a full
// update on the first call. -2 is outside the range of valid indices (-1 = none, ≥0 = active).
export const UNINITIALIZED_APPEARANCE_INDEX = -2;

function computeConditionDeps(appearance: SymbolAppearance): ConditionDeps {
    if (!appearance.condition) {
        // Null condition = "hidden" appearance; never active via the normal condition path.
        return {featureDependent: false, stateDependent: false, zoomDependent: false,
            pitchDependent: false, brightnessDependent: false, worldviewDependent: false};
    }
    const expr = appearance.condition.expression;
    return {
        featureDependent: !isFeatureConstant(expr),
        stateDependent: !isStateConstant(expr),
        zoomDependent: !isGlobalPropertyConstant(expr, ['zoom']),
        pitchDependent: !isGlobalPropertyConstant(expr, ['pitch']),
        brightnessDependent: !isGlobalPropertyConstant(expr, ['brightness', 'measure-light']),
        worldviewDependent: !isGlobalPropertyConstant(expr, ['worldview']),
    };
}

// Encapsulates "which appearance is active?" logic
// Separated from property application so callers look up layer.appearances[index] themselves.
export class FeatureAppearances {
    // Version of layer.appearances at construction — used by the bucket to detect staleness.
    readonly appearancesVersion: number;

    // Stored at construction; never changes while this instance is alive (a new instance is
    // created whenever appearancesVersion changes).
    private readonly appearances: SymbolAppearance[];

    // True if ANY condition depends on feature properties or feature-state.
    private readonly anyFeatureDependent: boolean;
    private readonly anyStateDependent: boolean;

    private lastParams: RuntimeParams | null = null;
    // Last result from evaluateAllFeatures(); initialized to UNINITIALIZED_APPEARANCE_INDEX to force evaluation on first call.
    private lastAllFeaturesIndex: number = UNINITIALIZED_APPEARANCE_INDEX;

    constructor(appearances: SymbolAppearance[], version: number) {
        this.appearancesVersion = version;
        this.appearances = appearances;
        const conditionDeps = appearances.map(a => computeConditionDeps(a));
        this.anyFeatureDependent = conditionDeps.some(d => d.featureDependent);
        this.anyStateDependent = conditionDeps.some(d => d.stateDependent);
    }

    // Returns what changed since the last call, allowing the bucket to skip or fast-path
    // the per-feature update loop.
    update(
        globalProperties: GlobalProperties,
        featureStateChanged: boolean,
    ): AppearanceUpdateResult {
        const p = globalProperties;
        const last = this.lastParams;

        // Determine whether any global input that at least one condition cares about changed.
        const globalChanged = !last ||
            last.zoom !== p.zoom ||
            last.pitch !== (p.pitch || 0) ||
            last.brightness !== (p.brightness || 0) ||
            last.worldview !== p.worldview;

        this.lastParams = {
            zoom: p.zoom,
            pitch: p.pitch || 0,
            brightness: p.brightness || 0,
            worldview: p.worldview,
        };

        const featureStateRelevant = featureStateChanged && this.anyStateDependent;
        const isFirstCall = this.lastAllFeaturesIndex === UNINITIALIZED_APPEARANCE_INDEX;

        if (!globalChanged && !featureStateRelevant && !isFirstCall) {
            return {kind: 'no-changes'};
        }

        // Feature-independent fast path: all conditions depend only on global properties.
        // Evaluate once — the result applies identically to every feature.
        if (!this.anyFeatureDependent && !featureStateRelevant) {
            const newIndex = this.evaluateAllFeatures(globalProperties);
            if (newIndex === this.lastAllFeaturesIndex) return {kind: 'no-changes'};
            this.lastAllFeaturesIndex = newIndex;
            return {kind: 'all-features', appearanceIndex: newIndex};
        }

        // At least one condition depends on per-feature data — caller must evaluate per feature.
        return {kind: 'per-feature'};
    }

    // Evaluates conditions without any feature context. Returns the index of the first active
    // appearance, or -1 if none match (= default/no appearance).
    private evaluateAllFeatures(globalProperties: GlobalProperties): number {
        for (let i = 0; i < this.appearances.length; i++) {
            const a = this.appearances[i];
            if (!a.condition) continue;
            if (a.condition.evaluate(globalProperties, undefined, undefined, undefined) as boolean) {
                return i;
            }
        }
        return -1;
    }
}
