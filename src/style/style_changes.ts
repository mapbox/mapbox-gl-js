import {ImageId} from '../style-spec/expression/types/image_id';

import type {TypedStyleLayer} from './style_layer/typed_style_layer';
import type {StringifiedImageId} from '../style-spec/expression/types/image_id';

/**
 * Class for tracking style changes by scope, shared between all style instances.
 */
class StyleChanges {
    _changed: boolean;
    _updatedLayers: {
        [_: string]: Set<string>;
    };
    _removedLayers: {
        [_: string]: {
            [_: string]: TypedStyleLayer;
        };
    };
    _updatedPaintProps: Set<string>;
    _updatedImages: {
        [_: string]: Set<StringifiedImageId>;
    };
    _updatedSourceCaches: {
        [_: string]: 'clear' | 'reload';
    };

    constructor() {
        this._changed = false;

        this._updatedLayers = {};
        this._removedLayers = {};

        this._updatedSourceCaches = {};
        this._updatedPaintProps = new Set();

        this._updatedImages = {};
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

    getUpdatedSourceCaches(): {
        [_: string]: 'clear' | 'reload';
        } {
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
     * @param {TypedStyleLayer} layer
     */
    updateLayer(layer: TypedStyleLayer) {
        const scope = layer.scope;
        this._updatedLayers[scope] = this._updatedLayers[scope] || new Set();
        this._updatedLayers[scope].add(layer.id);
        this.setDirty();
    }

    /**
     * Mark a layer as having been removed and needing to be cleaned up.
     * @param {TypedStyleLayer} layer
     */
    removeLayer(layer: TypedStyleLayer) {
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
     * @param {TypedStyleLayer} layer
     */
    getRemovedLayer(layer: TypedStyleLayer): TypedStyleLayer | null | undefined {
        if (!this._removedLayers[layer.scope]) return null;
        return this._removedLayers[layer.scope][layer.id];
    }

    /**
     * Eliminate layer from the list of layers that need to be removed.
     * @param {TypedStyleLayer} layer
     */
    discardLayerRemoval(layer: TypedStyleLayer) {
        if (!this._removedLayers[layer.scope]) return;
        delete this._removedLayers[layer.scope][layer.id];
    }

    /**
     * Returns a list of layer ids that have been updated or removed grouped by the scope.
     * @returns {{[scope: string]: {updatedIds: Array<string>, removedIds: Array<string>}}}}
     */
    getLayerUpdatesByScope(): {
        [_: string]: {
            updatedIds?: Array<string>;
            removedIds?: Array<string>;
        };
        } {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updatesByScope: Record<string, any> = {};

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
     * @param {TypedStyleLayer} layer
     */
    updatePaintProperties(layer: TypedStyleLayer) {
        this._updatedPaintProps.add(layer.fqid);
        this.setDirty();
    }

    getUpdatedImages(scope: string): StringifiedImageId[] {
        return this._updatedImages[scope] ? Array.from(this._updatedImages[scope].values()) : [];
    }

    /**
     * Mark an image as having changes.
     * @param {ImageId} id
     */
    updateImage(id: ImageId, scope: string) {
        this._updatedImages[scope] = this._updatedImages[scope] || new Set();
        this._updatedImages[scope].add(ImageId.toString(id));
        this.setDirty();
    }

    resetUpdatedImages(scope: string) {
        if (this._updatedImages[scope]) {
            this._updatedImages[scope].clear();
        }
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

        this._updatedImages = {};
    }
}

export default StyleChanges;
