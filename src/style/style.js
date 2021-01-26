// @flow

import assert from 'assert';

import {Event, ErrorEvent, Evented} from '../util/evented';
import StyleLayer from './style_layer';
import createStyleLayer from './create_style_layer';
import loadSprite from './load_sprite';
import ImageManager from '../render/image_manager';
import GlyphManager, {LocalGlyphMode} from '../render/glyph_manager';
import Light from './light';
import Terrain from './terrain';
import LineAtlas from '../render/line_atlas';
import {pick, clone, extend, deepEqual, filterObject} from '../util/util';
import {getJSON, getReferrer, makeRequest, ResourceType} from '../util/ajax';
import {isMapboxURL} from '../util/mapbox';
import browser from '../util/browser';
import Dispatcher from '../util/dispatcher';
import {validateStyle, emitValidationErrors as _emitValidationErrors} from './validate_style';
import {QueryGeometry} from '../style/query_geometry';
import {
    create as createSource,
    getType as getSourceType,
    setType as setSourceType,
    type SourceClass
} from '../source/source';
import {queryRenderedFeatures, queryRenderedSymbols, querySourceFeatures} from '../source/query_features';
import SourceCache from '../source/source_cache';
import GeoJSONSource from '../source/geojson_source';
import styleSpec from '../style-spec/reference/latest';
import getWorkerPool from '../util/global_worker_pool';
import deref from '../style-spec/deref';
import emptyStyle from '../style-spec/empty';
import diffStyles, {operations as diffOperations} from '../style-spec/diff';
import {
    registerForPluginStateChange,
    evented as rtlTextPluginEvented,
    triggerPluginCompletionEvent
} from '../source/rtl_text_plugin';
import PauseablePlacement from './pauseable_placement';
import ZoomHistory from './zoom_history';
import CrossTileSymbolIndex from '../symbol/cross_tile_symbol_index';
import {validateCustomStyleLayer} from './style_layer/custom_style_layer';

// We're skipping validation errors with the `source.canvas` identifier in order
// to continue to allow canvas sources to be added at runtime/updated in
// smart setStyle (see https://github.com/mapbox/mapbox-gl-js/pull/6424):
const emitValidationErrors = (evented: Evented, errors: ?$ReadOnlyArray<{message: string, identifier?: string}>) =>
    _emitValidationErrors(evented, errors && errors.filter(error => error.identifier !== 'source.canvas'));

import type Map from '../ui/map';
import type Transform from '../geo/transform';
import type {StyleImage} from './style_image';
import type {StyleGlyph} from './style_glyph';
import type {Callback} from '../types/callback';
import type EvaluationParameters from './evaluation_parameters';
import type {Placement} from '../symbol/placement';
import type {Cancelable} from '../types/cancelable';
import type {RequestParameters, ResponseCallback} from '../util/ajax';
import type {GeoJSON} from '@mapbox/geojson-types';
import type {
    LayerSpecification,
    FilterSpecification,
    StyleSpecification,
    LightSpecification,
    SourceSpecification,
    TerrainSpecification
} from '../style-spec/types';
import type {CustomLayerInterface} from './style_layer/custom_style_layer';
import type {Validator} from './validate_style';
import type {OverscaledTileID} from '../source/tile_id';
import type {PointLike} from '@mapbox/point-geometry';

const supportedDiffOperations = pick(diffOperations, [
    'addLayer',
    'removeLayer',
    'setPaintProperty',
    'setLayoutProperty',
    'setFilter',
    'addSource',
    'removeSource',
    'setLayerZoomRange',
    'setLight',
    'setTransition',
    'setGeoJSONSourceData',
    'setTerrain'
    // 'setGlyphs',
    // 'setSprite',
]);

const ignoredDiffOperations = pick(diffOperations, [
    'setCenter',
    'setZoom',
    'setBearing',
    'setPitch'
]);

const empty = emptyStyle();

export type StyleOptions = {
    validate?: boolean,
    localFontFamily?: string,
    localIdeographFontFamily?: string
};

export type StyleSetterOptions = {
    validate?: boolean
};

// Symbols are draped only for specific cases: see isLayerDraped
const drapedLayers = {'fill': true, 'line': true, 'background': true, "hillshade": true, "raster": true};

/**
 * @private
 */
class Style extends Evented {
    map: Map;
    stylesheet: StyleSpecification;
    dispatcher: Dispatcher;
    imageManager: ImageManager;
    glyphManager: GlyphManager;
    lineAtlas: LineAtlas;
    light: Light;
    terrain: ?Terrain;

    _request: ?Cancelable;
    _spriteRequest: ?Cancelable;
    _layers: {[_: string]: StyleLayer};
    _num3DLayers: number;
    _numSymbolLayers: number;
    _numCircleLayers: number;
    _serializedLayers: {[_: string]: Object};
    _order: Array<string>;
    _drapedFirstOrder: Array<string>;
    _sourceCaches: {[_: string]: SourceCache};
    _otherSourceCaches: {[_: string]: SourceCache};
    _symbolSourceCaches: {[_: string]: SourceCache};
    zoomHistory: ZoomHistory;
    _loaded: boolean;
    _rtlTextPluginCallback: Function;
    _changed: boolean;
    _updatedSources: {[_: string]: 'clear' | 'reload'};
    _updatedLayers: {[_: string]: true};
    _removedLayers: {[_: string]: StyleLayer};
    _changedImages: {[_: string]: true};
    _updatedPaintProps: {[layer: string]: true};
    _layerOrderChanged: boolean;
    _availableImages: Array<string>;

    crossTileSymbolIndex: CrossTileSymbolIndex;
    pauseablePlacement: PauseablePlacement;
    placement: Placement;
    z: number;

    // exposed to allow stubbing by unit tests
    static getSourceType: typeof getSourceType;
    static setSourceType: typeof setSourceType;
    static registerForPluginStateChange: typeof registerForPluginStateChange;

