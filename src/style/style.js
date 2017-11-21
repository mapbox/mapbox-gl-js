// @flow

const assert = require('assert');
const Evented = require('../util/evented');
const StyleLayer = require('./style_layer');
const loadSprite = require('./load_sprite');
const ImageManager = require('../render/image_manager');
const GlyphManager = require('../render/glyph_manager');
const Light = require('./light');
const LineAtlas = require('../render/line_atlas');
const util = require('../util/util');
const ajax = require('../util/ajax');
const mapbox = require('../util/mapbox');
const browser = require('../util/browser');
const Dispatcher = require('../util/dispatcher');
const validateStyle = require('./validate_style');
const getSourceType = require('../source/source').getType;
const setSourceType = require('../source/source').setType;
const QueryFeatures = require('../source/query_features');
const SourceCache = require('../source/source_cache');
const GeoJSONSource = require('../source/geojson_source');
const styleSpec = require('../style-spec/reference/latest');
const getWorkerPool = require('../util/global_worker_pool');
const deref = require('../style-spec/deref');
const diff = require('../style-spec/diff');
const rtlTextPlugin = require('../source/rtl_text_plugin');
const Placement = require('./placement');

import type Map from '../ui/map';
import type Transform from '../geo/transform';
import type {Source} from '../source/source';
import type {StyleImage} from './style_image';
import type {StyleGlyph} from './style_glyph';
import type CollisionIndex from '../symbol/collision_index';
import type {Callback} from '../types/callback';

const supportedDiffOperations = util.pick(diff.operations, [
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
    'setGeoJSONSourceData'
    // 'setGlyphs',
    // 'setSprite',
]);

const ignoredDiffOperations = util.pick(diff.operations, [
    'setCenter',
    'setZoom',
    'setBearing',
    'setPitch'
]);

export type StyleOptions = {
    validate?: boolean,
    localIdeographFontFamily?: string
};

