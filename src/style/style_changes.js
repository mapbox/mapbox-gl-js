// @flow

import type StyleLayer from './style_layer.js';

/**
 * Class for tracking style changes by scope, shared between all style instances.
 */
class StyleChanges {
    _changed: boolean;
    _updatedLayers: {[_: string]: Set<string>;};
    _removedLayers: {[_: string]: {[_: string]: StyleLayer}};
    _updatedPaintProps: Set<string>;
    _updatedImages: Set<string>;
    _updatedSourceCaches: {[_: string]: 'clear' | 'reload'};

    constructor() {
        this._changed = false;

        this._updatedLayers = {};
        this._removedLayers = {};

        this._updatedSourceCaches = {};
        this._updatedPaintProps = new Set();

        this._updatedImages = new Set();
    }

    isDirty(): boolean {
        return this._changed;
    }

    /**
     * Mark changes as dirty.
     */
    setDirty() {
        this._changed = true;
    }

    getUpdatedSourceCaches(): {[_: string]: 'clear' | 'reload'} {
        return this._updatedSourceCaches;
    }

    /**
     * Mark that a source cache needs to be cleared or reloaded.
     * @param {string} id
     * @param {'clear' | 'reload'} action
     */
    updateSourceCache(id: string, action: 'clear' | 'reload') {
        this._updatedSourceCaches[id] = action;
        this.setDirty();
    }

    /**
     * Discards updates to the source cache with the given id.
     * @param {string} id
     */
    discardSourceCacheUpdate(id: string) {
        delete this._updatedSourceCaches[id];
    }

    /**
     * Mark a layer as having changes and needs to be rerendered.
     * @param {StyleLayer} layer
     */
    updateLayer(layer: StyleLayer) {
        const scope = layer.scope;
        this._updatedLayers[scope] = this._updatedLayers[scope] || new Set();
        this._updatedLayers[scope].add(layer.id);
        this.setDirty();
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
        this._updatedPaintProps.delete(layer.fqid);

        this.setDirty();
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

    getUpdatedPaintProperties(): Set<string> {
        return this._updatedPaintProps;
    }

    /**
     * Mark a layer as having a changed paint properties.
     * @param {StyleLayer} layer
     */
    updatePaintProperties(layer: StyleLayer) {
        this._updatedPaintProps.add(layer.fqid);
        this.setDirty();
    }

    getUpdatedImages(): Array<string> {
        return Array.from(this._updatedImages.values());
    }

    /**
     * Mark an image as having changed.
     * @param {string} id
     */
    updateImage(id: string) {
        this._updatedImages.add(id);
        this.setDirty();
    }

    resetUpdatedImages() {
        this._updatedImages.clear();
    }

    /**
     * Reset all style changes.
     */
    reset() {
        this._changed = false;

        this._updatedLayers = {};
        this._removedLayers = {};

        this._updatedSourceCaches = {};
        this._updatedPaintProps.clear();

        this._updatedImages.clear();
    }
}

export default StyleChanges;