    constructor(map: Map, options: StyleOptions = {}) {
        super();

        this.map = map;
        this.dispatcher = new Dispatcher(getWorkerPool(), this);
        this.imageManager = new ImageManager();
        this.imageManager.setEventedParent(this);
        this.glyphManager = new GlyphManager(map._requestManager,
            options.localFontFamily ?
                LocalGlyphMode.all :
                (options.localIdeographFontFamily ? LocalGlyphMode.ideographs : LocalGlyphMode.none),
            options.localFontFamily || options.localIdeographFontFamily);
        this.lineAtlas = new LineAtlas(256, 512);
        this.crossTileSymbolIndex = new CrossTileSymbolIndex();

        this._layers = {};
        this._num3DLayers = 0;
        this._numSymbolLayers = 0;
        this._numCircleLayers = 0;
        this._serializedLayers = {};
        this._sourceCaches = {};
        this._otherSourceCaches = {};
        this._symbolSourceCaches = {};
        this.zoomHistory = new ZoomHistory();
        this._loaded = false;
        this._availableImages = [];
        this._order  = [];
        this._drapedFirstOrder = [];

        this._resetUpdates();

        this.dispatcher.broadcast('setReferrer', getReferrer());

        const self = this;
        this._rtlTextPluginCallback = Style.registerForPluginStateChange((event) => {
            const state = {
                pluginStatus: event.pluginStatus,
                pluginURL: event.pluginURL
            };
            self.dispatcher.broadcast('syncRTLPluginState', state, (err, results) => {
                triggerPluginCompletionEvent(err);
                if (results) {
                    const allComplete = results.every((elem) => elem);
                    if (allComplete) {
                        for (const id in self._sourceCaches) {
                            const sourceCache = self._sourceCaches[id];
                            const sourceCacheType = sourceCache.getSource().type;
                            if (sourceCacheType === 'vector' || sourceCacheType === 'geojson') {
                                sourceCache.reload(); // Should be a no-op if the plugin loads before any tiles load
                            }
                        }
                    }
                }

            });
        });

        this.on('data', (event) => {
            if (event.dataType !== 'source' || event.sourceDataType !== 'metadata') {
                return;
            }

            const source = this.getSource(event.sourceId);
            if (!source || !source.vectorLayerIds) {
                return;
            }

            for (const layerId in this._layers) {
                const layer = this._layers[layerId];
                if (layer.source === source.id) {
                    this._validateLayer(layer);
                }
            }
        });
    }

    loadURL(url: string, options: {
        validate?: boolean,
        accessToken?: string
    } = {}) {
        this.fire(new Event('dataloading', {dataType: 'style'}));

        const validate = typeof options.validate === 'boolean' ?
            options.validate : !isMapboxURL(url);

        url = this.map._requestManager.normalizeStyleURL(url, options.accessToken);
        const request = this.map._requestManager.transformRequest(url, ResourceType.Style);
        this._request = getJSON(request, (error: ?Error, json: ?Object) => {
            this._request = null;
            if (error) {
                this.fire(new ErrorEvent(error));
            } else if (json) {
                this._load(json, validate);
            }
        });
    }

    loadJSON(json: StyleSpecification, options: StyleSetterOptions = {}) {
        this.fire(new Event('dataloading', {dataType: 'style'}));

        this._request = browser.frame(() => {
            this._request = null;
            this._load(json, options.validate !== false);
        });
    }

    loadEmpty() {
        this.fire(new Event('dataloading', {dataType: 'style'}));
        this._load(empty, false);
    }

    _updateLayerCount(layer: StyleLayer, add: boolean) {
        // Typed layer bookkeeping
        const count = add ? 1 : -1;
        if (layer.is3D()) {
            this._num3DLayers += count;
        }
        if (layer.type === 'circle') {
            this._numCircleLayers += count;
        }
        if (layer.type === 'symbol') {
            this._numSymbolLayers += count;
        }
    }

    _load(json: StyleSpecification, validate: boolean) {
        if (validate && emitValidationErrors(this, validateStyle(json))) {
            return;
        }

        this._loaded = true;
        this.stylesheet = json;

        for (const id in json.sources) {
            this.addSource(id, json.sources[id], {validate: false});
        }
        this._changed = false; // avoid triggering redundant style update after adding initial sources
        if (json.sprite) {
            this._loadSprite(json.sprite);
        } else {
            this.imageManager.setLoaded(true);
            this.dispatcher.broadcast('spriteLoaded', true);
        }

        this.glyphManager.setURL(json.glyphs);

        const layers = deref(this.stylesheet.layers);

        this._order = layers.map((layer) => layer.id);

        this._layers = {};
        this._serializedLayers = {};
        for (let layer of layers) {
            layer = createStyleLayer(layer);
            layer.setEventedParent(this, {layer: {id: layer.id}});
            this._layers[layer.id] = layer;
            this._serializedLayers[layer.id] = layer.serialize();
            this._updateLayerCount(layer, true);
        }
        this.dispatcher.broadcast('setLayers', this._serializeLayers(this._order));

        this.light = new Light(this.stylesheet.light);
        if (this.stylesheet.terrain) {
            this._createTerrain(this.stylesheet.terrain);
        }
        this._updateDrapeFirstLayers();

        this.fire(new Event('data', {dataType: 'style'}));
        this.fire(new Event('style.load'));
    }

    _loadSprite(url: string) {
        this._spriteRequest = loadSprite(url, this.map._requestManager, (err, images) => {
            this._spriteRequest = null;
            if (err) {
                this.fire(new ErrorEvent(err));
            } else if (images) {
                for (const id in images) {
                    this.imageManager.addImage(id, images[id]);
                }
            }

            this.imageManager.setLoaded(true);
            this._availableImages = this.imageManager.listImages();
            this.dispatcher.broadcast('setImages', this._availableImages);
            this.dispatcher.broadcast('spriteLoaded', true);
            this.fire(new Event('data', {dataType: 'style'}));
        });
    }

    _validateLayer(layer: StyleLayer) {
        const source = this.getSource(layer.source);
        if (!source) {
            return;
        }

        const sourceLayer = layer.sourceLayer;
        if (!sourceLayer) {
            return;
        }

        if (source.type === 'geojson' || (source.vectorLayerIds && source.vectorLayerIds.indexOf(sourceLayer) === -1)) {
            this.fire(new ErrorEvent(new Error(
                `Source layer "${sourceLayer}" ` +
                `does not exist on source "${source.id}" ` +
                `as specified by style layer "${layer.id}"`
            )));
        }
    }

    loaded() {
        if (!this._loaded)
            return false;

        if (Object.keys(this._updatedSources).length)
            return false;

        for (const id in this._sourceCaches)
            if (!this._sourceCaches[id].loaded())
                return false;

        if (!this.imageManager.isLoaded())
            return false;

        return true;
    }

    _serializeLayers(ids: Array<string>): Array<Object> {
        const serializedLayers = [];
        for (const id of ids) {
            const layer = this._layers[id];
            if (layer.type !== 'custom') {
                serializedLayers.push(layer.serialize());
            }
        }
        return serializedLayers;
    }

    hasTransitions() {
        if (this.light && this.light.hasTransition()) {
            return true;
        }

        for (const id in this._sourceCaches) {
            if (this._sourceCaches[id].hasTransition()) {
                return true;
            }
        }

        for (const id in this._layers) {
            if (this._layers[id].hasTransition()) {
                return true;
            }
        }

        return false;
    }

