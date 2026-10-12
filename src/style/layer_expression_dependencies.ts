import {createExpression} from '../style-spec/expression/index';
import latest from '../style-spec/reference/latest';
import assert from '../style-spec/util/assert';

import type StyleLayer from './style_layer';

type ExpressionDependencies = {
    configDependencies: Set<string>;
    isIndoorDependent: boolean;
};

/**
 * A read-through view over the config options and other dynamic inputs a
 * layer's expressions depend on. Layout, paint and appearance dependencies
 * are read live from the layer's `PropertyValues` containers, which track
 * them as property values are set. Dependencies of the layer's filter are
 * computed here, lazily on first query (compiling the static filter is not
 * free), and can be dropped with {@link invalidateFilter} when the filter
 * changes.
 *
 * Lives outside `StyleLayer` on purpose: only `Style` queries dependencies,
 * so worker-side layers carry no dependency-tracking state or work.
 *
 * @private
 */
export class LayerExpressionDependencies {
    _layer: StyleLayer;
    // undefined = not yet computed; null = computed, layer's filter has no dependencies
    _filterDependencies: ExpressionDependencies | null | undefined;

    constructor(layer: StyleLayer) {
        this._layer = layer;
        this._filterDependencies = undefined;
    }

    invalidateFilter() {
        this._filterDependencies = undefined;
    }

    get _filterDeps(): ExpressionDependencies | null {
        if (this._filterDependencies === undefined) {
            this._filterDependencies = this._computeFilterDependencies();
        }
        return this._filterDependencies;
    }

    _computeFilterDependencies(): ExpressionDependencies | null {
        const layer = this._layer;
        if (!layer.type || layer.type === 'custom' || layer.type === 'background' || layer.type === 'sky' || layer.type === 'slot' || layer.type === 'placement-group') return null;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const filterSpec = latest[`filter_${layer.type}`];
        assert(filterSpec);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const compiledStaticFilter = createExpression(layer.filter, filterSpec);
        if (compiledStaticFilter.result === 'error') return null;

        return {
            configDependencies: compiledStaticFilter.value.configDependencies,
            isIndoorDependent: compiledStaticFilter.value.isIndoorDependent
        };
    }

    // Whether the layer depends on the config option `key`, or on any config option if no key is given
    hasConfigDependency(key?: string): boolean {
        const has = (deps: Set<string>) => (key ? deps.has(key) : deps.size !== 0);
        const {_layoutValues, _paintValues} = this._layer;
        if (_layoutValues && has(_layoutValues.configDependencies)) return true;
        if (_paintValues && has(_paintValues.configDependencies)) return true;
        for (const {unevaluatedLayout, unevaluatedPaint} of this._layer.appearances) {
            if (unevaluatedLayout && (has(unevaluatedLayout.configDependencies) || has(unevaluatedPaint.configDependencies))) return true;
        }
        const filterDeps = this._filterDeps;
        return filterDeps ? has(filterDeps.configDependencies) : false;
    }

    get isIndoorDependent(): boolean {
        const {_layoutValues, _paintValues} = this._layer;
        if (_layoutValues && _layoutValues.isIndoorDependent()) return true;
        if (_paintValues && _paintValues.isIndoorDependent()) return true;
        const filterDeps = this._filterDeps;
        return filterDeps ? filterDeps.isIndoorDependent : false;
    }
}
