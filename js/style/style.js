'use strict';

const assert = require('assert');
const Evented = require('../util/evented');
const StyleLayer = require('./style_layer');
const ImageSprite = require('./image_sprite');
const Light = require('./light');
const GlyphSource = require('../symbol/glyph_source');
const SpriteAtlas = require('../symbol/sprite_atlas');
const LineAtlas = require('../render/line_atlas');
const util = require('../util/util');
const ajax = require('../util/ajax');
const mapbox = require('../util/mapbox');
const browser = require('../util/browser');
const Dispatcher = require('../util/dispatcher');
const AnimationLoop = require('./animation_loop');
const validateStyle = require('./validate_style');
const Source = require('../source/source');
const QueryFeatures = require('../source/query_features');
const SourceCache = require('../source/source_cache');
const styleSpec = require('./style_spec');
const MapboxGLFunction = require('mapbox-gl-function');
const getWorkerPool = require('../global_worker_pool');
const deref = require('mapbox-gl-style-spec/lib/deref');

/**
 * @private
 */
class Style extends Evented {

    constructor(stylesheet, map, options) {
        super();
        this.map = map;
        this.animationLoop = (map && map.animationLoop) || new AnimationLoop();
        this.dispatcher = new Dispatcher(getWorkerPool(), this);
        this.spriteAtlas = new SpriteAtlas(1024, 1024);
        this.lineAtlas = new LineAtlas(256, 512);

        this._layers = {};
        this._order  = [];
        this.sourceCaches = {};
        this.zoomHistory = {};
        this._loaded = false;

        util.bindAll(['_redoPlacement'], this);

        this._resetUpdates();

        options = util.extend({
            validate: typeof stylesheet === 'string' ? !mapbox.isMapboxURL(stylesheet) : true
        }, options);

        this.setEventedParent(map);
        this.fire('dataloading', {dataType: 'style'});

        const stylesheetLoaded = (err, stylesheet) => {
            if (err) {
                this.fire('error', {error: err});
                return;
            }

            if (options.validate && validateStyle.emitErrors(this, validateStyle(stylesheet))) return;

            this._loaded = true;
            this.stylesheet = stylesheet;

            this.updateClasses();

            for (const id in stylesheet.sources) {
                this.addSource(id, stylesheet.sources[id], options);
            }

            if (stylesheet.sprite) {
                this.sprite = new ImageSprite(stylesheet.sprite);
                this.sprite.setEventedParent(this);
            }

            this.glyphSource = new GlyphSource(stylesheet.glyphs);
            this._resolve();
            this.fire('data', {dataType: 'style'});
            this.fire('style.load');
        };

        if (typeof stylesheet === 'string') {
            ajax.getJSON(mapbox.normalizeStyleURL(stylesheet), stylesheetLoaded);
        } else {
            browser.frame(stylesheetLoaded.bind(this, null, stylesheet));
        }

        this.on('source.load', (event) => {
            const source = event.source;
            if (source && source.vectorLayerIds) {
                for (const layerId in this._layers) {
                    const layer = this._layers[layerId];
                    if (layer.source === source.id) {
                        this._validateLayer(layer);
                    }
                }
            }
        });
    }