    get order(): Array<string> {
        if (this.map._optimizeForTerrain && this.terrain) {
            assert(this._drapedFirstOrder.length === this._order.length);
            return this._drapedFirstOrder;
        }
        return this._order;
    }

    isLayerDraped(layer: StyleLayer): boolean {
        if (!this.terrain) return false;
        return drapedLayers[layer.type];
    }

    _checkLoaded() {
        if (!this._loaded) {
            throw new Error('Style is not done loading');
        }
    }

    /**
     * Apply queued style updates in a batch and recalculate zoom-dependent paint properties.
     * @private
     */
    update(parameters: EvaluationParameters) {
        if (!this._loaded) {
            return;
        }

        const changed = this._changed;
        if (this._changed) {
            const updatedIds = Object.keys(this._updatedLayers);
            const removedIds = Object.keys(this._removedLayers);

            if (updatedIds.length || removedIds.length) {
                this._updateWorkerLayers(updatedIds, removedIds);
            }
            for (const id in this._updatedSources) {
                const action = this._updatedSources[id];
                assert(action === 'reload' || action === 'clear');
                if (action === 'reload') {
                    this._reloadSource(id);
                } else if (action === 'clear') {
                    this._clearSource(id);
                }
            }

            this._updateTilesForChangedImages();

            for (const id in this._updatedPaintProps) {
                this._layers[id].updateTransitions(parameters);
            }

            this.light.updateTransitions(parameters);

            this._resetUpdates();
        }

        const sourcesUsedBefore = {};

        for (const sourceId in this._sourceCaches) {
            const sourceCache = this._sourceCaches[sourceId];
            sourcesUsedBefore[sourceId] = sourceCache.used;
            sourceCache.used = false;
        }

        for (const layerId of this._order) {
            const layer = this._layers[layerId];

            layer.recalculate(parameters, this._availableImages);
            if (!layer.isHidden(parameters.zoom)) {
                const sourceCache = this._getLayerSourceCache(layer);
                if (sourceCache) sourceCache.used = true;
            }

            const painter = this.map.painter;
            if (painter) {
                const programIds = layer.getProgramIds();
                if (!programIds) continue;

                const programConfiguration = layer.getProgramConfiguration(parameters.zoom);

                for (const programId of programIds) {
                    painter.useProgram(programId, programConfiguration);
                }
            }
        }

        for (const sourceId in sourcesUsedBefore) {
            const sourceCache = this._sourceCaches[sourceId];
            if (sourcesUsedBefore[sourceId] !== sourceCache.used) {
                sourceCache.getSource().fire(new Event('data', {sourceDataType: 'visibility', dataType:'source', sourceId: sourceCache.getSource().id}));
            }
        }

        this.light.recalculate(parameters);
        if (this.terrain) {
            this.terrain.recalculate(parameters);
        }
        this.z = parameters.zoom;

        if (changed) {
            this.fire(new Event('data', {dataType: 'style'}));
        }
    }

    /*
     * Apply any queued image changes.
     */
    _updateTilesForChangedImages() {
        const changedImages = Object.keys(this._changedImages);
        if (changedImages.length) {
            for (const name in this._sourceCaches) {
                this._sourceCaches[name].reloadTilesForDependencies(['icons', 'patterns'], changedImages);
            }
            this._changedImages = {};
        }
    }

    _updateWorkerLayers(updatedIds: Array<string>, removedIds: Array<string>) {
        this.dispatcher.broadcast('updateLayers', {
            layers: this._serializeLayers(updatedIds),
            removedIds
        });
    }

    _resetUpdates() {
        this._changed = false;

        this._updatedLayers = {};
        this._removedLayers = {};

        this._updatedSources = {};
        this._updatedPaintProps = {};

        this._changedImages = {};
    }

    /**
     * Update this style's state to match the given style JSON, performing only
     * the necessary mutations.
     *
     * May throw an Error ('Unimplemented: METHOD') if the mapbox-gl-style-spec
     * diff algorithm produces an operation that is not supported.
     *
     * @returns {boolean} true if any changes were made; false otherwise
     * @private
     */
    setState(nextState: StyleSpecification) {
        this._checkLoaded();

        if (emitValidationErrors(this, validateStyle(nextState))) return false;

        nextState = clone(nextState);
        nextState.layers = deref(nextState.layers);

        const changes = diffStyles(this.serialize(), nextState)
            .filter(op => !(op.command in ignoredDiffOperations));

        if (changes.length === 0) {
            return false;
        }

        const unimplementedOps = changes.filter(op => !(op.command in supportedDiffOperations));
        if (unimplementedOps.length > 0) {
            throw new Error(`Unimplemented: ${unimplementedOps.map(op => op.command).join(', ')}.`);
        }

        changes.forEach((op) => {
            if (op.command === 'setTransition') {
                // `transition` is always read directly off of
                // `this.stylesheet`, which we update below
                return;
            }
            (this: any)[op.command].apply(this, op.args);
        });

        this.stylesheet = nextState;

        return true;
    }

    addImage(id: string, image: StyleImage) {
        if (this.getImage(id)) {
            return this.fire(new ErrorEvent(new Error('An image with this name already exists.')));
        }
        this.imageManager.addImage(id, image);
        this._afterImageUpdated(id);
    }

    updateImage(id: string, image: StyleImage) {
        this.imageManager.updateImage(id, image);
    }

    getImage(id: string): ?StyleImage {
        return this.imageManager.getImage(id);
    }

    removeImage(id: string) {
        if (!this.getImage(id)) {
            return this.fire(new ErrorEvent(new Error('No image with this name exists.')));
        }
        this.imageManager.removeImage(id);
        this._afterImageUpdated(id);
    }

    _afterImageUpdated(id: string) {
        this._availableImages = this.imageManager.listImages();
        this._changedImages[id] = true;
        this._changed = true;
        this.dispatcher.broadcast('setImages', this._availableImages);
        this.fire(new Event('data', {dataType: 'style'}));
    }

    listImages() {
        this._checkLoaded();

        return this.imageManager.listImages();
    }

