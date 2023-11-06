// @flow

import type StyleLayer from './style_layer.js';

/**
 * Class for tracking style changes by scope, shared between all style instances.
 */
class StyleChanges {
    changed: boolean;
    _updatedLayers: {[_: string]: Set<string>;};
    _removedLayers: {[_: string]: {[_: string]: StyleLayer}};
    updatedPaintProps: Set<string>;
    changedImages: Set<string>;
    updatedSourceCaches: {[_: string]: 'clear' | 'reload'};

    constructor() {
        this.changed = false;

        this._updatedLayers = {};
        this._removedLayers = {};

        this.updatedSourceCaches = {};
        this.updatedPaintProps = new Set();

        this.changedImages = new Set();
    }

    /**
     * Mark a layer as having changes and needs to be rerendered.
     * @param {StyleLayer} layer
     */
    updateLayer(layer: StyleLayer) {
        const scope = layer.scope;
        this._updatedLayers[scope] = this._updatedLayers[scope] || new Set();
        this._updatedLayers[scope].add(layer.id);
    }

    /**
     * Mark a layer as having been removed and needing to be cleaned up.
     * @param {StyleLayer} layer
     */
    removeLayer(layer: StyleLayer) {
        const scope = layer.scope;
        this._removedLayers[scope] = this._removedLayers[scope] || {};
        this._updatedLayers[scope] = this._updatedLayers[scope] || new Set();

        this._removedLayers[scope][layer.id] = layer;
        this._updatedLayers[scope].delete(layer.id);
        this.updatedPaintProps.delete(layer.fqid);
    }

    /**
     * Returns StyleLayer if layer needs to be removed.
     * @param {StyleLayer} layer
     */
    getRemovedLayer(layer: StyleLayer): ?StyleLayer {
        if (!this._removedLayers[layer.scope]) return null;
        return this._removedLayers[layer.scope][layer.id];
    }

    /**
     * Eliminate layer from the list of layers that need to be removed.
     * @param {StyleLayer} layer
     */
    discardLayerRemoval(layer: StyleLayer) {
        if (!this._removedLayers[layer.scope]) return;
        delete this._removedLayers[layer.scope][layer.id];
    }

    /**
     * Returns a list of layer ids that have been updated or removed grouped by the scope.
     * @returns {{[scope: string]: {updatedIds: Array<string>, removedIds: Array<string>}}}}
     */
    getLayerUpdatesByScope(): {[_: string]: {updatedIds?: Array<string>, removedIds?: Array<string>}} {
        const updatesByScope = {};

        for (const scope in this._updatedLayers) {
            updatesByScope[scope] = updatesByScope[scope] || {};
            updatesByScope[scope].updatedIds = Array.from(this._updatedLayers[scope].values());
        }

        for (const scope in this._removedLayers) {
            updatesByScope[scope] = updatesByScope[scope] || {};
            updatesByScope[scope].removedIds = Object.keys(this._removedLayers[scope]);
        }

        return updatesByScope;
    }

    reset() {
        this.changed = false;

        this._updatedLayers = {};
        this._removedLayers = {};

        this.updatedSourceCaches = {};
        this.updatedPaintProps.clear();

        this.changedImages.clear();
    }
}

export default StyleChanges;