    _validateLayer(layer) {
        const sourceCache = this.sourceCaches[layer.source];

        if (!layer.sourceLayer) return;
        if (!sourceCache) return;
        const source = sourceCache.getSource();
        if (!source.vectorLayerIds) return;

        if (source.vectorLayerIds.indexOf(layer.sourceLayer) === -1) {
            this.fire('error', {
                error: new Error(
                    `Source layer "${layer.sourceLayer}" ` +
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

        if (this.sprite && !this.sprite.loaded())
            return false;

        return true;
    }

    _resolve() {
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
    }

    _serializeLayers(ids) {
        return ids.map((id) => this._layers[id].serialize());
    }

    _applyClasses(classes, options) {
        if (!this._loaded) return;

        classes = classes || [];
        options = options || {transition: true};
        const transition = this.stylesheet.transition || {};

        const layers = this._updatedAllPaintProps ? this._layers : this._updatedPaintProps;

        for (const id in layers) {
            const layer = this._layers[id];
            const props = this._updatedPaintProps[id];

            if (this._updatedAllPaintProps || props.all) {
                layer.updatePaintTransitions(classes, options, transition, this.animationLoop, this.zoomHistory);
            } else {
                for (const paintName in props) {
                    this._layers[id].updatePaintTransition(paintName, classes, options, transition, this.animationLoop, this.zoomHistory);
                }
            }
        }

        this.light.updateLightTransitions(options, transition, this.animationLoop);
    }

    _recalculate(z) {
        if (!this._loaded) return;

        for (const sourceId in this.sourceCaches)
            this.sourceCaches[sourceId].used = false;

        this._updateZoomHistory(z);

        for (const layerId of this._order) {
            const layer = this._layers[layerId];

            layer.recalculate(z);
            if (!layer.isHidden(z) && layer.source) {
                this.sourceCaches[layer.source].used = true;
            }
        }

        this.light.recalculate(z);

        const maxZoomTransitionDuration = 300;
        if (Math.floor(this.z) !== Math.floor(z)) {
            this.animationLoop.set(maxZoomTransitionDuration);
        }

        this.z = z;
    }

    _updateZoomHistory(z) {

        const zh = this.zoomHistory;

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
    }

    _checkLoaded () {
        if (!this._loaded) {
            throw new Error('Style is not done loading');
        }
    }

    /**
     * Apply queued style updates in a batch
     */
    update(classes, options) {
        if (!this._changed) return;

        const updatedIds = Object.keys(this._updatedLayers);
        const removedIds = Object.keys(this._removedLayers);

        if (updatedIds.length || removedIds.length || this._updatedSymbolOrder) {
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

        this._applyClasses(classes, options);
        this._resetUpdates();

        this.fire('data', {dataType: 'style'});
    }

    _updateWorkerLayers(updatedIds, removedIds) {
        const symbolOrder = this._updatedSymbolOrder ? this._order.filter((id) => this._layers[id].type === 'symbol') : null;

        this.dispatcher.broadcast('updateLayers', {
            layers: this._serializeLayers(updatedIds),
            removedIds: removedIds,
            symbolOrder: symbolOrder
        });
    }

    _resetUpdates() {
        this._changed = false;

        this._updatedLayers = {};
        this._removedLayers = {};
        this._updatedSymbolOrder = false;

        this._updatedSources = {};

        this._updatedPaintProps = {};
        this._updatedAllPaintProps = false;
    }

    addSource(id, source, options) {
        this._checkLoaded();

        if (this.sourceCaches[id] !== undefined) {
            throw new Error('There is already a source with this ID');
        }

        if (!source.type) {
            throw new Error(`The type property must be defined, but the only the following properties were given: ${Object.keys(source)}.`);
        }

        const builtIns = ['vector', 'raster', 'geojson', 'video', 'image'];
        const shouldValidate = builtIns.indexOf(source.type) >= 0;
        if (shouldValidate && this._validate(validateStyle.source, `sources.${id}`, source, null, options)) return;

        const sourceCache = this.sourceCaches[id] = new SourceCache(id, source, this.dispatcher);
        sourceCache.style = this;
        sourceCache.setEventedParent(this, {source: sourceCache.getSource()});

        if (sourceCache.onAdd) sourceCache.onAdd(this.map);
        this._changed = true;
    }

    /**
     * Remove a source from this stylesheet, given its id.
     * @param {string} id id of the source to remove
     * @throws {Error} if no source is found with the given ID
     */
    removeSource(id) {
        this._checkLoaded();

        if (this.sourceCaches[id] === undefined) {
            throw new Error('There is no source with this ID');
        }
        const sourceCache = this.sourceCaches[id];
        delete this.sourceCaches[id];
        delete this._updatedSources[id];
        sourceCache.setEventedParent(null);
        sourceCache.clearTiles();

        if (sourceCache.onRemove) sourceCache.onRemove(this.map);
        this._changed = true;
    }

    /**
     * Get a source by id.
     * @param {string} id id of the desired source
     * @returns {Object} source
     */
    getSource(id) {
        return this.sourceCaches[id] && this.sourceCaches[id].getSource();
    }

    /**
     * Add a layer to the map style. The layer will be inserted before the layer with
     * ID `before`, or appended if `before` is omitted.
     * @param {StyleLayer|Object} layer
     * @param {string=} before  ID of an existing layer to insert before
     */
    addLayer(layerObject, before, options) {
        this._checkLoaded();

        const id = layerObject.id;

        // this layer is not in the style.layers array, so we pass an impossible array index
        if (this._validate(validateStyle.layer,
                `layers.${id}`, layerObject, {arrayIndex: -1}, options)) return;

        const layer = StyleLayer.create(layerObject);
        this._validateLayer(layer);

        layer.setEventedParent(this, {layer: {id: id}});

        const index = before ? this._order.indexOf(before) : this._order.length;
        this._order.splice(index, 0, id);

        this._layers[id] = layer;

        if (this._removedLayers[id]) {
            // If, in the current batch, we have already removed this layer
            // and we are now re-adding it, then we need to clear (rather
            // than just reload) the underyling source's tiles.
            // Otherwise, tiles marked 'reloading' will have buffers that are
            // set up for the _previous_ version of this layer, confusing
            // https://github.com/mapbox/mapbox-gl-js/issues/3633
            delete this._removedLayers[id];
            this._updatedSources[layer.source] = 'clear';
        }
        this._updateLayer(layer);

        if (layer.type === 'symbol') {
            this._updatedSymbolOrder = true;
        }

        this.updateClasses(id);
    }

    /**
     * Add a layer to the map style. The layer will be inserted before the layer with
     * ID `before`, or appended if `before` is omitted.
     * @param {StyleLayer|Object} layer
     * @param {string=} before  ID of an existing layer to insert before
     */
    moveLayer(id, before) {
        this._checkLoaded();
        this._changed = true;

        const layer = this._layers[id];
        if (!layer) throw new Error(`Layer not found: ${id}`);

        const index = this._order.indexOf(id);
        this._order.splice(index, 1);

        const newIndex = before ? this._order.indexOf(before) : this._order.length;
        this._order.splice(newIndex, 0, id);

        if (layer.type === 'symbol') {
            this._updatedSymbolOrder = true;
            if (layer.source && !this._updatedSources[layer.source]) {
                this._updatedSources[layer.source] = 'reload';
            }
        }
    }

    /**
     * Remove a layer from this stylesheet, given its id.
     * @param {string} id id of the layer to remove
     * @throws {Error} if no layer is found with the given ID
     */
    removeLayer(id) {
        this._checkLoaded();

        const layer = this._layers[id];
        if (!layer) throw new Error(`Layer not found: ${id}`);

        layer.setEventedParent(null);

        const index = this._order.indexOf(id);
        this._order.splice(index, 1);

        if (layer.type === 'symbol') {
            this._updatedSymbolOrder = true;
        }

        this._changed = true;
        this._removedLayers[id] = true;
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
    getLayer(id) {
        return this._layers[id];
    }

    setLayerZoomRange(layerId, minzoom, maxzoom) {
        this._checkLoaded();

        const layer = this.getLayer(layerId);

        if (layer.minzoom === minzoom && layer.maxzoom === maxzoom) return;

        if (minzoom != null) {
            layer.minzoom = minzoom;
        }
        if (maxzoom != null) {
            layer.maxzoom = maxzoom;
        }
        this._updateLayer(layer);
    }

    setFilter(layerId, filter) {
        this._checkLoaded();

        const layer = this.getLayer(layerId);

        if (filter !== null && this._validate(validateStyle.filter, `layers.${layer.id}.filter`, filter)) return;

        if (util.deepEqual(layer.filter, filter)) return;
        layer.filter = util.clone(filter);

        this._updateLayer(layer);
    }

    /**
     * Get a layer's filter object
     * @param {string} layer the layer to inspect
     * @returns {*} the layer's filter, if any
     */
    getFilter(layer) {
        return util.clone(this.getLayer(layer).filter);
    }

    setLayoutProperty(layerId, name, value) {
        this._checkLoaded();

        const layer = this.getLayer(layerId);

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
    getLayoutProperty(layer, name) {
        return this.getLayer(layer).getLayoutProperty(name);
    }

    setPaintProperty(layerId, name, value, klass) {
        this._checkLoaded();

        const layer = this.getLayer(layerId);

        if (util.deepEqual(layer.getPaintProperty(name, klass), value)) return;

        const wasFeatureConstant = layer.isPaintValueFeatureConstant(name);
        layer.setPaintProperty(name, value, klass);

        const isFeatureConstant = !(
            value &&
            MapboxGLFunction.isFunctionDefinition(value) &&
            value.property !== '$zoom' &&
            value.property !== undefined
        );

        if (!isFeatureConstant || !wasFeatureConstant) {
            this._updateLayer(layer);
        }

        this.updateClasses(layerId, name);
    }

    getPaintProperty(layer, name, klass) {
        return this.getLayer(layer).getPaintProperty(name, klass);
    }

    getTransition() {
        return util.extend({ duration: 300, delay: 0 },
            this.stylesheet && this.stylesheet.transition);
    }

    updateClasses(layerId, paintName) {
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

    _updateLayer(layer) {
        this._updatedLayers[layer.id] = true;
        if (layer.source && !this._updatedSources[layer.source]) {
            this._updatedSources[layer.source] = 'reload';
        }
        this._changed = true;
    }

    _flattenRenderedFeatures(sourceResults) {
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

    queryRenderedFeatures(queryGeometry, params, zoom, bearing) {
        if (params && params.filter) {
            this._validate(validateStyle.filter, 'queryRenderedFeatures.filter', params.filter);
        }

        const includedSources = {};
        if (params && params.layers) {
            for (const layerId of params.layers) {
                const layer = this._layers[layerId];
                if (!layer) {
                    // this layer is not in the style.layers array
                    this.fire('error', {error: `The layer '${layerId
                        }' does not exist in the map's style and cannot be queried for features.`});
                    return;
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

    querySourceFeatures(sourceID, params) {
        if (params && params.filter) {
            this._validate(validateStyle.filter, 'querySourceFeatures.filter', params.filter);
        }
        const sourceCache = this.sourceCaches[sourceID];
        return sourceCache ? QueryFeatures.source(sourceCache, params) : [];
    }

    addSourceType(name, SourceType, callback) {
        if (Source.getType(name)) {
            return callback(new Error(`A source type called "${name}" already exists.`));
        }

        Source.setType(name, SourceType);

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

    setLight(lightOptions, transitionOptions) {
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

        const transition = this.stylesheet.transition || {};

        this.light.setLight(lightOptions);
        this.light.updateLightTransitions(transitionOptions || {transition: true}, transition, this.animationLoop);
    }

    _validate(validate, key, value, props, options) {
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
        for (const id in this.sourceCaches) {
            this.sourceCaches[id].clearTiles();
        }
        this.dispatcher.remove();
    }

    _clearSource(id) {
        this.sourceCaches[id].clearTiles();
    }

    _reloadSource(id) {
        this.sourceCaches[id].reload();
    }

    _updateSources(transform) {
        for (const id in this.sourceCaches) {
            this.sourceCaches[id].update(transform);
        }
    }

    _redoPlacement() {
        for (const id in this.sourceCaches) {
            this.sourceCaches[id].redoPlacement();
        }
    }

    // Callbacks from web workers

    getIcons(mapId, params, callback) {
        const updateSpriteAtlas = () => {
            this.spriteAtlas.setSprite(this.sprite);
            this.spriteAtlas.addIcons(params.icons, callback);
        };
        if (this.sprite.loaded()) {
            updateSpriteAtlas();
        } else {
            this.sprite.on('data', updateSpriteAtlas);
        }
    }

    getGlyphs(mapId, params, callback) {
        const stacks = params.stacks;
        let remaining = Object.keys(stacks).length;
        const allGlyphs = {};

        for (const fontName in stacks) {
            this.glyphSource.getSimpleGlyphs(fontName, stacks[fontName], params.uid, done);
        }

        function done(err, glyphs, fontName) {
            if (err) console.error(err);

            allGlyphs[fontName] = glyphs;
            remaining--;

            if (remaining === 0)
                callback(null, allGlyphs);
        }
    }
}

module.exports = Style;