    addSource(id: string, source: SourceSpecification, options: StyleSetterOptions = {}) {
        this._checkLoaded();

        if (this.getSource(id) !== undefined) {
            throw new Error('There is already a source with this ID');
        }

        if (!source.type) {
            throw new Error(`The type property must be defined, but only the following properties were given: ${Object.keys(source).join(', ')}.`);
        }

        const builtIns = ['vector', 'raster', 'geojson', 'video', 'image'];
        const shouldValidate = builtIns.indexOf(source.type) >= 0;
        if (shouldValidate && this._validate(validateStyle.source, `sources.${id}`, source, null, options)) return;

        if (this.map && this.map._collectResourceTiming) (source: any).collectResourceTiming = true;

        const sourceInstance = createSource(id, source, this.dispatcher, this);

        sourceInstance.setEventedParent(this, () => ({
            isSourceLoaded: this.loaded(),
            source: sourceInstance.serialize(),
            sourceId: id
        }));

        const addSourceCache = (onlySymbols) => {
            const sourceCacheId = (onlySymbols ? 'symbol:' : 'other:') + id;
            const sourceCache = this._sourceCaches[sourceCacheId] = new SourceCache(sourceCacheId, sourceInstance, onlySymbols);
            (onlySymbols ? this._symbolSourceCaches : this._otherSourceCaches)[id] = sourceCache;
            sourceCache.style = this;

            sourceCache.onAdd(this.map);
        };

        addSourceCache(false);
        if (source.type === 'vector' || source.type === 'geojson') {
            addSourceCache(true);
        }

        if (sourceInstance.onAdd) sourceInstance.onAdd(this.map);

        this._changed = true;
    }

    /**
     * Remove a source from this stylesheet, given its id.
     * @param {string} id id of the source to remove
     * @throws {Error} if no source is found with the given ID
     * @returns {Map} The {@link Map} object.
     */
    removeSource(id: string) {
        this._checkLoaded();

        const source = this.getSource(id);
        if (source === undefined) {
            throw new Error('There is no source with this ID');
        }
        for (const layerId in this._layers) {
            if (this._layers[layerId].source === id) {
                return this.fire(new ErrorEvent(new Error(`Source "${id}" cannot be removed while layer "${layerId}" is using it.`)));
            }
        }
        if (this.terrain && this.terrain.get().source === id) {
            return this.fire(new ErrorEvent(new Error(`Source "${id}" cannot be removed while terrain is using it.`)));
        }

        const sourceCaches = this._getSourceCaches(id);
        for (const sourceCache of sourceCaches) {
            delete this._sourceCaches[sourceCache.id];
            delete this._updatedSources[sourceCache.id];
            sourceCache.fire(new Event('data', {sourceDataType: 'metadata', dataType:'source', sourceId: sourceCache.getSource().id}));
            sourceCache.setEventedParent(null);
            sourceCache.clearTiles();
        }
        delete this._otherSourceCaches[id];
        delete this._symbolSourceCaches[id];

        source.setEventedParent(null);
        if (source.onRemove) {
            source.onRemove(this.map);
        }
        this._changed = true;
    }

    /**
    * Set the data of a GeoJSON source, given its id.
    * @param {string} id id of the source
    * @param {GeoJSON|string} data GeoJSON source
    */
    setGeoJSONSourceData(id: string, data: GeoJSON | string) {
        this._checkLoaded();

        assert(this.getSource(id) !== undefined, 'There is no source with this ID');
        const geojsonSource: GeoJSONSource = (this.getSource(id): any);
        assert(geojsonSource.type === 'geojson');

        geojsonSource.setData(data);
        this._changed = true;
    }

    /**
     * Get a source by id.
     * @param {string} id id of the desired source
     * @returns {Object} source
     */
    getSource(id: string): Object {
        const sourceCache = this._getSourceCache(id);
        return sourceCache && sourceCache.getSource();
    }

    /**
     * Add a layer to the map style. The layer will be inserted before the layer with
     * ID `before`, or appended if `before` is omitted.
     * @param {Object | CustomLayerInterface} layerObject The style layer to add.
     * @param {string} [before] ID of an existing layer to insert before
     * @param {Object} options Style setter options.
     * @returns {Map} The {@link Map} object.
     */
    addLayer(layerObject: LayerSpecification | CustomLayerInterface, before?: string, options: StyleSetterOptions = {}) {
        this._checkLoaded();

        const id = layerObject.id;

        if (this.getLayer(id)) {
            this.fire(new ErrorEvent(new Error(`Layer with id "${id}" already exists on this map`)));
            return;
        }

        let layer;
        if (layerObject.type === 'custom') {

            if (emitValidationErrors(this, validateCustomStyleLayer(layerObject))) return;

            layer = createStyleLayer(layerObject);

        } else {
            if (typeof layerObject.source === 'object') {
                this.addSource(id, layerObject.source);
                layerObject = clone(layerObject);
                layerObject = (extend(layerObject, {source: id}): any);
            }

            // this layer is not in the style.layers array, so we pass an impossible array index
            if (this._validate(validateStyle.layer,
                `layers.${id}`, layerObject, {arrayIndex: -1}, options)) return;

            layer = createStyleLayer(layerObject);
            this._validateLayer(layer);

            layer.setEventedParent(this, {layer: {id}});
            this._serializedLayers[layer.id] = layer.serialize();
            this._updateLayerCount(layer, true);
        }

        const index = before ? this._order.indexOf(before) : this._order.length;
        if (before && index === -1) {
            this.fire(new ErrorEvent(new Error(`Layer with id "${before}" does not exist on this map.`)));
            return;
        }

        this._order.splice(index, 0, id);
        this._layerOrderChanged = true;

        this._layers[id] = layer;

        const sourceCache = this._getLayerSourceCache(layer);
        if (this._removedLayers[id] && layer.source && sourceCache && layer.type !== 'custom') {
            // If, in the current batch, we have already removed this layer
            // and we are now re-adding it with a different `type`, then we
            // need to clear (rather than just reload) the underyling source's
            // tiles.  Otherwise, tiles marked 'reloading' will have buckets /
            // buffers that are set up for the _previous_ version of this
            // layer, causing, e.g.:
            // https://github.com/mapbox/mapbox-gl-js/issues/3633
            const removed = this._removedLayers[id];
            delete this._removedLayers[id];
            if (removed.type !== layer.type) {
                this._updatedSources[layer.source] = 'clear';
            } else {
                this._updatedSources[layer.source] = 'reload';
                sourceCache.pause();
            }
        }
        this._updateLayer(layer);

        if (layer.onAdd) {
            layer.onAdd(this.map);
        }

        this._updateDrapeFirstLayers();
    }

    /**
     * Moves a layer to a different z-position. The layer will be inserted before the layer with
     * ID `before`, or appended if `before` is omitted.
     * @param {string} id  ID of the layer to move
     * @param {string} [before] ID of an existing layer to insert before
     */
    moveLayer(id: string, before?: string) {
        this._checkLoaded();
        this._changed = true;

        const layer = this._layers[id];
        if (!layer) {
            this.fire(new ErrorEvent(new Error(`The layer '${id}' does not exist in the map's style and cannot be moved.`)));
            return;
        }

        if (id === before) {
            return;
        }

        const index = this._order.indexOf(id);
        this._order.splice(index, 1);

        const newIndex = before ? this._order.indexOf(before) : this._order.length;
        if (before && newIndex === -1) {
            this.fire(new ErrorEvent(new Error(`Layer with id "${before}" does not exist on this map.`)));
            return;
        }
        this._order.splice(newIndex, 0, id);

        this._layerOrderChanged = true;

        this._updateDrapeFirstLayers();
    }

