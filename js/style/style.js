'use strict';

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
        this._groups = [];
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

        if (Object.keys(this._updates.sources).length)
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

        this._order = layers.map((layer) => {
            return layer.id;
        });

        this._layers = {};
        for (let layer of layers) {
            layer = StyleLayer.create(layer);
            this._layers[layer.id] = layer;
            layer.setEventedParent(this, {layer: {id: layer.id}});
        }

        this._groupLayers();
        this._updateWorkerLayers();

        this.light = new Light(this.stylesheet.light);
    }

    _groupLayers() {
        let group;

        this._groups = [];

        // Split into groups of consecutive top-level layers with the same source.
        for (let i = 0; i < this._order.length; ++i) {
            const layer = this._layers[this._order[i]];

            if (!group || layer.source !== group.source) {
                group = [];
                group.source = layer.source;
                this._groups.push(group);
            }

            group.push(layer);
        }
    }

    _updateWorkerLayers(ids) {
        this.dispatcher.broadcast(ids ? 'updateLayers' : 'setLayers', this._serializeLayers(ids));
    }

    _serializeLayers(ids) {
        ids = ids || this._order;
        const serialized = [];
        for (let i = 0; i < ids.length; i++) {
            serialized.push(this._layers[ids[i]].serialize());
        }
        return serialized;
    }

    _applyClasses(classes, options) {
        if (!this._loaded) return;

        classes = classes || [];
        options = options || {transition: true};
        const transition = this.stylesheet.transition || {};

        const layers = this._updates.allPaintProps ? this._layers : this._updates.paintProps;

        for (const id in layers) {
            const layer = this._layers[id];
            const props = this._updates.paintProps[id];

            if (this._updates.allPaintProps || props.all) {
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
     * @private
     */
    update(classes, options) {
        if (!this._updates.changed) return this;

        if (this._updates.allLayers) {
            this._groupLayers();
            this._updateWorkerLayers();
        } else {
            const updatedIds = Object.keys(this._updates.layers);
            if (updatedIds.length) {
                this._updateWorkerLayers(updatedIds);
            }
        }

        const updatedSourceIds = Object.keys(this._updates.sources);
        let i;
        for (i = 0; i < updatedSourceIds.length; i++) {
            this._reloadSource(updatedSourceIds[i]);
        }

        for (i = 0; i < this._updates.events.length; i++) {
            const args = this._updates.events[i];
            this.fire(args[0], args[1]);
        }

        this._applyClasses(classes, options);

        if (this._updates.changed) {
            this.fire('data', {dataType: 'style'});
        }

        this._resetUpdates();

        return this;
    }

    _resetUpdates() {
        this._updates = {
            events: [],
            layers: {},
            sources: {},
            paintProps: {}
        };
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
        if (shouldValidate && this._validate(validateStyle.source, `sources.${id}`, source, null, options)) return this;

        source = new SourceCache(id, source, this.dispatcher);
        this.sourceCaches[id] = source;
        source.style = this;
        source.setEventedParent(this, {source: source.getSource()});

        if (source.onAdd) source.onAdd(this.map);
        this._updates.changed = true;

        return this;
    }

    /**
     * Remove a source from this stylesheet, given its id.
     * @param {string} id id of the source to remove
     * @returns {Style} this style
     * @throws {Error} if no source is found with the given ID
     * @private
     */
    removeSource(id) {
        this._checkLoaded();

        if (this.sourceCaches[id] === undefined) {
            throw new Error('There is no source with this ID');
        }
        const sourceCache = this.sourceCaches[id];
        delete this.sourceCaches[id];
        delete this._updates.sources[id];
        sourceCache.setEventedParent(null);
        sourceCache.clearTiles();

        if (sourceCache.onRemove) sourceCache.onRemove(this.map);
        this._updates.changed = true;

        return this;
    }

    /**
     * Get a source by id.
     * @param {string} id id of the desired source
     * @returns {Object} source
     * @private
     */
    getSource(id) {
        return this.sourceCaches[id] && this.sourceCaches[id].getSource();
    }

    /**
     * Add a layer to the map style. The layer will be inserted before the layer with
     * ID `before`, or appended if `before` is omitted.
     * @param {StyleLayer|Object} layer
     * @param {string=} before  ID of an existing layer to insert before
     * @returns {Style} `this`
     * @private
     */
    addLayer(layer, before, options) {
        this._checkLoaded();

        if (!(layer instanceof StyleLayer)) {
            // this layer is not in the style.layers array, so we pass an impossible array index
            if (this._validate(validateStyle.layer,
                    `layers.${layer.id}`, layer, {arrayIndex: -1}, options)) return this;

            layer = StyleLayer.create(layer);
        }
        this._validateLayer(layer);

        layer.setEventedParent(this, {layer: {id: layer.id}});

        this._layers[layer.id] = layer;
        this._order.splice(before ? this._order.indexOf(before) : Infinity, 0, layer.id);

        this._updates.allLayers = true;
        if (layer.source) {
            this._updates.sources[layer.source] = true;
        }

        return this.updateClasses(layer.id);
    }

    /**
     * Remove a layer from this stylesheet, given its id.
     * @param {string} id id of the layer to remove
     * @returns {Style} this style
     * @throws {Error} if no layer is found with the given ID
     * @private
     */
    removeLayer(id) {
        this._checkLoaded();

        const layer = this._layers[id];
        if (layer === undefined) {
            throw new Error('There is no layer with this ID');
        }

        layer.setEventedParent(null);

        delete this._layers[id];
        delete this._updates.layers[id];
        delete this._updates.paintProps[id];
        this._order.splice(this._order.indexOf(id), 1);

        this._updates.allLayers = true;
        this._updates.changed = true;

        return this;
    }

    /**
     * Return the style layer object with the given `id`.
     *
     * @param {string} id - id of the desired layer
     * @returns {?Object} a layer, if one with the given `id` exists
     * @private
     */
    getLayer(id) {
        return this._layers[id];
    }

    setLayerZoomRange(layerId, minzoom, maxzoom) {
        this._checkLoaded();

        const layer = this.getLayer(layerId);

        if (layer.minzoom === minzoom && layer.maxzoom === maxzoom) return this;

        if (minzoom != null) {
            layer.minzoom = minzoom;
        }
        if (maxzoom != null) {
            layer.maxzoom = maxzoom;
        }
        return this._updateLayer(layer);
    }

    setFilter(layerId, filter) {
        this._checkLoaded();

        const layer = this.getLayer(layerId);

        if (filter !== null && this._validate(validateStyle.filter, `layers.${layer.id}.filter`, filter)) return this;

        if (util.deepEqual(layer.filter, filter)) return this;
        layer.filter = util.clone(filter);

        return this._updateLayer(layer);
    }

    /**
     * Get a layer's filter object
     * @param {string} layer the layer to inspect
     * @returns {*} the layer's filter, if any
     * @private
     */
    getFilter(layer) {
        return util.clone(this.getLayer(layer).filter);
    }

    setLayoutProperty(layerId, name, value) {
        this._checkLoaded();

        const layer = this.getLayer(layerId);

        if (util.deepEqual(layer.getLayoutProperty(name), value)) return this;

        layer.setLayoutProperty(name, value);
        return this._updateLayer(layer);
    }

    /**
     * Get a layout property's value from a given layer
     * @param {string} layer the layer to inspect
     * @param {string} name the name of the layout property
     * @returns {*} the property value
     * @private
     */
    getLayoutProperty(layer, name) {
        return this.getLayer(layer).getLayoutProperty(name);
    }

    setPaintProperty(layerId, name, value, klass) {
        this._checkLoaded();

        const layer = this.getLayer(layerId);

        if (util.deepEqual(layer.getPaintProperty(name, klass), value)) return this;

        const wasFeatureConstant = layer.isPaintValueFeatureConstant(name);
        layer.setPaintProperty(name, value, klass);

        const isFeatureConstant = !(
            value &&
            MapboxGLFunction.isFunctionDefinition(value) &&
            value.property !== '$zoom' &&
            value.property !== undefined
        );

        if (!isFeatureConstant || !wasFeatureConstant) {
            this._updates.layers[layerId] = true;
            if (layer.source) {
                this._updates.sources[layer.source] = true;
            }
        }

        return this.updateClasses(layerId, name);
    }

    getPaintProperty(layer, name, klass) {
        return this.getLayer(layer).getPaintProperty(name, klass);
    }

    updateClasses (layerId, paintName) {
        this._updates.changed = true;
        if (!layerId) {
            this._updates.allPaintProps = true;
        } else {
            const props = this._updates.paintProps;
            if (!props[layerId]) props[layerId] = {};
            props[layerId][paintName || 'all'] = true;
        }
        return this;
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
            layers: this._order.map((id) => this._layers[id].serialize(), this)
        }, (value) => { return value !== undefined; });
    }

    _updateLayer (layer) {
        this._updates.layers[layer.id] = true;
        if (layer.source) {
            this._updates.sources[layer.source] = true;
        }
        this._updates.changed = true;
        return this;
    }

    _flattenRenderedFeatures(sourceResults) {
        const features = [];
        for (let l = this._order.length - 1; l >= 0; l--) {
            const layerID = this._order[l];
            for (let s = 0; s < sourceResults.length; s++) {
                const layerFeatures = sourceResults[s][layerID];
                if (layerFeatures) {
                    for (let f = 0; f < layerFeatures.length; f++) {
                        features.push(layerFeatures[f]);
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
            for (let i = 0; i < params.layers.length; i++) {
                const layer = this._layers[params.layers[i]];
                if (!(layer instanceof StyleLayer)) {
                    // this layer is not in the style.layers array
                    return this.fire('error', {error: `The layer '${params.layers[i]
                        }' does not exist in the map's style and cannot be queried for features.`});
                }
                includedSources[layer.source] = true;
            }
        }

        const sourceResults = [];
        for (const id in this.sourceCaches) {
            if (params.layers && !includedSources[id]) continue;
            const sourceCache = this.sourceCaches[id];
            const results = QueryFeatures.rendered(sourceCache, this._layers, queryGeometry, params, zoom, bearing);
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

    addSourceType (name, SourceType, callback) {
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
        if (!_update) return this;

        const transition = this.stylesheet.transition || {};

        this.light.setLight(lightOptions);
        return this.light.updateLightTransitions(transitionOptions || {transition: true}, transition, this.animationLoop);
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
            if (this.sourceCaches[id].redoPlacement) this.sourceCaches[id].redoPlacement();
        }
    }

    // Callbacks from web workers

    getIcons(mapId, params, callback) {
        const sprite = this.sprite;
        const spriteAtlas = this.spriteAtlas;
        if (sprite.loaded()) {
            spriteAtlas.setSprite(sprite);
            spriteAtlas.addIcons(params.icons, callback);
        } else {
            sprite.on('data', () => {
                spriteAtlas.setSprite(sprite);
                spriteAtlas.addIcons(params.icons, callback);
            });
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