export type ZoomHistory = {
    lastIntegerZoom: number,
    lastIntegerZoomTime: number,
    lastZoom: number
};

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

    _layers: {[string]: StyleLayer};
    _order: Array<string>;
    sourceCaches: {[string]: SourceCache};
    zoomHistory: ZoomHistory | {};
    _loaded: boolean;
    _rtlTextPluginCallback: Function;
    _changed: boolean;
    _updatedSources: {[string]: 'clear' | 'reload'};
    _updatedLayers: {[string]: true};
    _removedLayers: {[string]: StyleLayer};
    _updatedPaintProps: {[layer: string]: {[class: string]: true}};
    _updatedAllPaintProps: boolean;
    _layerOrderChanged: boolean;

    collisionIndex: CollisionIndex;
    placement: Placement;
    z: number;

    constructor(map: Map, options: StyleOptions = {}) {
        super();

        this.map = map;
        this.dispatcher = new Dispatcher(getWorkerPool(), this);
        this.imageManager = new ImageManager();
        this.glyphManager = new GlyphManager(map._transformRequest, options.localIdeographFontFamily);
        this.lineAtlas = new LineAtlas(256, 512);

        this._layers = {};
        this._order  = [];
        this.sourceCaches = {};
        this.zoomHistory = {};
        this._loaded = false;

        this._resetUpdates();

        const self = this;
        this._rtlTextPluginCallback = rtlTextPlugin.registerForPluginAvailability((args) => {
            self.dispatcher.broadcast('loadRTLTextPlugin', args.pluginBlobURL, args.errorCallback);
            for (const id in self.sourceCaches) {
                self.sourceCaches[id].reload(); // Should be a no-op if the plugin loads before any tiles load
            }
        });

        this.on('data', (event) => {
            if (event.dataType !== 'source' || event.sourceDataType !== 'metadata') {
                return;
            }

            const sourceCache = this.sourceCaches[event.sourceId];
            if (!sourceCache) {
                return;
            }

            const source = sourceCache.getSource();
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
        this.fire('dataloading', {dataType: 'style'});

        const validate = typeof options.validate === 'boolean' ?
            options.validate : !mapbox.isMapboxURL(url);

        url = mapbox.normalizeStyleURL(url, options.accessToken);
        const request = this.map._transformRequest(url, ajax.ResourceType.Style);

        ajax.getJSON(request, (error, json) => {
            if (error) {
                this.fire('error', {error});
            } else if (json) {
                this._load((json: any), validate);
            }
        });
    }

    loadJSON(json: StyleSpecification, options: {
        validate?: boolean
    } = {}) {
        this.fire('dataloading', {dataType: 'style'});

        browser.frame(() => {
            this._load(json, options.validate !== false);
        });
    }

    _load(json: StyleSpecification, validate: boolean) {
        if (validate && validateStyle.emitErrors(this, validateStyle(json))) {
            return;
        }

        this._loaded = true;
        this.stylesheet = json;

        this.updatePaintProperties();

        for (const id in json.sources) {
            this.addSource(id, json.sources[id], {validate: false});
        }

        if (json.sprite) {
            loadSprite(json.sprite, this.map._transformRequest, (err, images) => {
                if (err) {
                    this.fire('error', err);
                } else if (images) {
                    for (const id in images) {
                        this.imageManager.addImage(id, images[id]);
                    }
                }

                this.imageManager.setLoaded(true);
                this.fire('data', {dataType: 'style'});
            });
        } else {
            this.imageManager.setLoaded(true);
        }

        this.glyphManager.setURL(json.glyphs);

        const layers = deref(this.stylesheet.layers);

        this._order = layers.map((layer) => layer.id);

        this._layers = {};
        for (let layer of layers) {
            layer = StyleLayer.create(layer);
            layer.setEventedParent(this, {layer: {id: layer.id}});
            this._layers[layer.id] = layer;
        }

        this.dispatcher.broadcast('setLayers', this._serializeLayers(this._order));

        this.light = new Light(this.stylesheet.light);

        this.fire('data', {dataType: 'style'});
        this.fire('style.load');
    }

    _validateLayer(layer: StyleLayer) {
        const sourceCache = this.sourceCaches[layer.source];
        if (!sourceCache) {
            return;
        }

        const sourceLayer = layer.sourceLayer;
        if (!sourceLayer) {
            return;
        }

        const source = sourceCache.getSource();
        if (source.type === 'geojson' || (source.vectorLayerIds && source.vectorLayerIds.indexOf(sourceLayer) === -1)) {
            this.fire('error', {
                error: new Error(
                    `Source layer "${sourceLayer}" ` +
                    `does not exist on source "${source.id}" ` +
                    `as specified by style layer "${layer.id}"`
                )
            });
        }
    }

    loaded() {
        if (!this._loaded)
            return false;

        if (Object.keys(this._updatedSources).length)
            return false;

        for (const id in this.sourceCaches)
            if (!this.sourceCaches[id].loaded())
                return false;

        if (!this.imageManager.isLoaded())
            return false;

        return true;
    }

    _serializeLayers(ids: Array<string>) {
        return ids.map((id) => this._layers[id].serialize());
    }

    _applyPaintPropertyUpdates(options: ?{transition?: boolean}) {
        if (!this._loaded) return;

        options = options || {transition: true};

        const transition = util.extend({
            duration: 300,
            delay: 0
        }, this.stylesheet.transition);

        const layers = this._updatedAllPaintProps ? this._layers : this._updatedPaintProps;

        for (const id in layers) {
            this._layers[id].updatePaintTransitions(options, transition);
        }

        this.light.updateTransitions(options, transition);
    }

    _recalculate(z: number) {
        if (!this._loaded) return;

        for (const sourceId in this.sourceCaches)
            this.sourceCaches[sourceId].used = false;

        const parameters = {
            zoom: z,
            now: Date.now(),
            defaultFadeDuration: 300,
            zoomHistory: this._updateZoomHistory(z)
        };

        for (const layerId of this._order) {
            const layer = this._layers[layerId];

            layer.recalculate(parameters);
            if (!layer.isHidden(z) && layer.source) {
                this.sourceCaches[layer.source].used = true;
            }
        }

        this.light.recalculate(parameters);
        this.z = z;
    }

    hasTransitions() {
        if (this.light && this.light.hasTransition()) {
            return true;
        }

        for (const id in this.sourceCaches) {
            if (this.sourceCaches[id].hasTransition()) {
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

    _updateZoomHistory(z: number) {

        const zh: ZoomHistory = (this.zoomHistory: any);

        if (zh.lastIntegerZoom === undefined) {
            // first time
            zh.lastIntegerZoom = Math.floor(z);
            zh.lastIntegerZoomTime = 0;
            zh.lastZoom = z;
        }

        // check whether an integer zoom level as passed since the last frame
        // and if yes, record it with the time. Used for transitioning patterns.
        if (Math.floor(zh.lastZoom) < Math.floor(z)) {
            zh.lastIntegerZoom = Math.floor(z);
            zh.lastIntegerZoomTime = Date.now();

        } else if (Math.floor(zh.lastZoom) > Math.floor(z)) {
            zh.lastIntegerZoom = Math.floor(z + 1);
            zh.lastIntegerZoomTime = Date.now();
        }

        zh.lastZoom = z;
        return zh;
    }

    _checkLoaded() {
        if (!this._loaded) {
            throw new Error('Style is not done loading');
        }
    }

    /**
     * Apply queued style updates in a batch
     */
    update(options: ?{transition?: boolean}) {
        if (!this._changed) return;

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

        this._applyPaintPropertyUpdates(options);
        this._resetUpdates();

        this.fire('data', {dataType: 'style'});
    }

    _updateWorkerLayers(updatedIds: Array<string>, removedIds: Array<string>) {
        this.dispatcher.broadcast('updateLayers', {
            layers: this._serializeLayers(updatedIds),
            removedIds: removedIds
        });
    }

    _resetUpdates() {
        this._changed = false;

        this._updatedLayers = {};
        this._removedLayers = {};

        this._updatedSources = {};

        this._updatedPaintProps = {};
        this._updatedAllPaintProps = false;
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

        if (validateStyle.emitErrors(this, validateStyle(nextState))) return false;

        nextState = util.clone(nextState);
        nextState.layers = deref(nextState.layers);

        const changes = diff(this.serialize(), nextState)
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
        if (this.imageManager.getImage(id)) {
            return this.fire('error', {error: new Error('An image with this name already exists.')});
        }
        this.imageManager.addImage(id, image);
        this.fire('data', {dataType: 'style'});
    }

    removeImage(id: string) {
        if (!this.imageManager.getImage(id)) {
            return this.fire('error', {error: new Error('No image with this name exists.')});
        }
        this.imageManager.removeImage(id);
        this.fire('data', {dataType: 'style'});
    }

    addSource(id: string, source: SourceSpecification, options?: {validate?: boolean}) {
        this._checkLoaded();

        if (this.sourceCaches[id] !== undefined) {
            throw new Error('There is already a source with this ID');
        }

        if (!source.type) {
            throw new Error(`The type property must be defined, but the only the following properties were given: ${Object.keys(source).join(', ')}.`);
        }

        const builtIns = ['vector', 'raster', 'geojson', 'video', 'image', 'canvas'];
        const shouldValidate = builtIns.indexOf(source.type) >= 0;
        if (shouldValidate && this._validate(validateStyle.source, `sources.${id}`, source, null, options)) return;

        const sourceCache = this.sourceCaches[id] = new SourceCache(id, source, this.dispatcher);
        sourceCache.style = this;
        sourceCache.setEventedParent(this, () => ({
            isSourceLoaded: this.loaded(),
            source: sourceCache.serialize(),
            sourceId: id
        }));

        sourceCache.onAdd(this.map);
        this._changed = true;
    }

    /**
     * Remove a source from this stylesheet, given its id.
     * @param {string} id id of the source to remove
     * @throws {Error} if no source is found with the given ID
     */
    removeSource(id: string) {
        this._checkLoaded();

        if (this.sourceCaches[id] === undefined) {
            throw new Error('There is no source with this ID');
        }
        for (const layerId in this._layers) {
            if (this._layers[layerId].source === id) {
                return this.fire('error', {error: new Error(`Source "${id}" cannot be removed while layer "${layerId}" is using it.`)});
            }
        }

        const sourceCache = this.sourceCaches[id];
        delete this.sourceCaches[id];
        delete this._updatedSources[id];
        sourceCache.fire('data', {sourceDataType: 'metadata', dataType:'source', sourceId: id});
        sourceCache.setEventedParent(null);
        sourceCache.clearTiles();

        if (sourceCache.onRemove) sourceCache.onRemove(this.map);
        this._changed = true;
    }

    /**
    * Set the data of a GeoJSON source, given its id.
    * @param {string} id id of the source
    * @param {GeoJSON|string} data GeoJSON source
    */
    setGeoJSONSourceData(id: string, data: GeoJSON | string) {
        this._checkLoaded();

        assert(this.sourceCaches[id] !== undefined, 'There is no source with this ID');
        const geojsonSource: GeoJSONSource = (this.sourceCaches[id].getSource(): any);
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
        return this.sourceCaches[id] && this.sourceCaches[id].getSource();
    }

    /**
     * Add a layer to the map style. The layer will be inserted before the layer with
     * ID `before`, or appended if `before` is omitted.
     * @param {string=} before  ID of an existing layer to insert before
     */
    addLayer(layerObject: LayerSpecification, before?: string, options?: {validate?: boolean}) {
        this._checkLoaded();

        const id = layerObject.id;

        if (typeof layerObject.source === 'object') {
            this.addSource(id, layerObject.source);
            layerObject = util.clone(layerObject);
            layerObject = (util.extend(layerObject, {source: id}): any);
        }

        // this layer is not in the style.layers array, so we pass an impossible array index
        if (this._validate(validateStyle.layer,
            `layers.${id}`, layerObject, {arrayIndex: -1}, options)) return;

        const layer = StyleLayer.create(layerObject);
        this._validateLayer(layer);

        layer.setEventedParent(this, {layer: {id: id}});


        const index = before ? this._order.indexOf(before) : this._order.length;
        if (before && index === -1) {
            this.fire('error', { message: new Error(`Layer with id "${before}" does not exist on this map.`)});
            return;
        }

        this._order.splice(index, 0, id);
        this._layerOrderChanged = true;

        this._layers[id] = layer;

        if (this._removedLayers[id] && layer.source) {
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
                this.sourceCaches[layer.source].pause();
            }
        }
        this._updateLayer(layer);
        this.updatePaintProperties(id);
    }

    /**
     * Add a layer to the map style. The layer will be inserted before the layer with
     * ID `before`, or appended if `before` is omitted.
     * @param {string=} before  ID of an existing layer to insert before
     */
    moveLayer(id: string, before?: string) {
        this._checkLoaded();
        this._changed = true;

        const layer = this._layers[id];
        if (!layer) {
            this.fire('error', {
                error: new Error(
                    `The layer '${id}' does not exist in ` +
                    `the map's style and cannot be moved.`
                )
            });
            return;
        }

        const index = this._order.indexOf(id);
        this._order.splice(index, 1);

        const newIndex = before ? this._order.indexOf(before) : this._order.length;
        this._order.splice(newIndex, 0, id);

        this._layerOrderChanged = true;
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
            this.fire('error', {
                error: new Error(
                    `The layer '${id}' does not exist in ` +
                    `the map's style and cannot be removed.`
                )
            });
            return;
        }

        layer.setEventedParent(null);

        const index = this._order.indexOf(id);
        this._order.splice(index, 1);

        this._layerOrderChanged = true;
        this._changed = true;
        this._removedLayers[id] = layer;
        delete this._layers[id];
        delete this._updatedLayers[id];
        delete this._updatedPaintProps[id];
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

    setLayerZoomRange(layerId: string, minzoom: ?number, maxzoom: ?number) {
        this._checkLoaded();

        const layer = this.getLayer(layerId);
        if (!layer) {
            this.fire('error', {
                error: new Error(
                    `The layer '${layerId}' does not exist in ` +
                    `the map's style and cannot have zoom extent.`
                )
            });
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

    setFilter(layerId: string, filter: ?FilterSpecification) {
        this._checkLoaded();

        const layer = this.getLayer(layerId);
        if (!layer) {
            this.fire('error', {
                error: new Error(
                    `The layer '${layerId}' does not exist in ` +
                    `the map's style and cannot be filtered.`
                )
            });
            return;
        }

        if (util.deepEqual(layer.filter, filter)) {
            return;
        }

        if (filter === null || filter === undefined) {
            layer.filter = undefined;
            this._updateLayer(layer);
            return;
        }

        if (this._validate(validateStyle.filter, `layers.${layer.id}.filter`, filter)) {
            return;
        }

        layer.filter = util.clone(filter);
        this._updateLayer(layer);
    }

    /**
     * Get a layer's filter object
     * @param {string} layer the layer to inspect
     * @returns {*} the layer's filter, if any
     */
    getFilter(layer: string) {
        return util.clone(this.getLayer(layer).filter);
    }

    setLayoutProperty(layerId: string, name: string, value: any) {
        this._checkLoaded();

        const layer = this.getLayer(layerId);
        if (!layer) {
            this.fire('error', {
                error: new Error(
                    `The layer '${layerId}' does not exist in ` +
                    `the map's style and cannot be styled.`
                )
            });
            return;
        }

        if (util.deepEqual(layer.getLayoutProperty(name), value)) return;

        layer.setLayoutProperty(name, value);
        this._updateLayer(layer);
    }

    /**
     * Get a layout property's value from a given layer
     * @param {string} layer the layer to inspect
     * @param {string} name the name of the layout property
     * @returns {*} the property value
     */
    getLayoutProperty(layer: string, name: string) {
        return this.getLayer(layer).getLayoutProperty(name);
    }

    setPaintProperty(layerId: string, name: string, value: any) {
        this._checkLoaded();

        const layer = this.getLayer(layerId);
        if (!layer) {
            this.fire('error', {
                error: new Error(
                    `The layer '${layerId}' does not exist in ` +
                    `the map's style and cannot be styled.`
                )
            });
            return;
        }

        if (util.deepEqual(layer.getPaintProperty(name), value)) return;

        const wasDataDriven = layer._transitionablePaint._values[name].value.isDataDriven();
        layer.setPaintProperty(name, value);
        const isDataDriven = layer._transitionablePaint._values[name].value.isDataDriven();

        if (isDataDriven || wasDataDriven) {
            this._updateLayer(layer);
        }

        this.updatePaintProperties(layerId, name);
    }

    getPaintProperty(layer: string, name: string) {
        return this.getLayer(layer).getPaintProperty(name);
    }

    getTransition() {
        return util.extend({ duration: 300, delay: 0 },
            this.stylesheet && this.stylesheet.transition);
    }

    updatePaintProperties(layerId?: string, paintName?: string) {
        this._changed = true;
        if (!layerId) {
            this._updatedAllPaintProps = true;
        } else {
            const props = this._updatedPaintProps;
            if (!props[layerId]) props[layerId] = {};
            props[layerId][paintName || 'all'] = true;
        }
    }

    serialize() {
        return util.filterObject({
            version: this.stylesheet.version,
            name: this.stylesheet.name,
            metadata: this.stylesheet.metadata,
            light: this.stylesheet.light,
            center: this.stylesheet.center,
            zoom: this.stylesheet.zoom,
            bearing: this.stylesheet.bearing,
            pitch: this.stylesheet.pitch,
            sprite: this.stylesheet.sprite,
            glyphs: this.stylesheet.glyphs,
            transition: this.stylesheet.transition,
            sources: util.mapObject(this.sourceCaches, (source) => source.serialize()),
            layers: this._order.map((id) => this._layers[id].serialize())
        }, (value) => { return value !== undefined; });
    }

    _updateLayer(layer: StyleLayer) {
        this._updatedLayers[layer.id] = true;
        if (layer.source && !this._updatedSources[layer.source]) {
            this._updatedSources[layer.source] = 'reload';
            this.sourceCaches[layer.source].pause();
        }
        this._changed = true;
    }

    _flattenRenderedFeatures(sourceResults: Array<any>) {
        const features = [];
        for (let l = this._order.length - 1; l >= 0; l--) {
            const layerId = this._order[l];
            for (const sourceResult of sourceResults) {
                const layerFeatures = sourceResult[layerId];
                if (layerFeatures) {
                    for (const feature of layerFeatures) {
                        features.push(feature);
                    }
                }
            }
        }
        return features;
    }

    queryRenderedFeatures(queryGeometry: any, params: any, zoom: number, bearing: number) {
        if (params && params.filter) {
            this._validate(validateStyle.filter, 'queryRenderedFeatures.filter', params.filter);
        }

        const includedSources = {};
        if (params && params.layers) {
            if (!Array.isArray(params.layers)) {
                this.fire('error', {error: 'parameters.layers must be an Array.'});
                return [];
            }
            for (const layerId of params.layers) {
                const layer = this._layers[layerId];
                if (!layer) {
                    // this layer is not in the style.layers array
                    this.fire('error', {error: `The layer '${layerId}' does not exist ` +
                        `in the map's style and cannot be queried for features.`});
                    return [];
                }
                includedSources[layer.source] = true;
            }
        }

        const sourceResults = [];
        for (const id in this.sourceCaches) {
            if (params.layers && !includedSources[id]) continue;
            const results = QueryFeatures.rendered(this.sourceCaches[id], this._layers, queryGeometry, params, zoom, bearing);
            sourceResults.push(results);
        }
        return this._flattenRenderedFeatures(sourceResults);
    }

    querySourceFeatures(sourceID: string, params: ?{sourceLayer: ?string, filter: ?Array<any>}) {
        if (params && params.filter) {
            this._validate(validateStyle.filter, 'querySourceFeatures.filter', params.filter);
        }
        const sourceCache = this.sourceCaches[sourceID];
        return sourceCache ? QueryFeatures.source(sourceCache, params) : [];
    }

    addSourceType(name: string, SourceType: Class<Source>, callback: Callback<void>) {
        if (getSourceType(name)) {
            return callback(new Error(`A source type called "${name}" already exists.`));
        }

        setSourceType(name, SourceType);

        if (!SourceType.workerSourceURL) {
            return callback(null, null);
        }

        this.dispatcher.broadcast('loadWorkerSource', {
            name: name,
            url: SourceType.workerSourceURL
        }, callback);
    }

    getLight() {
        return this.light.getLight();
    }

    setLight(lightOptions: LightSpecification, options: ?{transition?: boolean}) {
        this._checkLoaded();

        const light = this.light.getLight();
        let _update = false;
        for (const key in lightOptions) {
            if (!util.deepEqual(lightOptions[key], light[key])) {
                _update = true;
                break;
            }
        }
        if (!_update) return;

        options = options || {transition: true};

        const transition = util.extend({
            duration: 300,
            delay: 0
        }, this.stylesheet.transition);

        this.light.setLight(lightOptions);
        this.light.updateTransitions(options, transition);
    }

    _validate(validate: ({}) => void, key: string, value: any, props: any, options?: {validate?: boolean}) {
        if (options && options.validate === false) {
            return false;
        }
        return validateStyle.emitErrors(this, validate.call(validateStyle, util.extend({
            key: key,
            style: this.serialize(),
            value: value,
            styleSpec: styleSpec
        }, props)));
    }

    _remove() {
        rtlTextPlugin.evented.off('pluginAvailable', this._rtlTextPluginCallback);
        for (const id in this.sourceCaches) {
            this.sourceCaches[id].clearTiles();
        }
        this.dispatcher.remove();
    }

    _clearSource(id: string) {
        this.sourceCaches[id].clearTiles();
    }

    _reloadSource(id: string) {
        this.sourceCaches[id].resume();
        this.sourceCaches[id].reload();
    }

    _updateSources(transform: Transform) {
        for (const id in this.sourceCaches) {
            this.sourceCaches[id].update(transform);
        }
    }

    getNeedsFullPlacement() {
        // Anything that changes our "in progress" layer and tile indices requires us
        // to start over. When we start over, we do a full placement instead of incremental
        // to prevent starvation.
        if (this._layerOrderChanged) {
            // We need to restart placement to keep layer indices in sync.
            return true;
        }
        for (const id in this.sourceCaches) {
            if (this.sourceCaches[id].getNeedsFullPlacement()) {
                // A tile has been added or removed, we need to do a full placement
                // New tiles can't be rendered until they've finished their first placement
                return true;
            }
        }
        return false;
    }

    _generateCollisionBoxes() {
        for (const id in this.sourceCaches) {
            this._reloadSource(id);
        }
    }

    _updatePlacement(transform: Transform, showCollisionBoxes: boolean, fadeDuration: number) {
        const forceFullPlacement = this.getNeedsFullPlacement();

        if (forceFullPlacement || !this.placement || this.placement.isDone()) {
            this.placement = new Placement(transform, this._order, forceFullPlacement, showCollisionBoxes, fadeDuration, this.placement);
            this._layerOrderChanged = false;
        }

        this.placement.continuePlacement(this._order, this._layers, this.sourceCaches);

        if (this.placement.isDone()) this.collisionIndex = this.placement.collisionIndex;

        // needsRender is false when we have just finished a placement that didn't change the visibility of any symbols
        const needsRerender = !this.placement.isDone() || this.placement.stillFading();
        return needsRerender;
    }

    // Callbacks from web workers

    getImages(mapId: string, params: {icons: Array<string>}, callback: Callback<{[string]: StyleImage}>) {
        this.imageManager.getImages(params.icons, callback);
    }

    getGlyphs(mapId: string, params: {stacks: {[string]: Array<number>}}, callback: Callback<{[string]: {[number]: ?StyleGlyph}}>) {
        this.glyphManager.getGlyphs(params.stacks, callback);
    }
}

module.exports = Style;