    /**
     * Remove the layer with the given id from the style.
     *
     * If no such layer exists, an `error` event is fired.
     *
     * @param {string} id id of the layer to remove
     * @fires error
     */
    removeLayer(id: string) {
        this._checkLoaded();

        const layer = this._layers[id];
        if (!layer) {
            this.fire(new ErrorEvent(new Error(`The layer '${id}' does not exist in the map's style and cannot be removed.`)));
            return;
        }

        layer.setEventedParent(null);

        this._updateLayerCount(layer, false);

        const index = this._order.indexOf(id);
        this._order.splice(index, 1);

        this._layerOrderChanged = true;
        this._changed = true;
        this._removedLayers[id] = layer;
        delete this._layers[id];
        delete this._serializedLayers[id];
        delete this._updatedLayers[id];
        delete this._updatedPaintProps[id];

        if (layer.onRemove) {
            layer.onRemove(this.map);
        }

        this._updateDrapeFirstLayers();
    }

    /**
     * Return the style layer object with the given `id`.
     *
     * @param {string} id - id of the desired layer
     * @returns {?Object} a layer, if one with the given `id` exists
     */
    getLayer(id: string): Object {
        return this._layers[id];
    }

    /**
     * checks if a specific layer is present within the style.
     *
     * @param {string} id - id of the desired layer
     * @returns {boolean} a boolean specifying if the given layer is present
     */
    hasLayer(id: string): boolean {
        return id in this._layers;
    }

    /**
     * checks if a specific layer type is present within the style.
     *
     * @param {string} type - type of the desired layer
     * @returns {boolean} a boolean specifying if the given layer type is present
     */
    hasLayerType(type: string): boolean {
        for (const layerId in this._layers) {
            const layer = this._layers[layerId];
            if (layer.type === type) {
                return true;
            }
        }
        return false;
    }

    setLayerZoomRange(layerId: string, minzoom: ?number, maxzoom: ?number) {
        this._checkLoaded();

        const layer = this.getLayer(layerId);
        if (!layer) {
            this.fire(new ErrorEvent(new Error(`The layer '${layerId}' does not exist in the map's style and cannot have zoom extent.`)));
            return;
        }

        if (layer.minzoom === minzoom && layer.maxzoom === maxzoom) return;

        if (minzoom != null) {
            layer.minzoom = minzoom;
        }
        if (maxzoom != null) {
            layer.maxzoom = maxzoom;
        }
        this._updateLayer(layer);
    }

    setFilter(layerId: string, filter: ?FilterSpecification,  options: StyleSetterOptions = {}) {
        this._checkLoaded();

        const layer = this.getLayer(layerId);
        if (!layer) {
            this.fire(new ErrorEvent(new Error(`The layer '${layerId}' does not exist in the map's style and cannot be filtered.`)));
            return;
        }

        if (deepEqual(layer.filter, filter)) {
            return;
        }

        if (filter === null || filter === undefined) {
            layer.filter = undefined;
            this._updateLayer(layer);
            return;
        }

        if (this._validate(validateStyle.filter, `layers.${layer.id}.filter`, filter, null, options)) {
            return;
        }

        layer.filter = clone(filter);
        this._updateLayer(layer);
    }

    /**
     * Get a layer's filter object
     * @param {string} layer the layer to inspect
     * @returns {*} the layer's filter, if any
     */
    getFilter(layer: string) {
        return clone(this.getLayer(layer).filter);
    }

    setLayoutProperty(layerId: string, name: string, value: any,  options: StyleSetterOptions = {}) {
        this._checkLoaded();

        const layer = this.getLayer(layerId);
        if (!layer) {
            this.fire(new ErrorEvent(new Error(`The layer '${layerId}' does not exist in the map's style and cannot be styled.`)));
            return;
        }

        if (deepEqual(layer.getLayoutProperty(name), value)) return;

        layer.setLayoutProperty(name, value, options);
        this._updateLayer(layer);
    }

    /**
     * Get a layout property's value from a given layer
     * @param {string} layerId the layer to inspect
     * @param {string} name the name of the layout property
     * @returns {*} the property value
     */
    getLayoutProperty(layerId: string, name: string) {
        const layer = this.getLayer(layerId);
        if (!layer) {
            this.fire(new ErrorEvent(new Error(`The layer '${layerId}' does not exist in the map's style.`)));
            return;
        }

        return layer.getLayoutProperty(name);
    }

    setPaintProperty(layerId: string, name: string, value: any, options: StyleSetterOptions = {}) {
        this._checkLoaded();

        const layer = this.getLayer(layerId);
        if (!layer) {
            this.fire(new ErrorEvent(new Error(`The layer '${layerId}' does not exist in the map's style and cannot be styled.`)));
            return;
        }

        if (deepEqual(layer.getPaintProperty(name), value)) return;

        const requiresRelayout = layer.setPaintProperty(name, value, options);
        if (requiresRelayout) {
            this._updateLayer(layer);
        }

        this._changed = true;
        this._updatedPaintProps[layerId] = true;
    }

    getPaintProperty(layer: string, name: string) {
        return this.getLayer(layer).getPaintProperty(name);
    }

    setFeatureState(target: { source: string; sourceLayer?: string; id: string | number; }, state: Object) {
        this._checkLoaded();
        const sourceId = target.source;
        const sourceLayer = target.sourceLayer;
        const source = this.getSource(sourceId);

        if (source === undefined) {
            this.fire(new ErrorEvent(new Error(`The source '${sourceId}' does not exist in the map's style.`)));
            return;
        }
        const sourceType = source.type;
        if (sourceType === 'geojson' && sourceLayer) {
            this.fire(new ErrorEvent(new Error(`GeoJSON sources cannot have a sourceLayer parameter.`)));
            return;
        }
        if (sourceType === 'vector' && !sourceLayer) {
            this.fire(new ErrorEvent(new Error(`The sourceLayer parameter must be provided for vector source types.`)));
            return;
        }
        if (target.id === undefined) {
            this.fire(new ErrorEvent(new Error(`The feature id parameter must be provided.`)));
        }

        const sourceCaches = this._getSourceCaches(sourceId);
        for (const sourceCache of sourceCaches) {
            sourceCache.setFeatureState(sourceLayer, target.id, state);
        }
    }

    removeFeatureState(target: { source: string; sourceLayer?: string; id?: string | number; }, key?: string) {
        this._checkLoaded();
        const sourceId = target.source;
        const source = this.getSource(sourceId);

        if (source === undefined) {
            this.fire(new ErrorEvent(new Error(`The source '${sourceId}' does not exist in the map's style.`)));
            return;
        }

        const sourceType = source.type;
        const sourceLayer = sourceType === 'vector' ? target.sourceLayer : undefined;

        if (sourceType === 'vector' && !sourceLayer) {
            this.fire(new ErrorEvent(new Error(`The sourceLayer parameter must be provided for vector source types.`)));
            return;
        }

        if (key && (typeof target.id !== 'string' && typeof target.id !== 'number')) {
            this.fire(new ErrorEvent(new Error(`A feature id is required to remove its specific state property.`)));
            return;
        }

        const sourceCaches = this._getSourceCaches(sourceId);
        for (const sourceCache of sourceCaches) {
            sourceCache.removeFeatureState(sourceLayer, target.id, key);
        }
    }

    getFeatureState(target: { source: string; sourceLayer?: string; id: string | number; }) {
        this._checkLoaded();
        const sourceId = target.source;
        const sourceLayer = target.sourceLayer;
        const source = this.getSource(sourceId);

        if (source === undefined) {
            this.fire(new ErrorEvent(new Error(`The source '${sourceId}' does not exist in the map's style.`)));
            return;
        }
        const sourceType = source.type;
        if (sourceType === 'vector' && !sourceLayer) {
            this.fire(new ErrorEvent(new Error(`The sourceLayer parameter must be provided for vector source types.`)));
            return;
        }
        if (target.id === undefined) {
            this.fire(new ErrorEvent(new Error(`The feature id parameter must be provided.`)));
        }

        const sourceCaches = this._getSourceCaches(sourceId);
        return sourceCaches[0].getFeatureState(sourceLayer, target.id);
    }

    getTransition() {
        return extend({duration: 300, delay: 0}, this.stylesheet && this.stylesheet.transition);
    }

    serialize() {
        const sources = {};
        for (const cacheId in this._sourceCaches) {
            const source = this._sourceCaches[cacheId].getSource();
            if (!sources[source.id]) {
                sources[source.id] = source.serialize();
            }
        }
        return filterObject({
            version: this.stylesheet.version,
            name: this.stylesheet.name,
            metadata: this.stylesheet.metadata,
            light: this.stylesheet.light,
            terrain: this.stylesheet.terrain,
            center: this.stylesheet.center,
            zoom: this.stylesheet.zoom,
            bearing: this.stylesheet.bearing,
            pitch: this.stylesheet.pitch,
            sprite: this.stylesheet.sprite,
            glyphs: this.stylesheet.glyphs,
            transition: this.stylesheet.transition,
            sources,
            layers: this._serializeLayers(this._order)
        }, (value) => { return value !== undefined; });
    }

    _updateLayer(layer: StyleLayer) {
        this._updatedLayers[layer.id] = true;
        const sourceCache = this._getLayerSourceCache(layer);
        if (layer.source && !this._updatedSources[layer.source] &&
            //Skip for raster layers (https://github.com/mapbox/mapbox-gl-js/issues/7865)
            sourceCache &&
            sourceCache.getSource().type !== 'raster') {
            this._updatedSources[layer.source] = 'reload';
            sourceCache.pause();
        }
        this._changed = true;
    }

    _flattenAndSortRenderedFeatures(sourceResults: Array<any>) {
        // Feature order is complicated.
        // The order between features in two 2D layers is always determined by layer order.
        // The order between features in two 3D layers is always determined by depth.
        // The order between a feature in a 2D layer and a 3D layer is tricky:
        //      Most often layer order determines the feature order in this case. If
        //      a line layer is above a extrusion layer the line feature will be rendered
        //      above the extrusion. If the line layer is below the extrusion layer,
        //      it will be rendered below it.
        //
        //      There is a weird case though.
        //      You have layers in this order: extrusion_layer_a, line_layer, extrusion_layer_b
        //      Each layer has a feature that overlaps the other features.
        //      The feature in extrusion_layer_a is closer than the feature in extrusion_layer_b so it is rendered above.
        //      The feature in line_layer is rendered above extrusion_layer_a.
        //      This means that that the line_layer feature is above the extrusion_layer_b feature despite
        //      it being in an earlier layer.

        const isLayer3D = layerId => this._layers[layerId].type === 'fill-extrusion';

        const layerIndex = {};
        const features3D = [];
        for (let l = this._order.length - 1; l >= 0; l--) {
            const layerId = this._order[l];
            if (isLayer3D(layerId)) {
                layerIndex[layerId] = l;
                for (const sourceResult of sourceResults) {
                    const layerFeatures = sourceResult[layerId];
                    if (layerFeatures) {
                        for (const featureWrapper of layerFeatures) {
                            features3D.push(featureWrapper);
                        }
                    }
                }
            }
        }

        features3D.sort((a, b) => {
            return b.intersectionZ - a.intersectionZ;
        });

        const features = [];
        for (let l = this._order.length - 1; l >= 0; l--) {
            const layerId = this._order[l];

            if (isLayer3D(layerId)) {
                // add all 3D features that are in or above the current layer
                for (let i = features3D.length - 1; i >= 0; i--) {
                    const topmost3D = features3D[i].feature;
                    if (layerIndex[topmost3D.layer.id] < l) break;
                    features.push(topmost3D);
                    features3D.pop();
                }
            } else {
                for (const sourceResult of sourceResults) {
                    const layerFeatures = sourceResult[layerId];
                    if (layerFeatures) {
                        for (const featureWrapper of layerFeatures) {
                            features.push(featureWrapper.feature);
                        }
                    }
                }
            }
        }

        return features;
    }

    queryRenderedFeatures(queryGeometry: PointLike | [PointLike, PointLike], params: any, transform: Transform) {
        if (params && params.filter) {
            this._validate(validateStyle.filter, 'queryRenderedFeatures.filter', params.filter, null, params);
        }

        const includedSources = {};
        if (params && params.layers) {
            if (!Array.isArray(params.layers)) {
                this.fire(new ErrorEvent(new Error('parameters.layers must be an Array.')));
                return [];
            }
            for (const layerId of params.layers) {
                const layer = this._layers[layerId];
                if (!layer) {
                    // this layer is not in the style.layers array
                    this.fire(new ErrorEvent(new Error(`The layer '${layerId}' does not exist in the map's style and cannot be queried for features.`)));
                    return [];
                }
                includedSources[layer.source] = true;
            }
        }

        const sourceResults = [];

        params.availableImages = this._availableImages;

        const has3DLayer = (params && params.layers) ?
            params.layers.some((layerId) => {
                const layer = this.getLayer(layerId);
                return layer && layer.is3D();
            }) :
            this.has3DLayers();
        const queryGeometryStruct = QueryGeometry.createFromScreenPoints(queryGeometry, transform);

        for (const id in this._sourceCaches) {
            const sourceId = this._sourceCaches[id].getSource().id;
            if (params.layers && !includedSources[sourceId]) continue;
            sourceResults.push(
                queryRenderedFeatures(
                    this._sourceCaches[id],
                    this._layers,
                    this._serializedLayers,
                    queryGeometryStruct,
                    params,
                    transform,
                    has3DLayer,
                    !!this.map._showQueryGeometry)
            );
        }

        if (this.placement) {
            // If a placement has run, query against its CollisionIndex
            // for symbol results, and treat it as an extra source to merge
            sourceResults.push(
                queryRenderedSymbols(
                    this._layers,
                    this._serializedLayers,
                    this._getLayerSourceCache.bind(this),
                    queryGeometryStruct.screenGeometry,
                    params,
                    this.placement.collisionIndex,
                    this.placement.retainedQueryData)
            );
        }

        return this._flattenAndSortRenderedFeatures(sourceResults);
    }

    querySourceFeatures(sourceID: string, params: ?{sourceLayer: ?string, filter: ?Array<any>, validate?: boolean}) {
        if (params && params.filter) {
            this._validate(validateStyle.filter, 'querySourceFeatures.filter', params.filter, null, params);
        }
        const sourceCaches = this._getSourceCaches(sourceID);
        let results = [];
        for (const sourceCache of sourceCaches) {
            results = results.concat(querySourceFeatures(sourceCache, params));
        }
        return results;
    }

    addSourceType(name: string, SourceType: SourceClass, callback: Callback<void>) {
        if (Style.getSourceType(name)) {
            return callback(new Error(`A source type called "${name}" already exists.`));
        }

        Style.setSourceType(name, SourceType);

        if (!SourceType.workerSourceURL) {
            return callback(null, null);
        }

        this.dispatcher.broadcast('loadWorkerSource', {
            name,
            url: SourceType.workerSourceURL
        }, callback);
    }

    getLight() {
        return this.light.getLight();
    }

    setLight(lightOptions: LightSpecification, options: StyleSetterOptions = {}) {
        this._checkLoaded();

        const light = this.light.getLight();
        let _update = false;
        for (const key in lightOptions) {
            if (!deepEqual(lightOptions[key], light[key])) {
                _update = true;
                break;
            }
        }
        if (!_update) return;

        const parameters = {
            now: browser.now(),
            transition: extend({
                duration: 300,
                delay: 0
            }, this.stylesheet.transition)
        };

        this.light.setLight(lightOptions, options);
        this.light.updateTransitions(parameters);
    }

    // eslint-disable-next-line no-warning-comments
    // TODO: generic approach for root level property: light, terrain, skybox.
    // It is not done here to prevent rebasing issues.
    setTerrain(terrainOptions: TerrainSpecification) {
        this._checkLoaded();

        //Disabling
        if (!terrainOptions) {
            delete this.terrain;
            delete this.stylesheet.terrain;
            this.dispatcher.broadcast('enableTerrain', false);
            this._force3DLayerUpdate();
            return;
        }

        // Input validation and source object unrolling
        if (typeof terrainOptions.source === 'object') {
            const id = 'terrain-dem-src';
            this.addSource(id, ((terrainOptions.source): any));
            terrainOptions = clone(terrainOptions);
            terrainOptions = (extend(terrainOptions, {source: id}): any);
        }
        if (this._validate(validateStyle.terrain, 'terrain', terrainOptions)) return;

        // Enabling
        if (!this.terrain) {
            this._createTerrain(terrainOptions);
        } else { // Updating
            const terrain = this.terrain;
            const currSpec = terrain.get();
            for (const key in terrainOptions) {
                if (!deepEqual(terrainOptions[key], currSpec[key])) {
                    terrain.set(terrainOptions);
                    this.stylesheet.terrain = terrainOptions;
                    const parameters = {
                        now: browser.now(),
                        transition: extend({
                            duration: 0
                        }, this.stylesheet.transition)
                    };

                    terrain.updateTransitions(parameters);
                    break;
                }
            }
        }

        this._updateDrapeFirstLayers();
    }

    _updateDrapeFirstLayers() {
        if (!this.map._optimizeForTerrain || !this.terrain) {
            return;
        }

        const draped = this._order.filter((id) => {
            return this.isLayerDraped(this._layers[id]);
        });

        const nonDraped = this._order.filter((id) => {
            return !this.isLayerDraped(this._layers[id]);
        });
        this._drapedFirstOrder = [];
        this._drapedFirstOrder.push(...draped);
        this._drapedFirstOrder.push(...nonDraped);
    }

    _createTerrain(terrainOptions: TerrainSpecification) {
        const terrain = this.terrain = new Terrain(terrainOptions);
        this.stylesheet.terrain = terrainOptions;
        this.dispatcher.broadcast('enableTerrain', true);
        this._force3DLayerUpdate();
        const parameters = {
            now: browser.now(),
            transition: extend({
                duration: 0
            }, this.stylesheet.transition)
        };

        terrain.updateTransitions(parameters);
    }

    _force3DLayerUpdate() {
        for (const layerId in this._layers) {
            const layer = this._layers[layerId];
            if (layer.type === 'fill-extrusion') {
                this._updateLayer(layer);
            }
        }
    }

    _validate(validate: Validator, key: string, value: any, props: any, options: { validate?: boolean } = {}) {
        if (options && options.validate === false) {
            return false;
        }
        return emitValidationErrors(this, validate.call(validateStyle, extend({
            key,
            style: this.serialize(),
            value,
            styleSpec
        }, props)));
    }

    _remove() {
        if (this._request) {
            this._request.cancel();
            this._request = null;
        }
        if (this._spriteRequest) {
            this._spriteRequest.cancel();
            this._spriteRequest = null;
        }
        rtlTextPluginEvented.off('pluginStateChange', this._rtlTextPluginCallback);
        for (const layerId in this._layers) {
            const layer: StyleLayer = this._layers[layerId];
            layer.setEventedParent(null);
        }
        for (const id in this._sourceCaches) {
            this._sourceCaches[id].clearTiles();
            this._sourceCaches[id].setEventedParent(null);
        }
        this.imageManager.setEventedParent(null);
        this.setEventedParent(null);
        this.dispatcher.remove();
    }

    _clearSource(id: string) {
        const sourceCaches = this._getSourceCaches(id);
        for (const sourceCache of sourceCaches) {
            sourceCache.clearTiles();
        }
    }

    _reloadSource(id: string) {
        const sourceCaches = this._getSourceCaches(id);
        for (const sourceCache of sourceCaches) {
            sourceCache.resume();
            sourceCache.reload();
        }
    }

    _updateSources(transform: Transform) {
        for (const id in this._sourceCaches) {
            this._sourceCaches[id].update(transform);
        }
    }

    _generateCollisionBoxes() {
        for (const id in this._sourceCaches) {
            const sourceCache = this._sourceCaches[id];
            sourceCache.resume();
            sourceCache.reload();
        }
    }

    _updatePlacement(transform: Transform, showCollisionBoxes: boolean, fadeDuration: number, crossSourceCollisions: boolean, forceFullPlacement: boolean = false) {
        let symbolBucketsChanged = false;
        let placementCommitted = false;

        const layerTiles = {};

        for (const layerID of this._order) {
            const styleLayer = this._layers[layerID];
            if (styleLayer.type !== 'symbol') continue;

            if (!layerTiles[styleLayer.source]) {
                const sourceCache = this._getLayerSourceCache(styleLayer);
                if (!sourceCache) continue;
                layerTiles[styleLayer.source] = sourceCache.getRenderableIds(true)
                    .map((id) => sourceCache.getTileByID(id))
                    .sort((a, b) => (b.tileID.overscaledZ - a.tileID.overscaledZ) || (a.tileID.isLessThan(b.tileID) ? -1 : 1));
            }

            const layerBucketsChanged = this.crossTileSymbolIndex.addLayer(styleLayer, layerTiles[styleLayer.source], transform.center.lng);
            symbolBucketsChanged = symbolBucketsChanged || layerBucketsChanged;
        }
        this.crossTileSymbolIndex.pruneUnusedLayers(this._order);

        // Anything that changes our "in progress" layer and tile indices requires us
        // to start over. When we start over, we do a full placement instead of incremental
        // to prevent starvation.
        // We need to restart placement to keep layer indices in sync.
        // Also force full placement when fadeDuration === 0 to ensure that newly loaded
        // tiles will fully display symbols in their first frame
        forceFullPlacement = forceFullPlacement || this._layerOrderChanged || fadeDuration === 0;

        if (this._layerOrderChanged) {
            this.fire(new Event('neworder'));
        }

        if (forceFullPlacement || !this.pauseablePlacement || (this.pauseablePlacement.isDone() && !this.placement.stillRecent(browser.now(), transform.zoom))) {
            this.pauseablePlacement = new PauseablePlacement(transform, this._order, forceFullPlacement, showCollisionBoxes, fadeDuration, crossSourceCollisions, this.placement);
            this._layerOrderChanged = false;
        }

        if (this.pauseablePlacement.isDone()) {
            // the last placement finished running, but the next one hasn’t
            // started yet because of the `stillRecent` check immediately
            // above, so mark it stale to ensure that we request another
            // render frame
            this.placement.setStale();
        } else {
            this.pauseablePlacement.continuePlacement(this._order, this._layers, layerTiles);

            if (this.pauseablePlacement.isDone()) {
                this.placement = this.pauseablePlacement.commit(browser.now());
                placementCommitted = true;
            }

            if (symbolBucketsChanged) {
                // since the placement gets split over multiple frames it is possible
                // these buckets were processed before they were changed and so the
                // placement is already stale while it is in progress
                this.pauseablePlacement.placement.setStale();
            }
        }

        if (placementCommitted || symbolBucketsChanged) {
            for (const layerID of this._order) {
                const styleLayer = this._layers[layerID];
                if (styleLayer.type !== 'symbol') continue;
                this.placement.updateLayerOpacities(styleLayer, layerTiles[styleLayer.source]);
            }
        }

        // needsRender is false when we have just finished a placement that didn't change the visibility of any symbols
        const needsRerender = !this.pauseablePlacement.isDone() || this.placement.hasTransitions(browser.now());
        return needsRerender;
    }

    _releaseSymbolFadeTiles() {
        for (const id in this._sourceCaches) {
            this._sourceCaches[id].releaseSymbolFadeTiles();
        }
    }

    // Callbacks from web workers

    getImages(mapId: string, params: {icons: Array<string>, source: string, tileID: OverscaledTileID, type: string}, callback: Callback<{[_: string]: StyleImage}>) {

        this.imageManager.getImages(params.icons, callback);

        // Apply queued image changes before setting the tile's dependencies so that the tile
        // is not reloaded unecessarily. Without this forced update the reload could happen in cases
        // like this one:
        // - icons contains "my-image"
        // - imageManager.getImages(...) triggers `onstyleimagemissing`
        // - the user adds "my-image" within the callback
        // - addImage adds "my-image" to this._changedImages
        // - the next frame triggers a reload of this tile even though it already has the latest version
        this._updateTilesForChangedImages();

        const setDependencies = (sourceCache: SourceCache) => {
            if (sourceCache) {
                sourceCache.setDependencies(params.tileID.key, params.type, params.icons);
            }
        };
        setDependencies(this._otherSourceCaches[params.source]);
        setDependencies(this._symbolSourceCaches[params.source]);
    }

    getGlyphs(mapId: string, params: {stacks: {[_: string]: Array<number>}}, callback: Callback<{[_: string]: {[_: number]: ?StyleGlyph}}>) {
        this.glyphManager.getGlyphs(params.stacks, callback);
    }

    getResource(mapId: string, params: RequestParameters, callback: ResponseCallback<any>): Cancelable {
        return makeRequest(params, callback);
    }

    _getSourceCache(source: string): SourceCache | void {
        return this._otherSourceCaches[source];
    }

    _getLayerSourceCache(layer: StyleLayer): SourceCache | void {
        return layer.type === 'symbol' ?
            this._symbolSourceCaches[layer.source] :
            this._otherSourceCaches[layer.source];
    }

    _getSourceCaches(source: string): Array<SourceCache> {
        const sourceCaches = [];
        if (this._otherSourceCaches[source]) {
            sourceCaches.push(this._otherSourceCaches[source]);
        }
        if (this._symbolSourceCaches[source]) {
            sourceCaches.push(this._symbolSourceCaches[source]);
        }
        return sourceCaches;
    }

    has3DLayers(): boolean {
        return this._num3DLayers > 0;
    }

    hasSymbolLayers(): boolean {
        return this._numSymbolLayers > 0;
    }

    hasCircleLayers(): boolean {
        return this._numCircleLayers > 0;
    }
}

Style.getSourceType = getSourceType;
Style.setSourceType = setSourceType;
Style.registerForPluginStateChange = registerForPluginStateChange;

export default Style;
