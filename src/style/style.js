// @flow

import assert from 'assert';

import {Event, ErrorEvent, Evented} from '../util/evented.js';
import StyleLayer from './style_layer.js';
import StyleChanges from './style_changes.js';
import createStyleLayer from './create_style_layer.js';
import loadSprite from './load_sprite.js';
import ImageManager from '../render/image_manager.js';
import GlyphManager, {LocalGlyphMode} from '../render/glyph_manager.js';
import Light from './light.js';
import Terrain, {DrapeRenderMode} from './terrain.js';
import Fog from './fog.js';
import {pick, clone, extend, deepEqual, filterObject, cartesianPositionToSpherical, warnOnce} from '../util/util.js';
import {getJSON, getReferrer, makeRequest, ResourceType} from '../util/ajax.js';
import {isMapboxURL} from '../util/mapbox.js';
import browser from '../util/browser.js';
import Dispatcher from '../util/dispatcher.js';
import Lights from '../../3d-style/style/lights.js';
import {properties as ambientProps} from '../../3d-style/style/ambient_light_properties.js';
import {properties as directionalProps} from '../../3d-style/style/directional_light_properties.js';
import {createExpression} from '../style-spec/expression/index.js';

import type {LightProps as Ambient} from '../../3d-style/style/ambient_light_properties.js';
import type {LightProps as Directional} from '../../3d-style/style/directional_light_properties.js';
import type {Vec3} from 'gl-matrix';
import {
    validateStyle,
    validateSource,
    validateLayer,
    validateFilter,
    validateTerrain,
    validateLights,
    validateModel,
    emitValidationErrors as _emitValidationErrors
} from './validate_style.js';
import {QueryGeometry} from '../style/query_geometry.js';
import {
    create as createSource,
    getType as getSourceType,
    setType as setSourceType,
} from '../source/source.js';
import {queryRenderedFeatures, queryRenderedSymbols, querySourceFeatures} from '../source/query_features.js';
import SourceCache from '../source/source_cache.js';
import BuildingIndex from '../source/building_index.js';
import GeoJSONSource from '../source/geojson_source.js';
import styleSpec from '../style-spec/reference/latest.js';
import getWorkerPool from '../util/global_worker_pool.js';
import deref from '../style-spec/deref.js';
import emptyStyle from '../style-spec/empty.js';
import diffStyles, {operations as diffOperations} from '../style-spec/diff.js';
import {
    registerForPluginStateChange,
    evented as rtlTextPluginEvented,
    triggerPluginCompletionEvent
} from '../source/rtl_text_plugin.js';
import PauseablePlacement from './pauseable_placement.js';
import CrossTileSymbolIndex from '../symbol/cross_tile_symbol_index.js';
import {validateCustomStyleLayer} from './style_layer/custom_style_layer.js';
import {isFQID, makeFQID, getNameFromFQID, getScopeFromFQID} from '../util/fqid.js';
import {shadowDirectionFromProperties} from '../../3d-style/render/shadow_renderer.js';

// We're skipping validation errors with the `source.canvas` identifier in order
// to continue to allow canvas sources to be added at runtime/updated in
// smart setStyle (see https://github.com/mapbox/mapbox-gl-js/pull/6424):
const emitValidationErrors = (evented: Evented, errors: ?ValidationErrors) =>
    _emitValidationErrors(evented, errors && errors.filter(error => error.identifier !== 'source.canvas'));

import type {default as MapboxMap} from '../ui/map.js';
import type Transform from '../geo/transform.js';
import type {StyleImage} from './style_image.js';
import type {StyleGlyph} from './style_glyph.js';
import type {Callback} from '../types/callback.js';
import EvaluationParameters from './evaluation_parameters.js';
import type {Placement} from '../symbol/placement.js';
import type {Cancelable} from '../types/cancelable.js';
import type {RequestParameters, ResponseCallback} from '../util/ajax.js';
import type {GeoJSON} from '@mapbox/geojson-types';
import type {
    LayerSpecification,
    FilterSpecification,
    StyleSpecification,
    ImportSpecification,
    LightSpecification,
    SourceSpecification,
    TerrainSpecification,
    LightsSpecification,
    FlatLightSpecification,
    FogSpecification,
    ProjectionSpecification,
    TransitionSpecification,
    PropertyValueSpecification,
    ConfigSpecification,
    SchemaSpecification,
    CameraSpecification
} from '../style-spec/types.js';
import type {CustomLayerInterface} from './style_layer/custom_style_layer.js';
import type {Validator, ValidationErrors} from './validate_style.js';
import type {OverscaledTileID} from '../source/tile_id.js';
import type {QueryResult} from '../data/feature_index.js';
import type {QueryFeature} from '../util/vectortile_to_geojson.js';
import type {FeatureStates} from '../source/source_state.js';
import type {PointLike} from '@mapbox/point-geometry';
import type {Source, SourceClass} from '../source/source.js';
import type {TransitionParameters, ConfigOptions} from './properties.js';
import ModelManager from '../../3d-style/render/model_manager.js';
import {DEFAULT_MAX_ZOOM, DEFAULT_MIN_ZOOM} from '../geo/transform.js';
import type {QueryRenderedFeaturesParams} from '../source/query_features.js';

const supportedDiffOperations = pick(diffOperations, [
    'addLayer',
    'removeLayer',
    'setLights',
    'setPaintProperty',
    'setLayoutProperty',
    'setSlot',
    'setFilter',
    'addSource',
    'removeSource',
    'setLayerZoomRange',
    'setLight',
    'setTransition',
    'setGeoJSONSourceData',
    'setTerrain',
    'setFog',
    'setProjection',
    'setCamera',
    'addImport',
    'removeImport',
    'setImportUrl',
    'setImportData',
    'setImportConfig',
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
    localFontFamily?: ?string,
    localIdeographFontFamily?: string,

    dispatcher?: Dispatcher,
    imageManager?: ImageManager,
    glyphManager?: GlyphManager,
    modelManager?: ModelManager,
    styleChanges?: StyleChanges,

    scope?: string,
    importDepth?: number,
    importsCache?: Map<string, StyleSpecification>,
    resolvedImports?: Set<string>,
    config?: ?ConfigSpecification
};

export type StyleSetterOptions = {
    validate?: boolean;
    isInitialLoad?: boolean;
};

export type Fragment = {|
    id: string,
    style: Style,
    config?: ?ConfigSpecification
|};

const MAX_IMPORT_DEPTH = 5;
const defaultTransition = {duration: 300, delay: 0};

// Symbols are draped only on native and for certain cases only
const drapedLayers = new Set(['fill', 'line', 'background', 'hillshade', 'raster']);

/**
 * @private
 */
class Style extends Evented {
    map: MapboxMap;
    stylesheet: StyleSpecification;
    dispatcher: Dispatcher;
    imageManager: ImageManager;
    glyphManager: GlyphManager;
    modelManager: ModelManager;
    ambientLight: ?Lights<Ambient>;
    directionalLight: ?Lights<Directional>;
    light: Light;
    terrain: ?Terrain;
    disableElevatedTerrain: ?boolean;
    fog: ?Fog;
    camera: CameraSpecification;
    transition: TransitionSpecification;
    projection: ProjectionSpecification;

    scope: string;
    fragments: Array<Fragment>;
    importDepth: number;
    // Shared cache of imported stylesheets
    importsCache: Map<string, StyleSpecification>;
    // Keeps track of ancestors' Style URLs.
    resolvedImports: Set<string>;

    options: ConfigOptions;

    // Merged layers and sources
    _mergedOrder: Array<string>;
    _mergedLayers: {[_: string]: StyleLayer};
    _mergedSourceCaches: {[_: string]: SourceCache};
    _mergedOtherSourceCaches: {[_: string]: SourceCache};
    _mergedSymbolSourceCaches: {[_: string]: SourceCache};

    _request: ?Cancelable;
    _spriteRequest: ?Cancelable;
    _layers: {[_: string]: StyleLayer};
    _serializedLayers: {[_: string]: Object};
    _order: Array<string>;
    _drapedFirstOrder: Array<string>;
    _sourceCaches: {[_: string]: SourceCache};
    _otherSourceCaches: {[_: string]: SourceCache};
    _symbolSourceCaches: {[_: string]: SourceCache};
    _loaded: boolean;
    _shouldPrecompile: boolean;
    _precompileDone: boolean;
    _rtlTextPluginCallback: Function;
    _changes: StyleChanges;
    _optionsChanged: boolean;
    _layerOrderChanged: boolean;
    _availableImages: Array<string>;
    _markersNeedUpdate: boolean;
    _brightness: ?number;
    _configDependentLayers: Set<string>;
    _config: ?ConfigSpecification;
    _buildingIndex: BuildingIndex;
    _transition: TransitionSpecification;

    crossTileSymbolIndex: CrossTileSymbolIndex;
    pauseablePlacement: PauseablePlacement;
    placement: Placement;
    z: number;

    _has3DLayers: boolean;
    _hasCircleLayers: boolean;
    _hasSymbolLayers: boolean;

    // exposed to allow stubbing by unit tests
    static getSourceType: typeof getSourceType;
    static setSourceType: typeof setSourceType;
    static registerForPluginStateChange: typeof registerForPluginStateChange;

    constructor(map: MapboxMap, options: StyleOptions = {}) {
        super();

        this.map = map;

        // Empty string indicates the root Style scope.
        this.scope = options.scope || '';

        this.fragments = [];
        this.importDepth = options.importDepth || 0;
        this.importsCache = options.importsCache || new Map();
        this.resolvedImports = options.resolvedImports || new Set();

        this.transition = extend({}, defaultTransition);

        this._buildingIndex = new BuildingIndex(this);
        this.crossTileSymbolIndex = new CrossTileSymbolIndex();

        this._mergedOrder = [];
        this._drapedFirstOrder = [];
        this._mergedLayers = {};
        this._mergedSourceCaches = {};
        this._mergedOtherSourceCaches = {};
        this._mergedSymbolSourceCaches = {};

        this._has3DLayers = false;
        this._hasCircleLayers = false;
        this._hasSymbolLayers = false;

        this._changes = options.styleChanges || new StyleChanges();

        if (options.dispatcher) {
            this.dispatcher = options.dispatcher;
        } else {
            this.dispatcher = new Dispatcher(getWorkerPool(), this);
        }

        if (options.imageManager) {
            this.imageManager = options.imageManager;
        } else {
            this.imageManager = new ImageManager();
            this.imageManager.setEventedParent(this);
        }
        this.imageManager.createScope(this.scope);

        if (options.glyphManager) {
            this.glyphManager = options.glyphManager;
        } else {
            this.glyphManager = new GlyphManager(map._requestManager,
                options.localFontFamily ?
                    LocalGlyphMode.all :
                    (options.localIdeographFontFamily ? LocalGlyphMode.ideographs : LocalGlyphMode.none),
                options.localFontFamily || options.localIdeographFontFamily);
        }

        if (options.modelManager) {
            this.modelManager = options.modelManager;
        } else {
            this.modelManager = new ModelManager(map._requestManager);
            this.modelManager.setEventedParent(this);
        }

        this._layers = {};
        this._serializedLayers = {};
        this._sourceCaches = {};
        this._otherSourceCaches = {};
        this._symbolSourceCaches = {};
        this._loaded = false;
        this._precompileDone = false;
        this._shouldPrecompile = false;
        this._availableImages = [];
        this._order = [];
        this._markersNeedUpdate = false;

        this.options = new Map();
        this._configDependentLayers = new Set();
        this._config = options.config;

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

            const source = this.getOwnSource(event.sourceId);
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
    } = {}): void {
        this.fire(new Event('dataloading', {dataType: 'style'}));

        const validate = typeof options.validate === 'boolean' ?
            options.validate : !isMapboxURL(url);

        url = this.map._requestManager.normalizeStyleURL(url, options.accessToken);
        this.resolvedImports.add(url);

        const cachedImport = this.importsCache.get(url);
        if (cachedImport) return this._load(cachedImport, validate);

        const request = this.map._requestManager.transformRequest(url, ResourceType.Style);
        this._request = getJSON(request, (error: ?Error, json: ?Object) => {
            this._request = null;
            if (error) {
                this.fire(new ErrorEvent(error));
            } else if (json) {
                this.importsCache.set(url, json);
                return this._load(json, validate);
            }
        });
    }

    loadJSON(json: StyleSpecification, options: StyleSetterOptions = {}): void {
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

    _loadImports(imports: Array<ImportSpecification>, validate: boolean): Promise<any> {
        // We take the root style into account when calculating the import depth.
        if (this.importDepth >= MAX_IMPORT_DEPTH - 1) {
            warnOnce(`Style doesn't support nesting deeper than ${MAX_IMPORT_DEPTH}`);
            return Promise.resolve();
        }

        const waitForStyles = [];
        for (const importSpec of imports) {
            const style = this._createFragmentStyle(importSpec);

            // Merge everything and update layers after the import style is settled.
            const waitForStyle = new Promise(resolve => {
                style.once('style.import.load', resolve);
                style.once('error', resolve);
            })
                .then(() => this.mergeAll());
            waitForStyles.push(waitForStyle);

            // Load empty style if one of the ancestors was already
            // instantiated from this URL to avoid recursion.
            if (this.resolvedImports.has(importSpec.url)) {
                style.loadEmpty();
                continue;
            }

            // Use previously cached style JSON if the import data is not set.
            const json = importSpec.data || this.importsCache.get(importSpec.url);
            if (json) {
                style.loadJSON(json, {validate});
            } else if (importSpec.url) {
                style.loadURL(importSpec.url, {validate});
            } else {
                style.loadEmpty();
            }

            const fragment = {
                style,
                id: importSpec.id,
                config: importSpec.config
            };

            this.fragments.push(fragment);
        }

        // $FlowFixMe[method-unbinding]
        return Promise.allSettled(waitForStyles);
    }

    _createFragmentStyle(importSpec: ImportSpecification): Style {
        const scope = this.scope ? makeFQID(importSpec.id, this.scope) : importSpec.id;

        const style = new Style(this.map, {
            scope,
            styleChanges: this._changes,
            importDepth: this.importDepth + 1,
            importsCache: this.importsCache,
            // Clone resolvedImports so it's not being shared between siblings
            resolvedImports: new Set(this.resolvedImports),
            // Use shared Dispatcher and assets Managers between Styles
            dispatcher: this.dispatcher,
            imageManager: this.imageManager,
            glyphManager: this.glyphManager,
            modelManager: this.modelManager,
            config: importSpec.config
        });

        // Bubble all events fired by the style to the map.
        style.setEventedParent(this.map, {style});

        return style;
    }

    _reloadImports() {
        this.mergeAll();
        this._updateMapProjection();
        this.map._triggerCameraUpdate(this.camera);

        this.dispatcher.broadcast('setLayers', {
            layers: this._serializeLayers(this._order),
            scope: this.scope,
            options: this.options
        });

        const isRootStyle = this.isRootStyle();
        this._shouldPrecompile = isRootStyle;
        this.fire(new Event(isRootStyle ? 'style.load' : 'style.import.load'));
    }

    _load(json: StyleSpecification, validate: boolean) {
        const schema = json.schema;

        // This style was loaded as a root style, but it is marked as a fragment and/or has a schema. We instead load
        // it as an import with the well-known ID "basemap" to make sure that we don't expose the internals.
        if (this.isRootStyle() && (json.fragment || (schema && json.fragment !== false))) {
            const basemap = {id: 'basemap', data: json, url: ''};
            const style = extend({}, empty, {imports: [basemap]});
            this._load(style, validate);
            return;
        }

        this.setConfig(this._config, schema);

        if (validate && emitValidationErrors(this, validateStyle(json))) {
            return;
        }

        this._loaded = true;
        this.stylesheet = clone(json);

        for (const id in json.sources) {
            this.addSource(id, json.sources[id], {validate: false, isInitialLoad: true});
        }

        if (json.sprite) {
            this._loadSprite(json.sprite);
        } else {
            this.imageManager.setLoaded(true, this.scope);
            this.dispatcher.broadcast('spriteLoaded', {scope: this.scope, isLoaded: true});
        }

        this.glyphManager.setURL(json.glyphs, this.scope);

        const layers: Array<LayerSpecification> = deref(this.stylesheet.layers);
        this._order = layers.map((layer) => layer.id);

        if (this.stylesheet.light) {
            warnOnce('The `light` root property is deprecated, prefer using `lights` with `flat` light type instead.');
        }

        if (this.stylesheet.lights) {
            if (this.stylesheet.lights.length === 1 && this.stylesheet.lights[0].type === "flat") {
                const flatLight: FlatLightSpecification = this.stylesheet.lights[0];
                this.light = new Light(flatLight.properties, flatLight.id);
            } else {
                this.setLights(this.stylesheet.lights);
            }
        }

        if (!this.light) {
            this.light = new Light(this.stylesheet.light);
        }

        this._layers = {};
        this._serializedLayers = {};
        for (const layer of layers) {
            const styleLayer = createStyleLayer(layer, this.options);
            styleLayer.setScope(this.scope);
            if (styleLayer.isConfigDependent) this._configDependentLayers.add(styleLayer.fqid);
            styleLayer.setEventedParent(this, {layer: {id: styleLayer.id}});
            this._layers[styleLayer.id] = styleLayer;
            this._serializedLayers[styleLayer.id] = styleLayer.serialize();

            const sourceCache = this.getOwnLayerSourceCache(styleLayer);
            const shadowsEnabled = !!this.directionalLight && this.directionalLight.shadowsEnabled();

            if (sourceCache && styleLayer.canCastShadows() && shadowsEnabled) {
                sourceCache.castsShadows = true;
            }
        }

        if (this.stylesheet.models) {
            this.modelManager.addModels(this.stylesheet.models, this.scope);
        }

        const terrain = this.stylesheet.terrain;
        if (terrain) {
            // This workaround disables terrain and hillshade
            // if there is noise in the Canvas2D operations used for image decoding.
            if (this.disableElevatedTerrain === undefined)
                this.disableElevatedTerrain = browser.hasCanvasFingerprintNoise();

            if (this.disableElevatedTerrain) {
                warnOnce('Terrain and hillshade are disabled because of Canvas2D limitations when fingerprinting protection is enabled (e.g. in private browsing mode).');
            } else if (!this.terrainSetForDrapingOnly()) {
                this._createTerrain(terrain, DrapeRenderMode.elevated);
            }
        }

        if (this.stylesheet.fog) {
            this._createFog(this.stylesheet.fog);
        }

        if (this.stylesheet.transition) {
            this.setTransition(this.stylesheet.transition);
        }

        this.fire(new Event('data', {dataType: 'style'}));

        if (json.imports) {
            this._loadImports(json.imports, validate).then(() => this._reloadImports());
        } else {
            this._reloadImports();
        }
    }

    isRootStyle(): boolean {
        return this.importDepth === 0;
    }

    mergeAll() {
        let light;
        let ambientLight;
        let directionalLight;
        let terrain;
        let fog;
        let projection;
        let transition;
        let camera;

        // Reset terrain that might have been set by a previous merge
        if (this.terrain && this.terrain.scope !== this.scope) {
            delete this.terrain;
        }

        this.forEachFragmentStyle((style: Style) => {
            if (!style.stylesheet) return;

            if (style.light != null)
                light = style.light;

            if (style.stylesheet.lights) {
                for (const light of style.stylesheet.lights) {
                    if (light.type === 'ambient' && style.ambientLight != null)
                        ambientLight = style.ambientLight;

                    if (light.type === 'directional' && style.directionalLight != null)
                        directionalLight = style.directionalLight;
                }
            }

            terrain = this._prioritizeTerrain(
                terrain,
                style.terrain,
                style.stylesheet.terrain,
            );

            if (style.stylesheet.fog && style.fog != null)
                fog = style.fog;

            if (style.stylesheet.camera != null)
                camera = style.stylesheet.camera;

            if (style.stylesheet.projection != null)
                projection = style.stylesheet.projection;

            if (style.stylesheet.transition != null)
                transition = style.stylesheet.transition;
        });

        // $FlowFixMe[incompatible-type]
        this.light = light;
        this.ambientLight = ambientLight;
        this.directionalLight = directionalLight;
        this.fog = fog;

        if (terrain === null) {
            delete this.terrain;
        } else {
            this.terrain = terrain;
        }

        // Use perspective camera as a fallback if no camera is specified
        this.camera = camera || {'camera-projection': 'perspective'};
        this.projection = projection || {name: 'mercator'};
        this.transition = extend({}, defaultTransition, transition);

        this.mergeSources();
        this.mergeLayers();
    }

    forEachFragmentStyle(fn: (style: Style) => void) {
        const traverse = (style: Style) => {
            for (const fragment of style.fragments) {
                traverse(fragment.style);
            }

            fn(style);
        };

        traverse(this);
    }

    _prioritizeTerrain(prevTerrain: ?Terrain, nextTerrain: ?Terrain, nextTerrainSpec: ?TerrainSpecification): ?Terrain {
        // Given the previous and next terrain during imports merging, in order of priority, we select:
        // 1. null, if the next terrain is explicitly disabled and we are not using the globe
        // 2. next terrain if it is not null
        // 3. previous terrain

        const prevIsDeffered = prevTerrain && prevTerrain.drapeRenderMode === DrapeRenderMode.deferred;
        const nextIsDeffered = nextTerrain && nextTerrain.drapeRenderMode === DrapeRenderMode.deferred;

        // Disable terrain if it was explicitly set to null and we are not using globe
        if (nextTerrainSpec === null) {
            // First, check if the terrain is deferred
            // If so, we are using the globe and should keep the terrain
            if (nextIsDeffered) return nextTerrain;
            if (prevIsDeffered) return prevTerrain;

            return null;
        }

        // Use next terrain if there is no previous terrain or if it is deferred
        if (nextTerrain != null) {
            const nextIsElevated = nextTerrain && nextTerrain.drapeRenderMode === DrapeRenderMode.elevated;
            if (!prevTerrain || prevIsDeffered || nextIsElevated) return nextTerrain;
        }

        return prevTerrain;
    }

    mergeTerrain() {
        let terrain;

        // Reset terrain that might have been set by a previous merge
        if (this.terrain && this.terrain.scope !== this.scope) {
            delete this.terrain;
        }

        this.forEachFragmentStyle((style: Style) => {
            terrain = this._prioritizeTerrain(
                terrain,
                style.terrain,
                style.stylesheet.terrain,
            );
        });

        if (terrain === null) {
            delete this.terrain;
        } else {
            this.terrain = terrain;
        }
    }

    mergeProjection() {
        let projection;

        this.forEachFragmentStyle((style: Style) => {
            if (style.stylesheet.projection != null)
                projection = style.stylesheet.projection;
        });

        this.projection = projection || {name: 'mercator'};
    }

    mergeSources() {
        const mergedSourceCaches = {};
        const mergedOtherSourceCaches = {};
        const mergedSymbolSourceCaches = {};

        this.forEachFragmentStyle((style: Style) => {
            for (const id in style._sourceCaches) {
                const fqid = makeFQID(id, style.scope);
                mergedSourceCaches[fqid] = style._sourceCaches[id];
            }

            for (const id in style._otherSourceCaches) {
                const fqid = makeFQID(id, style.scope);
                mergedOtherSourceCaches[fqid] = style._otherSourceCaches[id];
            }

            for (const id in style._symbolSourceCaches) {
                const fqid = makeFQID(id, style.scope);
                mergedSymbolSourceCaches[fqid] = style._symbolSourceCaches[id];
            }
        });

        this._mergedSourceCaches = mergedSourceCaches;
        this._mergedOtherSourceCaches = mergedOtherSourceCaches;
        this._mergedSymbolSourceCaches = mergedSymbolSourceCaches;
    }

    mergeLayers() {
        const slots: {[string]: StyleLayer[]} = {};
        const mergedOrder: StyleLayer[] = [];
        const mergedLayers: {[string]: StyleLayer} = {};

        this._has3DLayers = false;
        this._hasCircleLayers = false;
        this._hasSymbolLayers = false;

        this.forEachFragmentStyle((style: Style) => {
            for (const layerId of style._order) {
                const layer = style._layers[layerId];
                if (layer.type === 'slot') {
                    const slotName = getNameFromFQID(layerId);
                    if (slots[slotName]) continue;
                    else slots[slotName] = [];
                }

                if (layer.slot && slots[layer.slot]) {
                    slots[layer.slot].push(layer);
                    continue;
                }

                mergedOrder.push(layer);
            }
        });

        this._mergedOrder = [];
        const sort = (layers: StyleLayer[] = []) => {
            for (const layer of layers) {
                if (layer.type === 'slot') {
                    const slotName = getNameFromFQID(layer.id);
                    if (slots[slotName]) sort(slots[slotName]);
                } else {
                    const fqid = makeFQID(layer.id, layer.scope);
                    this._mergedOrder.push(fqid);
                    mergedLayers[fqid] = layer;

                    // Typed layer bookkeeping
                    if (layer.is3D()) this._has3DLayers = true;
                    if (layer.type === 'circle') this._hasCircleLayers = true;
                    if (layer.type === 'symbol') this._hasSymbolLayers = true;
                }
            }
        };

        sort(mergedOrder);
        this._mergedLayers = mergedLayers;
        this.updateDrapeFirstLayers();
        this._buildingIndex.processLayersChanged();
    }

    terrainSetForDrapingOnly(): boolean {
        return !!this.terrain && this.terrain.drapeRenderMode === DrapeRenderMode.deferred;
    }

    getCamera(): ?CameraSpecification {
        return this.stylesheet.camera;
    }

    setCamera(camera: CameraSpecification): Style {
        this.stylesheet.camera = extend({}, this.stylesheet.camera, camera);
        this.camera = this.stylesheet.camera;
        return this;
    }

    setProjection(projection?: ?ProjectionSpecification) {
        if (projection) {
            this.stylesheet.projection = projection;
        } else {
            delete this.stylesheet.projection;
        }
        this.mergeProjection();
        this._updateMapProjection();
    }

    applyProjectionUpdate() {
        if (!this._loaded) return;
        this.dispatcher.broadcast('setProjection', this.map.transform.projectionOptions);

        if (this.map.transform.projection.requiresDraping) {
            const hasTerrain = this.getTerrain() || this.stylesheet.terrain;
            if (!hasTerrain) {
                this.setTerrainForDraping();
            }
        } else if (this.terrainSetForDrapingOnly()) {
            this.setTerrain(null);
        }
    }

    _updateMapProjection() {
        // Skip projection updates from the children fragments
        if (!this.isRootStyle()) return;

        if (!this.map._useExplicitProjection) { // Update the visible projection if map's is null
            this.map._prioritizeAndUpdateProjection(null, this.projection);
        } else { // Ensure that style is consistent with current projection on style load
            this.applyProjectionUpdate();
        }
    }

    _loadSprite(url: string) {
        this._spriteRequest = loadSprite(url, this.map._requestManager, (err, images) => {
            this._spriteRequest = null;
            if (err) {
                this.fire(new ErrorEvent(err));
            } else if (images) {
                for (const id in images) {
                    this.imageManager.addImage(id, this.scope, images[id]);
                }
            }

            this.imageManager.setLoaded(true, this.scope);
            this._availableImages = this.imageManager.listImages(this.scope);
            this.dispatcher.broadcast('setImages', {
                scope: this.scope,
                images: this._availableImages
            });
            this.dispatcher.broadcast('spriteLoaded', {scope: this.scope, isLoaded: true});
            this.fire(new Event('data', {dataType: 'style'}));
        });
    }

    _validateLayer(layer: StyleLayer) {
        const source = this.getOwnSource(layer.source);
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

    loaded(): boolean {
        if (!this._loaded)
            return false;

        if (Object.keys(this._changes.getUpdatedSourceCaches()).length)
            return false;

        for (const id in this._sourceCaches)
            if (!this._sourceCaches[id].loaded())
                return false;

        if (!this.imageManager.isLoaded())
            return false;

        if (!this.modelManager.isLoaded())
            return false;

        for (const {style} of this.fragments) {
            if (!style.loaded()) return false;
        }

        return true;
    }

    _serializeImports(): Array<ImportSpecification> | void {
        if (!this.stylesheet.imports) return undefined;

        return this.stylesheet.imports.map((importSpec, index) => {
            const fragment = this.fragments[index];
            if (fragment && fragment.style) {
                importSpec.data = fragment.style.serialize();
            }

            return importSpec;
        });
    }

    _serializeSources(): {[sourceId: string]: SourceSpecification} {
        const sources = {};
        for (const cacheId in this._sourceCaches) {
            const source = this._sourceCaches[cacheId].getSource();
            if (!sources[source.id]) {
                sources[source.id] = source.serialize();
            }
        }

        return sources;
    }

    _serializeLayers(ids: Array<string>): Array<LayerSpecification> {
        const serializedLayers = [];
        for (const id of ids) {
            const layer = this._layers[id];
            if (layer && layer.type !== 'custom') {
                serializedLayers.push(layer.serialize());
            }
        }
        return serializedLayers;
    }

    hasLightTransitions(): boolean {
        if (this.light && this.light.hasTransition()) {
            return true;
        }

        if (this.ambientLight && this.ambientLight.hasTransition()) {
            return true;
        }

        if (this.directionalLight && this.directionalLight.hasTransition()) {
            return true;
        }

        return false;
    }

    hasFogTransition(): boolean {
        if (!this.fog) return false;
        return this.fog.hasTransition();
    }

    hasTransitions(): boolean {
        if (this.hasLightTransitions()) {
            return true;
        }

        if (this.hasFogTransition()) {
            return true;
        }

        for (const id in this._sourceCaches) {
            if (this._sourceCaches[id].hasTransition()) {
                return true;
            }
        }

        for (const layerId in this._layers) {
            const layer = this._layers[layerId];
            if (layer.hasTransition()) {
                return true;
            }
        }

        return false;
    }

    get order(): Array<string> {
        if (this.terrain) {
            assert(this._drapedFirstOrder.length === this._mergedOrder.length, 'drapedFirstOrder doesn\'t match order');
            return this._drapedFirstOrder;
        }
        return this._mergedOrder;
    }

    isLayerDraped(layer: StyleLayer): boolean {
        if (!this.terrain) return false;
        if (typeof layer.isLayerDraped === 'function') return layer.isLayerDraped(this.getLayerSourceCache(layer));
        return drapedLayers.has(layer.type);
    }

    _checkLoaded(): void {
        if (!this._loaded) {
            throw new Error('Style is not done loading');
        }
    }

    _checkLayer(layerId: string): ?StyleLayer {
        const layer = this.getOwnLayer(layerId);
        if (!layer) {
            this.fire(new ErrorEvent(new Error(`The layer '${layerId}' does not exist in the map's style.`)));
            return;
        }
        return layer;
    }

    _checkSource(sourceId: string): ?Source {
        const source = this.getOwnSource(sourceId);
        if (!source) {
            this.fire(new ErrorEvent(new Error(`The source '${sourceId}' does not exist in the map's style.`)));
            return;
        }
        return source;
    }

    /**
     * Apply queued style updates in a batch and recalculate zoom-dependent paint properties.
     * @private
     */
    update(parameters: EvaluationParameters) {
        if (!this._loaded) {
            return;
        }

        if (this.ambientLight) {
            this.ambientLight.recalculate(parameters);
        }

        if (this.directionalLight) {
            this.directionalLight.recalculate(parameters);
        }

        const brightness = this.calculateLightsBrightness();
        parameters.brightness = brightness || 0.0;
        if (brightness !== this._brightness) {
            this._brightness = brightness;
            this.dispatcher.broadcast('setBrightness', brightness);
        }

        const changed = this._changes.isDirty();
        if (this._changes.isDirty()) {
            const updatesByScope = this._changes.getLayerUpdatesByScope();
            for (const scope in updatesByScope) {
                const {updatedIds, removedIds} = updatesByScope[scope];
                if (updatedIds || removedIds) {
                    this._updateWorkerLayers(scope, updatedIds, removedIds);
                }
            }

            this.updateSourceCaches();
            this._updateTilesForChangedImages();

            this.updateLayers(parameters);

            if (this.light) {
                this.light.updateTransitions(parameters);
            }

            if (this.ambientLight) {
                this.ambientLight.updateTransitions(parameters);
            }

            if (this.directionalLight) {
                this.directionalLight.updateTransitions(parameters);
            }

            if (this.fog) {
                this.fog.updateTransitions(parameters);
            }

            this._changes.reset();
        }

        const sourcesUsedBefore = {};

        for (const sourceId in this._mergedSourceCaches) {
            const sourceCache = this._mergedSourceCaches[sourceId];
            sourcesUsedBefore[sourceId] = sourceCache.used;
            sourceCache.used = false;
        }

        for (const layerId of this._mergedOrder) {
            const layer = this._mergedLayers[layerId];
            layer.recalculate(parameters, this._availableImages);
            if (!layer.isHidden(parameters.zoom)) {
                const sourceCache = this.getLayerSourceCache(layer);
                if (sourceCache) sourceCache.used = true;
            }

            if (!this._precompileDone && this._shouldPrecompile) {
                for (let i = (layer.minzoom || DEFAULT_MIN_ZOOM); i < (layer.maxzoom || DEFAULT_MAX_ZOOM); i++) {
                    const painter = this.map.painter;
                    if (painter) {
                        const programIds = layer.getProgramIds();
                        if (!programIds) continue;

                        for (const programId of programIds) {
                            const params = layer.getDefaultProgramParams(programId, parameters.zoom);
                            if (params) {
                                painter.style = this;
                                if (this.fog) {
                                    painter._fogVisible = true;
                                    params.overrideFog = true;
                                    painter.getOrCreateProgram(programId, params);
                                }
                                painter._fogVisible = false;
                                params.overrideFog = false;
                                painter.getOrCreateProgram(programId, params);

                                if (this.stylesheet.terrain || (this.stylesheet.projection && this.stylesheet.projection.name === 'globe')) {
                                    params.overrideRtt = true;
                                    painter.getOrCreateProgram(programId, params);
                                }
                            }
                        }
                    }
                }
            }
        }
        if (this._shouldPrecompile) {
            this._precompileDone = true;
        }

        for (const sourceId in sourcesUsedBefore) {
            const sourceCache = this._mergedSourceCaches[sourceId];
            if (sourcesUsedBefore[sourceId] !== sourceCache.used) {
                sourceCache.getSource().fire(new Event('data', {sourceDataType: 'visibility', dataType:'source', sourceId: sourceCache.getSource().id}));
            }
        }

        if (this.light) {
            this.light.recalculate(parameters);
        }

        if (this.terrain) {
            this.terrain.recalculate(parameters);
        }

        if (this.fog) {
            this.fog.recalculate(parameters);
        }

        this.z = parameters.zoom;

        if (this._markersNeedUpdate) {
            this._updateMarkersOpacity();
            this._markersNeedUpdate = false;
        }

        if (changed) {
            this.fire(new Event('data', {dataType: 'style'}));
        }
    }

    /*
     * Apply any queued image changes.
     */
    _updateTilesForChangedImages() {
        const updatedImages = this._changes.getUpdatedImages();
        if (updatedImages.length) {
            for (const name in this._sourceCaches) {
                this._sourceCaches[name].reloadTilesForDependencies(['icons', 'patterns'], updatedImages);
            }
            this._changes.resetUpdatedImages();
        }
    }

    _updateWorkerLayers(scope: string, updatedIds?: Array<string>, removedIds?: Array<string>) {
        const fragmentStyle = this.getFragmentStyle(scope);
        if (!fragmentStyle) return;

        this.dispatcher.broadcast('updateLayers', {
            layers: updatedIds ? fragmentStyle._serializeLayers(updatedIds) : [],
            scope,
            removedIds: removedIds || [],
            options: fragmentStyle.options
        });
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
    setState(nextState: StyleSpecification): boolean {
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
            (this: any)[op.command].apply(this, op.args);
        });

        this.stylesheet = nextState;
        this.mergeAll();

        this.dispatcher.broadcast('setLayers', {
            layers: this._serializeLayers(this._order),
            scope: this.scope,
            options: this.options
        });

        return true;
    }

    addImage(id: string, image: StyleImage): this {
        if (this.getImage(id)) {
            return this.fire(new ErrorEvent(new Error('An image with this name already exists.')));
        }
        this.imageManager.addImage(id, this.scope, image);
        this._afterImageUpdated(id);
        return this;
    }

    updateImage(id: string, image: StyleImage) {
        this.imageManager.updateImage(id, this.scope, image);
    }

    getImage(id: string): ?StyleImage {
        return this.imageManager.getImage(id, this.scope);
    }

    removeImage(id: string): this {
        if (!this.getImage(id)) {
            return this.fire(new ErrorEvent(new Error('No image with this name exists.')));
        }
        this.imageManager.removeImage(id, this.scope);
        this._afterImageUpdated(id);
        return this;
    }

    _afterImageUpdated(id: string) {
        this._availableImages = this.imageManager.listImages(this.scope);
        this._changes.updateImage(id);
        this.dispatcher.broadcast('setImages', {
            scope: this.scope,
            images: this._availableImages
        });
        this.fire(new Event('data', {dataType: 'style'}));
    }

    listImages(): Array<string> {
        this._checkLoaded();
        return this._availableImages.slice();
    }

    addModel(id: string, url: string, options: StyleSetterOptions = {}): this {
        this._checkLoaded();
        if (this._validate(validateModel, `models.${id}`, url, null, options)) return this;

        this.modelManager.addModel(id, url, this.scope);
        this._changes.setDirty();
        return this;
    }

    hasModel(id: string): boolean {
        return this.modelManager.hasModel(id, this.scope);
    }

    removeModel(id: string): this {
        if (!this.hasModel(id)) {
            return this.fire(new ErrorEvent(new Error('No model with this ID exists.')));
        }
        this.modelManager.removeModel(id, this.scope);
        return this;
    }

    listModels(): Array<string> {
        this._checkLoaded();
        return this.modelManager.listModels(this.scope);
    }

    addSource(id: string, source: SourceSpecification, options: StyleSetterOptions = {}): void {
        this._checkLoaded();

        if (this.getOwnSource(id) !== undefined) {
            throw new Error(`There is already a source with ID "${id}".`);
        }

        if (!source.type) {
            throw new Error(`The type property must be defined, but only the following properties were given: ${Object.keys(source).join(', ')}.`);
        }

        const builtIns = ['vector', 'raster', 'geojson', 'video', 'image'];
        const shouldValidate = builtIns.indexOf(source.type) >= 0;
        if (shouldValidate && this._validate(validateSource, `sources.${id}`, source, null, options)) return;

        if (this.map && this.map._collectResourceTiming) (source: any).collectResourceTiming = true;

        const sourceInstance = createSource(id, source, this.dispatcher, this);
        sourceInstance.scope = this.scope;

        sourceInstance.setEventedParent(this, () => ({
            isSourceLoaded: this._isSourceCacheLoaded(sourceInstance.id),
            source: sourceInstance.serialize(),
            sourceId: sourceInstance.id
        }));

        const addSourceCache = (onlySymbols: boolean) => {
            const sourceCacheId = (onlySymbols ? 'symbol:' : 'other:') + sourceInstance.id;
            const sourceCacheFQID = makeFQID(sourceCacheId, this.scope);
            const sourceCache = this._sourceCaches[sourceCacheId] = new SourceCache(sourceCacheFQID, sourceInstance, onlySymbols);
            (onlySymbols ? this._symbolSourceCaches : this._otherSourceCaches)[sourceInstance.id] = sourceCache;
            sourceCache.onAdd(this.map);
        };

        addSourceCache(false);
        if (source.type === 'vector' || source.type === 'geojson') {
            addSourceCache(true);
        }

        if (sourceInstance.onAdd) sourceInstance.onAdd(this.map);

        // Avoid triggering redundant style update after adding initial sources.
        if (!options.isInitialLoad) {
            this.mergeSources();
            this._changes.setDirty();
        }
    }

    /**
     * Remove a source from this stylesheet, given its ID.
     * @param {string} id ID of the source to remove.
     * @throws {Error} If no source is found with the given ID.
     * @returns {Map} The {@link Map} object.
     */
    removeSource(id: string): this {
        this._checkLoaded();

        const source = this.getOwnSource(id);
        if (!source) {
            throw new Error('There is no source with this ID');
        }
        for (const layerId in this._layers) {
            if (this._layers[layerId].source === id) {
                return this.fire(new ErrorEvent(new Error(`Source "${id}" cannot be removed while layer "${layerId}" is using it.`)));
            }
        }
        if (this.terrain && this.terrain.scope === this.scope && this.terrain.get().source === id) {
            return this.fire(new ErrorEvent(new Error(`Source "${id}" cannot be removed while terrain is using it.`)));
        }

        const sourceCaches = this.getOwnSourceCaches(id);
        for (const sourceCache of sourceCaches) {
            const id = getNameFromFQID(sourceCache.id);
            delete this._sourceCaches[id];
            this._changes.discardSourceCacheUpdate(sourceCache.id);
            sourceCache.fire(new Event('data', {sourceDataType: 'metadata', dataType:'source', sourceId: sourceCache.getSource().id}));
            sourceCache.setEventedParent(null);
            sourceCache.clearTiles();
        }
        delete this._otherSourceCaches[id];
        delete this._symbolSourceCaches[id];
        this.mergeSources();

        source.setEventedParent(null);
        if (source.onRemove) {
            source.onRemove(this.map);
        }
        this._changes.setDirty();
        return this;
    }

    /**
     * Set the data of a GeoJSON source, given its ID.
     * @param {string} id ID of the source.
     * @param {GeoJSON|string} data GeoJSON source.
     */
    setGeoJSONSourceData(id: string, data: GeoJSON | string) {
        this._checkLoaded();

        assert(this.getOwnSource(id) !== undefined, 'There is no source with this ID');
        const geojsonSource: GeoJSONSource = (this.getOwnSource(id): any);
        assert(geojsonSource.type === 'geojson');

        geojsonSource.setData(data);
        this._changes.setDirty();
    }

    /**
     * Get a source by ID.
     * @param {string} id ID of the desired source.
     * @returns {?Source} The source object.
     */
    getOwnSource(id: string): ?Source {
        const sourceCache = this.getOwnSourceCache(id);
        return sourceCache && sourceCache.getSource();
    }

    getOwnSources(): Source[] {
        const sources = [];
        for (const id in this._otherSourceCaches) {
            const sourceCache = this.getOwnSourceCache(id);
            if (sourceCache) sources.push(sourceCache.getSource());
        }

        return sources;
    }

    setLights(lights: ?Array<LightsSpecification>) {
        this._checkLoaded();

        if (!lights) {
            delete this.ambientLight;
            delete this.directionalLight;
            return;
        }

        const transitionParameters = this._getTransitionParameters();

        for (const light of lights) {
            if (this._validate(validateLights, 'lights', light)) {
                return;
            }

            switch (light.type) {
            case 'ambient':
                if (this.ambientLight) {
                    const ambientLight = this.ambientLight;
                    ambientLight.set(light);
                    ambientLight.updateTransitions(transitionParameters);
                } else {
                    this.ambientLight = new Lights<Ambient>(light, ambientProps, this.scope, this.options);
                }
                break;
            case 'directional':
                if (this.directionalLight) {
                    const directionalLight = this.directionalLight;
                    directionalLight.set(light);
                    directionalLight.updateTransitions(transitionParameters);
                } else {
                    this.directionalLight = new Lights<Directional>(light, directionalProps, this.scope, this.options);
                }
                break;
            default:
                assert(false, `Unknown light type: ${light.type}`);
            }
        }

        const evaluationParameters = new EvaluationParameters(this.z || 0, transitionParameters);

        if (this.ambientLight) {
            this.ambientLight.recalculate(evaluationParameters);
        }

        if (this.directionalLight) {
            this.directionalLight.recalculate(evaluationParameters);
        }

        this._brightness = this.calculateLightsBrightness();
        this.dispatcher.broadcast('setBrightness', this._brightness);
    }

    calculateLightsBrightness(): ?number {
        const directional = this.directionalLight;
        const ambient = this.ambientLight;

        if (!directional || !ambient) {
            return;
        }

        // Based on: https://www.w3.org/WAI/GL/wiki/Relative_luminance
        const relativeLuminance = (color: [number, number, number, number]) => {
            const r = color[0] <= 0.03928 ? (color[0] / 12.92) : Math.pow(((color[0] + 0.055) / 1.055), 2.4);
            const g = color[1] <= 0.03928 ? (color[1] / 12.92) : Math.pow(((color[1] + 0.055) / 1.055), 2.4);
            const b = color[2] <= 0.03928 ? (color[2] / 12.92) : Math.pow(((color[2] + 0.055) / 1.055), 2.4);
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };

        const directionalColor = directional.properties.get('color').toArray01();
        const directionalIntensity = directional.properties.get('intensity');
        const direction = directional.properties.get('direction');

        const sphericalDirection = cartesianPositionToSpherical(direction.x, direction.y, direction.z);
        const polarIntensity = 1.0 - sphericalDirection[2] / 90.0;
        const directionalBrightness = relativeLuminance(directionalColor) * directionalIntensity * polarIntensity;

        const ambientColor = ambient.properties.get('color').toArray01();
        const ambientIntensity = ambient.properties.get('intensity');
        const ambientBrightness = relativeLuminance(ambientColor) * ambientIntensity;

        return (directionalBrightness + ambientBrightness) / 2.0;
    }

    getBrightness(): ?number {
        return this._brightness;
    }

    getLights(): ?Array<LightsSpecification> {
        if (!this.enable3dLights()) return null;
        const lights = [];
        if (this.directionalLight) {
            lights.push(this.directionalLight.get());
        }
        if (this.ambientLight) {
            lights.push(this.ambientLight.get());
        }
        return lights;
    }

    enable3dLights(): boolean {
        return !!this.ambientLight && !!this.directionalLight;
    }

    getFragmentStyle(fragmentId?: string): ?Style {
        if (!fragmentId) return this;

        if (isFQID(fragmentId)) {
            const scope = getScopeFromFQID(fragmentId);
            const fragment = this.fragments.find(({id}) => id === scope);
            if (!fragment) throw new Error(`Style import not found: ${fragmentId}`);
            const name = getNameFromFQID(fragmentId);
            return fragment.style.getFragmentStyle(name);
        } else {
            const fragment = this.fragments.find(({id}) => id === fragmentId);
            if (!fragment) throw new Error(`Style import not found: ${fragmentId}`);
            return fragment.style;
        }
    }

    getConfigProperty(fragmentId: string, key: string): ?any {
        const fragmentStyle = this.getFragmentStyle(fragmentId);
        if (!fragmentStyle) return null;
        const expressions = fragmentStyle.options.get(key);
        const expression = expressions ? expressions.value || expressions.default : null;
        return expression ? expression.serialize() : null;
    }

    setConfigProperty(fragmentId: string, key: string, value: any) {
        const expressionParsed = createExpression(value);
        if (expressionParsed.result !== 'success') {
            emitValidationErrors(this, expressionParsed.value);
            return;
        }

        const expression = expressionParsed.value.expression;

        const fragmentStyle = this.getFragmentStyle(fragmentId);
        if (!fragmentStyle) return;

        const expressions = fragmentStyle.options.get(key);
        if (!expressions) return;

        fragmentStyle.options.set(key, {...expressions, value: expression});
        fragmentStyle.updateConfigDependencies();
    }

    setConfig(config: ?ConfigSpecification, schema: ?SchemaSpecification) {
        this._config = config;

        if (!config && !schema) return;

        if (!schema) {
            this.fire(new ErrorEvent(new Error(`Attempting to set config for a style without schema.`)));
            return;
        }

        this.options.clear();

        for (const id in schema) {
            let defaultExpression;
            let configExpression;

            const expression = schema[id].default;
            const expressionParsed = createExpression(expression);
            if (expressionParsed.result === 'success') {
                defaultExpression = expressionParsed.value.expression;
            }

            if (config && config[id] !== undefined) {
                const expressionParsed = createExpression(config[id]);
                if (expressionParsed.result === 'success') {
                    configExpression = expressionParsed.value.expression;
                }
            }

            const {minValue, maxValue, stepValue, type, values} = schema[id];

            if (defaultExpression) {
                this.options.set(id, {
                    default: defaultExpression,
                    value: configExpression,
                    minValue, maxValue, stepValue, type, values
                });
            } else {
                this.fire(new ErrorEvent(new Error(`No schema defined for config option "${id}".`)));
            }
        }
    }

    updateConfigDependencies() {
        for (const id of this._configDependentLayers) {
            const layer = this.getLayer(id);
            if (layer) {
                layer.possiblyEvaluateVisibility();
                this._updateLayer(layer);
            }
        }

        // If the root style uses the lights from the updated fragment,
        // update the configs in the corresponding light instances.
        if (this.ambientLight && this.ambientLight.scope === this.scope) {
            this.ambientLight.updateConfig(this.options);
        }

        if (this.directionalLight && this.directionalLight.scope === this.scope) {
            this.directionalLight.updateConfig(this.options);
        }

        this._changes.setDirty();
    }

    /**
     * Add a layer to the map style. The layer will be inserted before the layer with
     * ID `before`, or appended if `before` is omitted.
     * @param {Object | CustomLayerInterface} layerObject The style layer to add.
     * @param {string} [before] ID of an existing layer to insert before.
     * @param {Object} options Style setter options.
     * @returns {Map} The {@link Map} object.
     */
    addLayer(layerObject: LayerSpecification | CustomLayerInterface, before?: string, options: StyleSetterOptions = {}) {
        this._checkLoaded();

        const id = layerObject.id;

        if (this._layers[id]) {
            this.fire(new ErrorEvent(new Error(`Layer with id "${id}" already exists on this map`)));
            return;
        }

        let layer;
        if (layerObject.type === 'custom') {
            if (emitValidationErrors(this, validateCustomStyleLayer(layerObject))) return;
            layer = createStyleLayer(layerObject, this.options);
        } else {
            if (typeof layerObject.source === 'object') {
                this.addSource(id, layerObject.source);
                layerObject = clone(layerObject);
                layerObject = (extend(layerObject, {source: id}): any);
            }

            // this layer is not in the style.layers array, so we pass an impossible array index
            if (this._validate(validateLayer,
                `layers.${id}`, layerObject, {arrayIndex: -1}, options)) return;

            layer = createStyleLayer(layerObject, this.options);
            this._validateLayer(layer);

            layer.setEventedParent(this, {layer: {id}});
            this._serializedLayers[layer.id] = layer.serialize();
        }

        if (layer.isConfigDependent) this._configDependentLayers.add(layer.fqid);
        layer.setScope(this.scope);

        let index = this._order.length;
        if (before) {
            const beforeIndex = this._order.indexOf(before);
            if (beforeIndex === -1) {
                this.fire(new ErrorEvent(new Error(`Layer with id "${before}" does not exist on this map.`)));
                return;
            }

            // If the layer we're inserting doesn't have a slot,
            // or it has the same slot as the 'before' layer,
            // then we can insert the new layer before the existing one.
            const beforeLayer = this._layers[before];
            if (layer.slot === beforeLayer.slot) index = beforeIndex;
            else warnOnce(`Layer with id "${before}" has a different slot. Layers can only be rearranged within the same slot.`);
        }

        this._order.splice(index, 0, id);
        this._layerOrderChanged = true;

        this._layers[id] = layer;

        const sourceCache = this.getOwnLayerSourceCache(layer);
        const shadowsEnabled = !!this.directionalLight && this.directionalLight.shadowsEnabled();

        if (sourceCache && layer.canCastShadows() && shadowsEnabled) {
            sourceCache.castsShadows = true;
        }

        const removedLayer = this._changes.getRemovedLayer(layer);
        if (removedLayer && layer.source && sourceCache && layer.type !== 'custom') {
            // If, in the current batch, we have already removed this layer
            // and we are now re-adding it with a different `type`, then we
            // need to clear (rather than just reload) the underyling source's
            // tiles.  Otherwise, tiles marked 'reloading' will have buckets /
            // buffers that are set up for the _previous_ version of this
            // layer, causing, e.g.:
            // https://github.com/mapbox/mapbox-gl-js/issues/3633
            this._changes.discardLayerRemoval(layer);
            const fqid = makeFQID(layer.source, layer.scope);
            if (removedLayer.type !== layer.type) {
                this._changes.updateSourceCache(fqid, 'clear');
            } else {
                this._changes.updateSourceCache(fqid, 'reload');
                sourceCache.pause();
            }
        }

        this._updateLayer(layer);

        // $FlowFixMe[method-unbinding]
        if (layer.onAdd) {
            layer.onAdd(this.map);
        }

        layer.scope = this.scope;

        this.mergeLayers();
    }

    /**
     * Moves a layer to a different z-position. The layer will be inserted before the layer with
     * ID `before`, or appended if `before` is omitted.
     * @param {string} id  ID of the layer to move.
     * @param {string} [before] ID of an existing layer to insert before.
     */
    moveLayer(id: string, before?: string) {
        this._checkLoaded();

        const layer = this._checkLayer(id);
        if (!layer) return;

        if (id === before) {
            return;
        }

        const index = this._order.indexOf(id);
        this._order.splice(index, 1);

        let newIndex = this._order.length;
        if (before) {
            const beforeIndex = this._order.indexOf(before);
            if (beforeIndex === -1) {
                this.fire(new ErrorEvent(new Error(`Layer with id "${before}" does not exist on this map.`)));
                return;
            }

            // If the layer we're moving doesn't have a slot,
            // or it has the same slot as the 'before' layer,
            // then we can insert the new layer before the existing one.
            const beforeLayer = this._layers[before];
            if (layer.slot === beforeLayer.slot) newIndex = beforeIndex;
            else warnOnce(`Layer with id "${before}" has a different slot. Layers can only be rearranged within the same slot.`);
        }

        this._order.splice(newIndex, 0, id);

        this._changes.setDirty();
        this._layerOrderChanged = true;

        this.mergeLayers();
    }

    /**
     * Remove the layer with the given id from the style.
     *
     * If no such layer exists, an `error` event is fired.
     *
     * @param {string} id ID of the layer to remove.
     * @fires Map.event:error
     */
    removeLayer(id: string) {
        this._checkLoaded();

        const layer = this._checkLayer(id);
        if (!layer) return;

        layer.setEventedParent(null);

        const index = this._order.indexOf(id);
        this._order.splice(index, 1);

        delete this._layers[id];
        delete this._serializedLayers[id];

        this._changes.setDirty();
        this._layerOrderChanged = true;

        this._configDependentLayers.delete(layer.fqid);
        this._changes.removeLayer(layer);

        const sourceCache = this.getOwnLayerSourceCache(layer);

        if (sourceCache && sourceCache.castsShadows) {
            let shadowCastersLeft = false;
            for (const key in this._layers) {
                if (this._layers[key].source === layer.source && this._layers[key].canCastShadows()) {
                    shadowCastersLeft = true;
                    break;
                }
            }

            sourceCache.castsShadows = shadowCastersLeft;
        }

        if (layer.onRemove) {
            layer.onRemove(this.map);
        }

        this.mergeLayers();
    }

    /**
     * Return the style layer object with the given `id`.
     *
     * @param {string} id ID of the desired layer.
     * @returns {?StyleLayer} A layer, if one with the given `id` exists.
     */
    getOwnLayer(id: string): ?StyleLayer {
        return this._layers[id];
    }

    /**
     * Checks if a specific layer is present within the style.
     *
     * @param {string} id ID of the desired layer.
     * @returns {boolean} A boolean specifying if the given layer is present.
     */
    hasLayer(id: string): boolean {
        return id in this._mergedLayers;
    }

    /**
     * Checks if a specific layer type is present within the style.
     *
     * @param {string} type Type of the desired layer.
     * @returns {boolean} A boolean specifying if the given layer type is present.
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

        const layer = this._checkLayer(layerId);
        if (!layer) return;

        if (layer.minzoom === minzoom && layer.maxzoom === maxzoom) return;

        if (minzoom != null) {
            layer.minzoom = minzoom;
        }
        if (maxzoom != null) {
            layer.maxzoom = maxzoom;
        }
        this._updateLayer(layer);
    }

    setSlot(layerId: string, slot: ?string) {
        this._checkLoaded();

        const layer = this._checkLayer(layerId);
        if (!layer) return;

        if (layer.slot === slot) {
            return;
        }

        layer.slot = slot;
        this._updateLayer(layer);
    }

    setFilter(layerId: string, filter: ?FilterSpecification,  options: StyleSetterOptions = {}) {
        this._checkLoaded();

        const layer = this._checkLayer(layerId);
        if (!layer) return;

        if (deepEqual(layer.filter, filter)) {
            return;
        }

        if (filter === null || filter === undefined) {
            layer.filter = undefined;
            this._updateLayer(layer);
            return;
        }

        if (this._validate(validateFilter, `layers.${layer.id}.filter`, filter, {layerType: layer.type}, options)) {
            return;
        }

        layer.filter = clone(filter);
        this._updateLayer(layer);
    }

    /**
     * Get a layer's filter object.
     * @param {string} layerId The layer to inspect.
     * @returns {*} The layer's filter, if any.
     */
    getFilter(layerId: string): ?FilterSpecification {
        const layer = this._checkLayer(layerId);
        if (!layer) return;
        return clone(layer.filter);
    }

    setLayoutProperty(layerId: string, name: string, value: any,  options: StyleSetterOptions = {}) {
        this._checkLoaded();

        const layer = this._checkLayer(layerId);
        if (!layer) return;

        if (deepEqual(layer.getLayoutProperty(name), value)) return;

        layer.setLayoutProperty(name, value, options);
        if (layer.isConfigDependent) this._configDependentLayers.add(layer.fqid);
        this._updateLayer(layer);
    }

    /**
     * Get a layout property's value from a given layer.
     * @param {string} layerId The layer to inspect.
     * @param {string} name The name of the layout property.
     * @returns {*} The property value.
     */
    getLayoutProperty(layerId: string, name: string): ?PropertyValueSpecification<mixed> {
        const layer = this._checkLayer(layerId);
        if (!layer) return;
        return layer.getLayoutProperty(name);
    }

    setPaintProperty(layerId: string, name: string, value: any, options: StyleSetterOptions = {}) {
        this._checkLoaded();

        const layer = this._checkLayer(layerId);
        if (!layer) return;

        if (deepEqual(layer.getPaintProperty(name), value)) return;

        const requiresRelayout = layer.setPaintProperty(name, value, options);
        if (layer.isConfigDependent) this._configDependentLayers.add(layer.fqid);
        if (requiresRelayout) {
            this._updateLayer(layer);
        }

        this._changes.updatePaintProperties(layer);
    }

    getPaintProperty(layerId: string, name: string): void | TransitionSpecification | PropertyValueSpecification<mixed> {
        const layer = this._checkLayer(layerId);
        if (!layer) return;
        return layer.getPaintProperty(name);
    }

    setFeatureState(target: { source: string; sourceLayer?: string; id: string | number; }, state: Object) {
        this._checkLoaded();
        const sourceId = target.source;
        const sourceLayer = target.sourceLayer;

        const source = this._checkSource(sourceId);
        if (!source) return;

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

        const sourceCaches = this.getOwnSourceCaches(sourceId);
        for (const sourceCache of sourceCaches) {
            sourceCache.setFeatureState(sourceLayer, target.id, state);
        }
    }

    removeFeatureState(target: { source: string; sourceLayer?: string; id?: string | number; }, key?: string) {
        this._checkLoaded();
        const sourceId = target.source;

        const source = this._checkSource(sourceId);
        if (!source) return;

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

        const sourceCaches = this.getOwnSourceCaches(sourceId);
        for (const sourceCache of sourceCaches) {
            sourceCache.removeFeatureState(sourceLayer, target.id, key);
        }
    }

    getFeatureState(target: { source: string; sourceLayer?: string; id: string | number; }): ?FeatureStates {
        this._checkLoaded();
        const sourceId = target.source;
        const sourceLayer = target.sourceLayer;

        const source = this._checkSource(sourceId);
        if (!source) return;

        const sourceType = source.type;
        if (sourceType === 'vector' && !sourceLayer) {
            this.fire(new ErrorEvent(new Error(`The sourceLayer parameter must be provided for vector source types.`)));
            return;
        }
        if (target.id === undefined) {
            this.fire(new ErrorEvent(new Error(`The feature id parameter must be provided.`)));
        }

        const sourceCaches = this.getOwnSourceCaches(sourceId);
        return sourceCaches[0].getFeatureState(sourceLayer, target.id);
    }

    setTransition(transition: ?TransitionSpecification): Style {
        this.stylesheet.transition = extend({}, this.stylesheet.transition, transition);
        this.transition = this.stylesheet.transition;
        return this;
    }

    getTransition(): TransitionSpecification {
        return extend({}, this.stylesheet.transition);
    }

    serialize(): StyleSpecification {
        this._checkLoaded();

        const terrain = this.getTerrain();
        const scopedTerrain = terrain && this.terrain && this.terrain.scope === this.scope ?
            terrain :
            this.stylesheet.terrain;

        return filterObject({
            version: this.stylesheet.version,
            name: this.stylesheet.name,
            metadata: this.stylesheet.metadata,
            imports: this._serializeImports(),
            schema: this.stylesheet.schema,
            camera: this.stylesheet.camera,
            light: this.stylesheet.light,
            lights: this.stylesheet.lights,
            terrain: scopedTerrain,
            fog: this.stylesheet.fog,
            center: this.stylesheet.center,
            zoom: this.stylesheet.zoom,
            bearing: this.stylesheet.bearing,
            pitch: this.stylesheet.pitch,
            sprite: this.stylesheet.sprite,
            glyphs: this.stylesheet.glyphs,
            transition: this.stylesheet.transition,
            projection: this.stylesheet.projection,
            sources: this._serializeSources(),
            layers: this._serializeLayers(this._order)
        }, (value) => { return value !== undefined; });
    }

    _updateLayer(layer: StyleLayer) {
        this._changes.updateLayer(layer);
        const sourceCache = this.getLayerSourceCache(layer);
        const fqid = makeFQID(layer.source, layer.scope);
        const sourceCacheUpdates = this._changes.getUpdatedSourceCaches();
        if (layer.source && !sourceCacheUpdates[fqid] &&
            // Skip for raster layers (https://github.com/mapbox/mapbox-gl-js/issues/7865)
            sourceCache && sourceCache.getSource().type !== 'raster') {
            this._changes.updateSourceCache(fqid, 'reload');
            sourceCache.pause();
        }
        layer.invalidateCompiledFilter();
    }

    _flattenAndSortRenderedFeatures(sourceResults: Array<any>): Array<mixed> {
        // Feature order is complicated.
        // The order between features in two 2D layers is determined by layer order (subject to draped rendering modification).
        //  - if terrain/globe enabled layers are reordered in a drape-first, immediate-second manner
        //  - if terrain/globe disabled layers are not reordered
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

        const isLayer3D = (layerId: string) => this._mergedLayers[layerId].type === 'fill-extrusion';

        const order = this.order;

        const layerIndex = {};
        const features3D = [];
        for (let l = order.length - 1; l >= 0; l--) {
            const layerId = order[l];
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
        for (let l = order.length - 1; l >= 0; l--) {
            const layerId = order[l];

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

    queryRenderedFeatures(queryGeometry: PointLike | [PointLike, PointLike], params: QueryRenderedFeaturesParams, transform: Transform): Array<QueryResult> {
        if (params && params.filter) {
            this._validate(validateFilter, 'queryRenderedFeatures.filter', params.filter, null, params);
        }

        params.scope = this.scope;
        params.availableImages = this._availableImages;
        params.serializedLayers = this._serializedLayers;

        const includedSources = {};
        if (params && params.layers) {
            if (!Array.isArray(params.layers)) {
                this.fire(new ErrorEvent(new Error('parameters.layers must be an Array.')));
                return [];
            }
            for (const layerId of params.layers) {
                const layer = this._mergedLayers[layerId];
                if (!layer) {
                    // this layer is not in the style.layers array
                    this.fire(new ErrorEvent(new Error(`The layer '${layerId}' does not exist in the map's style and cannot be queried for features.`)));
                    return [];
                }
                includedSources[layer.source] = true;
            }
        }

        const sourceResults: Array<QueryResult> = [];
        const serializedLayers = params.serializedLayers || {};

        const has3DLayer = (params && params.layers) ?
            params.layers.some((layerId) => {
                const layer = this.getLayer(layerId);
                return layer && layer.is3D();
            }) : this.has3DLayers();

        const queryGeometryStruct = QueryGeometry.createFromScreenPoints(queryGeometry, transform);

        for (const id in this._mergedSourceCaches) {
            const source = this._mergedSourceCaches[id].getSource();
            if (!source || source.scope !== params.scope) continue;

            const sourceId = this._mergedSourceCaches[id].getSource().id;
            if (params.layers && !includedSources[sourceId]) continue;
            const showQueryGeometry = !!this.map._showQueryGeometry;
            sourceResults.push(
                queryRenderedFeatures(
                    this._mergedSourceCaches[id],
                    this._mergedLayers,
                    serializedLayers,
                    queryGeometryStruct,
                    (params: any),
                    transform,
                    has3DLayer,
                    showQueryGeometry)
            );
        }

        if (this.placement) {
            // If a placement has run, query against its CollisionIndex
            // for symbol results, and treat it as an extra source to merge
            sourceResults.push(
                queryRenderedSymbols(
                    this._mergedLayers,
                    serializedLayers,
                    // $FlowFixMe[method-unbinding]
                    this.getLayerSourceCache.bind(this),
                    queryGeometryStruct.screenGeometry,
                    (params: any),
                    this.placement.collisionIndex,
                    this.placement.retainedQueryData)
            );
        }

        return (this._flattenAndSortRenderedFeatures(sourceResults): any);
    }

    querySourceFeatures(sourceID: string, params: ?{sourceLayer: ?string, filter: ?Array<any>, validate?: boolean}): Array<QueryFeature> {
        if (params && params.filter) {
            this._validate(validateFilter, 'querySourceFeatures.filter', params.filter, null, params);
        }
        const sourceCaches = this.getOwnSourceCaches(sourceID);
        let results = [];
        for (const sourceCache of sourceCaches) {
            results = results.concat(querySourceFeatures(sourceCache, params));
        }
        return results;
    }

    addSourceType(name: string, SourceType: SourceClass, callback: Callback<void>): void {
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

    getFlatLight(): LightSpecification {
        return this.light.getLight();
    }

    setFlatLight(lightOptions: LightSpecification, id: string, options: StyleSetterOptions = {}) {
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

        const parameters = this._getTransitionParameters();

        this.light.setLight(lightOptions, id, options);
        this.light.updateTransitions(parameters);
    }

    getTerrain(): ?TerrainSpecification {
        return this.terrain && this.terrain.drapeRenderMode === DrapeRenderMode.elevated ? this.terrain.get() : null;
    }

    setTerrainForDraping() {
        const mockTerrainOptions = {source: '', exaggeration: 0};
        this.setTerrain(mockTerrainOptions, DrapeRenderMode.deferred);
    }

    // eslint-disable-next-line no-warning-comments
    // TODO: generic approach for root level property: light, terrain, skybox.
    // It is not done here to prevent rebasing issues.
    setTerrain(terrainOptions: ?TerrainSpecification, drapeRenderMode: number = DrapeRenderMode.elevated) {
        this._checkLoaded();

        // Disabling
        if (!terrainOptions) {
            delete this.terrain;

            if (terrainOptions === null) {
                this.stylesheet.terrain = null;
            } else {
                delete this.stylesheet.terrain;
            }

            this._force3DLayerUpdate();
            this._markersNeedUpdate = true;
            return;
        }

        let options: TerrainSpecification = terrainOptions;
        const isUpdating = terrainOptions.source == null;
        if (drapeRenderMode === DrapeRenderMode.elevated) {
            // Input validation and source object unrolling
            if (typeof options.source === 'object') {
                const id = 'terrain-dem-src';
                this.addSource(id, options.source);
                options = clone(options);
                options = extend(options, {source: id});
            }

            const validationOptions = extend({}, options);
            const validationProps = {};

            if (this.terrain && isUpdating) {
                validationOptions.source = this.terrain.get().source;

                const fragmentStyle = this.terrain ? this.getFragmentStyle(this.terrain.scope) : null;
                if (fragmentStyle) {
                    validationProps.style = fragmentStyle.serialize();
                }
            }

            if (this._validate(validateTerrain, 'terrain', validationOptions, validationProps)) {
                return;
            }
        }

        // Enabling
        if (!this.terrain || (this.terrain.scope !== this.scope && !isUpdating) || (this.terrain && drapeRenderMode !== this.terrain.drapeRenderMode)) {
            if (!options) return;
            this._createTerrain(options, drapeRenderMode);
            this.fire(new Event('data', {dataType: 'style'}));
        } else { // Updating
            const terrain = this.terrain;
            const currSpec = terrain.get();

            for (const name of Object.keys(styleSpec.terrain)) {
                // Fallback to use default style specification when the properties wasn't set
                if (!options.hasOwnProperty(name) && !!styleSpec.terrain[name].default) {
                    // $FlowFixMe[prop-missing]
                    options[name] = styleSpec.terrain[name].default;
                }
            }
            for (const key in terrainOptions) {
                if (!deepEqual(terrainOptions[key], currSpec[key])) {
                    terrain.set(terrainOptions, this.options);
                    this.stylesheet.terrain = terrainOptions;
                    const parameters = this._getTransitionParameters({duration: 0});
                    terrain.updateTransitions(parameters);
                    this.fire(new Event('data', {dataType: 'style'}));
                    break;
                }
            }
        }

        this.mergeTerrain();
        this.updateDrapeFirstLayers();
        this._markersNeedUpdate = true;
    }

    _createFog(fogOptions: FogSpecification) {
        const fog = this.fog = new Fog(fogOptions, this.map.transform);
        this.stylesheet.fog = fog.get();
        const parameters = this._getTransitionParameters({duration: 0});
        fog.updateTransitions(parameters);
    }

    _updateMarkersOpacity() {
        if (this.map._markers.length === 0) {
            return;
        }
        this.map._requestDomTask(() => {
            for (const marker of this.map._markers) {
                marker._evaluateOpacity();
            }
        });
    }

    getFog(): ?FogSpecification {
        return this.fog ? this.fog.get() : null;
    }

    setFog(fogOptions: FogSpecification) {
        this._checkLoaded();

        if (!fogOptions) {
            // Remove fog
            delete this.fog;
            delete this.stylesheet.fog;
            this._markersNeedUpdate = true;
            return;
        }

        if (!this.fog) {
            // Initialize Fog
            this._createFog(fogOptions);
        } else {
            // Updating fog
            const fog = this.fog;
            if (!deepEqual(fog.get(), fogOptions)) {
                fog.set(fogOptions);
                this.stylesheet.fog = fog.get();
                const parameters = this._getTransitionParameters({duration: 0});
                fog.updateTransitions(parameters);
            }
        }

        this._markersNeedUpdate = true;
    }

    _getTransitionParameters(transition: ?TransitionSpecification): TransitionParameters {
        return {
            now: browser.now(),
            transition: extend(this.transition, transition)
        };
    }

    updateDrapeFirstLayers() {
        if (!this.terrain) {
            return;
        }

        const draped = [];
        const nonDraped = [];
        for (const layerId in this._mergedLayers) {
            const layer = this._mergedLayers[layerId];
            if (this.isLayerDraped(layer)) {
                draped.push(layerId);
            } else {
                nonDraped.push(layerId);
            }
        }

        this._drapedFirstOrder = [];
        this._drapedFirstOrder.push(...draped);
        this._drapedFirstOrder.push(...nonDraped);
    }

    _createTerrain(terrainOptions: TerrainSpecification, drapeRenderMode: number) {
        const terrain = this.terrain = new Terrain(terrainOptions, drapeRenderMode, this.scope, this.options);

        // We need to update the stylesheet only for the elevated mode,
        // i.e., mock terrain shouldn't be propagated to the stylesheet
        if (drapeRenderMode === DrapeRenderMode.elevated) {
            this.stylesheet.terrain = terrainOptions;
        }

        this.mergeTerrain();
        this.updateDrapeFirstLayers();
        this._force3DLayerUpdate();
        const parameters = this._getTransitionParameters({duration: 0});
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

    _forceSymbolLayerUpdate() {
        for (const layerId in this._layers) {
            const layer = this._layers[layerId];
            if (layer.type === 'symbol') {
                this._updateLayer(layer);
            }
        }
    }

    _validate(validate: Validator, key: string, value: any, props: any, options: { validate?: boolean } = {}): boolean {
        if (options && options.validate === false) {
            return false;
        }

        // Fallback to the default glyphs URL if none is specified
        const style = extend({}, this.serialize());
        return emitValidationErrors(this, validate.call(validateStyle, extend({
            key,
            style,
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

        for (const layerId in this._mergedLayers) {
            const layer = this._mergedLayers[layerId];
            layer.setEventedParent(null);
        }

        for (const id in this._mergedSourceCaches) {
            this._mergedSourceCaches[id].clearTiles();
            this._mergedSourceCaches[id].setEventedParent(null);
        }

        this.setEventedParent(null);

        delete this.fog;
        delete this.terrain;
        delete this.ambientLight;
        delete this.directionalLight;

        // Shared managers should be removed only on removing the root style
        if (this.isRootStyle()) {
            this.imageManager.setEventedParent(null);
            this.modelManager.setEventedParent(null);
            this.dispatcher.remove();
        }
    }

    clearSource(id: string) {
        const sourceCaches = this.getSourceCaches(id);
        for (const sourceCache of sourceCaches) {
            sourceCache.clearTiles();
        }
    }

    clearSources() {
        for (const id in this._mergedSourceCaches) {
            this._mergedSourceCaches[id].clearTiles();
        }
    }

    reloadSource(id: string) {
        const sourceCaches = this.getSourceCaches(id);
        for (const sourceCache of sourceCaches) {
            sourceCache.resume();
            sourceCache.reload();
        }
    }

    reloadSources() {
        for (const source of this.getSources()) {
            if (source.reload) source.reload();
        }
    }

    updateSources(transform: Transform) {
        let lightDirection: ?Vec3;
        if (this.directionalLight) {
            lightDirection = shadowDirectionFromProperties(this.directionalLight);
        }
        for (const id in this._mergedSourceCaches) {
            this._mergedSourceCaches[id].update(transform, undefined, undefined, lightDirection);
        }
    }

    _generateCollisionBoxes() {
        for (const id in this._sourceCaches) {
            const sourceCache = this._sourceCaches[id];
            sourceCache.resume();
            sourceCache.reload();
        }
    }

    _updatePlacement(transform: Transform, showCollisionBoxes: boolean, fadeDuration: number, crossSourceCollisions: boolean, forceFullPlacement: boolean = false): boolean {
        let symbolBucketsChanged = false;
        let placementCommitted = false;

        const layerTiles = {};
        const layerTilesInYOrder = {};

        for (const layerId of this._mergedOrder) {
            const styleLayer = this._mergedLayers[layerId];
            if (styleLayer.type !== 'symbol') continue;

            const sourceId = makeFQID(styleLayer.source, styleLayer.scope);

            let sourceTiles = layerTiles[sourceId];

            if (!sourceTiles) {
                const sourceCache = this.getLayerSourceCache(styleLayer);
                if (!sourceCache) continue;
                const tiles = sourceCache.getRenderableIds(true).map((id) => sourceCache.getTileByID(id));
                layerTilesInYOrder[sourceId] = tiles.slice();
                sourceTiles = layerTiles[sourceId] =
                    tiles.sort((a, b) => (b.tileID.overscaledZ - a.tileID.overscaledZ) || (a.tileID.isLessThan(b.tileID) ? -1 : 1));
            }

            const layerBucketsChanged = this.crossTileSymbolIndex.addLayer(styleLayer, sourceTiles, transform.center.lng, transform.projection);
            symbolBucketsChanged = symbolBucketsChanged || layerBucketsChanged;
        }
        this.crossTileSymbolIndex.pruneUnusedLayers(this._mergedOrder);

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
            const fogState = this.fog && transform.projection.supportsFog ? this.fog.state : null;
            this.pauseablePlacement = new PauseablePlacement(transform, this._mergedOrder, forceFullPlacement, showCollisionBoxes, fadeDuration, crossSourceCollisions, this.placement, fogState, this._buildingIndex);
            this._layerOrderChanged = false;
        }

        if (this.pauseablePlacement.isDone()) {
            // the last placement finished running, but the next one hasn’t
            // started yet because of the `stillRecent` check immediately
            // above, so mark it stale to ensure that we request another
            // render frame
            this.placement.setStale();
        } else {
            this.pauseablePlacement.continuePlacement(this._mergedOrder, this._mergedLayers, layerTiles, layerTilesInYOrder);

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
            for (const layerId of this._mergedOrder) {
                const styleLayer = this._mergedLayers[layerId];
                if (styleLayer.type !== 'symbol') continue;
                this.placement.updateLayerOpacities(styleLayer, layerTiles[makeFQID(styleLayer.source, styleLayer.scope)]);
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

    // Fragments and merging

    addImport(importSpec: ImportSpecification): Style {
        this._checkLoaded();

        const imports = this.stylesheet.imports = this.stylesheet.imports || [];

        const index = imports.findIndex(({id}) => id === importSpec.id);
        if (index !== -1) {
            return this.fire(new ErrorEvent(new Error(`Import with id '${importSpec.id}' already exists in the map's style.`)));
        }

        imports.push(importSpec);
        this._loadImports([importSpec], true);
        return this;
    }

    setImportUrl(importId: string, url: string): Style {
        this._checkLoaded();

        const imports = this.stylesheet.imports || [];
        const index = this.getImportIndex(importId);
        if (index === -1) return this;

        imports[index].url = url;

        // Update related fragment
        const fragment = this.fragments[index];
        fragment.style = this._createFragmentStyle(imports[index]);

        fragment.style.on('style.import.load', () => this.mergeAll());
        fragment.style.loadURL(url);

        return this;
    }

    setImportData(importId: string, stylesheet: ?StyleSpecification): Style {
        this._checkLoaded();

        const index = this.getImportIndex(importId);
        const imports = this.stylesheet.imports || [];
        if (index === -1) return this;

        // Reload import from the URL if import data is unset
        if (!stylesheet) {
            delete imports[index].data;
            return this.setImportUrl(importId, imports[index].url);
        }

        // Update related fragment
        const fragment = this.fragments[index];
        fragment.style.setState(stylesheet);

        this._reloadImports();
        return this;
    }

    setImportConfig(importId: string, config: ?ConfigSpecification): Style {
        this._checkLoaded();

        const index = this.getImportIndex(importId);
        const imports = this.stylesheet.imports || [];
        if (index === -1) return this;

        if (config) {
            imports[index].config = config;
        } else {
            delete imports[index].config;
        }

        // Update related fragment
        const fragment = this.fragments[index];
        const schema = fragment.style.stylesheet && fragment.style.stylesheet.schema;

        fragment.config = config;
        fragment.style.setConfig(config, schema);
        fragment.style.updateConfigDependencies();

        return this;
    }

    removeImport(importId: string): Style {
        this._checkLoaded();

        const imports = this.stylesheet.imports || [];
        const index = this.getImportIndex(importId);
        if (index === -1) return this;

        imports.splice(index, 1);

        // Update related fragment
        const fragment = this.fragments[index];
        fragment.style._remove();
        this.fragments.splice(index, 1);

        this._reloadImports();
        return this;
    }

    getImportIndex(importId: string): number {
        const imports = this.stylesheet.imports || [];
        const index = imports.findIndex((importSpec) => importSpec.id === importId);
        if (index === -1) {
            this.fire(new ErrorEvent(new Error(`Import '${importId}' does not exist in the map's style and cannot be updated.`)));
        }
        return index;
    }

    /**
     * Return the style layer object with the given `id`.
     *
     * @param {string} id ID of the desired layer.
     * @returns {?StyleLayer} A layer, if one with the given `id` exists.
     */
    getLayer(id: string): ?StyleLayer {
        return this._mergedLayers[id];
    }

    getSources(): Source[] {
        const sources = [];
        for (const id in this._mergedOtherSourceCaches) {
            const sourceCache = this._mergedOtherSourceCaches[id];
            if (sourceCache) sources.push(sourceCache.getSource());
        }

        return sources;
    }

    /**
     * Get a source by ID.
     * @param {string} id ID of the desired source.
     * @returns {?Source} The source object.
     */
    getSource(id: string, scope: string): ?Source {
        const sourceCache = this.getSourceCache(id, scope);
        return sourceCache && sourceCache.getSource();
    }

    getLayerSource(layer: StyleLayer): ?Source {
        const sourceCache = this.getLayerSourceCache(layer);
        return sourceCache && sourceCache.getSource();
    }

    getSourceCache(id: string, scope: ?string): SourceCache | void {
        const fqid = makeFQID(id, scope);
        return this._mergedOtherSourceCaches[fqid];
    }

    getLayerSourceCache(layer: StyleLayer): SourceCache | void {
        const fqid = makeFQID(layer.source, layer.scope);
        return layer.type === 'symbol' ?
            this._mergedSymbolSourceCaches[fqid] :
            this._mergedOtherSourceCaches[fqid];
    }

    getSourceCaches(fqid: string): Array<SourceCache> {
        const sourceCaches = [];
        if (this._mergedOtherSourceCaches[fqid]) {
            sourceCaches.push(this._mergedOtherSourceCaches[fqid]);
        }
        if (this._mergedSymbolSourceCaches[fqid]) {
            sourceCaches.push(this._mergedSymbolSourceCaches[fqid]);
        }
        return sourceCaches;
    }

    updateSourceCaches() {
        const updatedSourceCaches = this._changes.getUpdatedSourceCaches();
        for (const fqid in updatedSourceCaches) {
            const action = updatedSourceCaches[fqid];
            assert(action === 'reload' || action === 'clear');
            if (action === 'reload') {
                this.reloadSource(fqid);
            } else if (action === 'clear') {
                this.clearSource(fqid);
            }
        }
    }

    updateLayers(parameters: EvaluationParameters) {
        const updatedPaintProps = this._changes.getUpdatedPaintProperties();
        for (const id of updatedPaintProps) {
            const layer = this.getLayer(id);
            if (layer) layer.updateTransitions(parameters);
        }
    }

    // Callbacks from web workers

    getImages(mapId: string, params: {icons: Array<string>, source: string, scope: string, tileID: OverscaledTileID, type: string}, callback: Callback<{[_: string]: StyleImage}>) {
        this.imageManager.getImages(params.icons, params.scope, callback);

        // Apply queued image changes before setting the tile's dependencies so that the tile
        // is not reloaded unecessarily. Without this forced update the reload could happen in cases
        // like this one:
        // - icons contains "my-image"
        // - imageManager.getImages(...) triggers `onstyleimagemissing`
        // - the user adds "my-image" within the callback
        // - addImage adds "my-image" to this._changes.changedImages
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

    getGlyphs(mapId: string, params: {stacks: {[_: string]: Array<number>}, scope: string}, callback: Callback<{[_: string]: {glyphs: {[_: number]: ?StyleGlyph}, ascender?: number, descender?: number}}>) {
        this.glyphManager.getGlyphs(params.stacks, params.scope, callback);
    }

    getResource(mapId: string, params: RequestParameters, callback: ResponseCallback<any>): Cancelable {
        return makeRequest(params, callback);
    }

    getOwnSourceCache(source: string): SourceCache | void {
        return this._otherSourceCaches[source];
    }

    getOwnLayerSourceCache(layer: StyleLayer): SourceCache | void {
        return layer.type === 'symbol' ?
            this._symbolSourceCaches[layer.source] :
            this._otherSourceCaches[layer.source];
    }

    getOwnSourceCaches(source: string): Array<SourceCache> {
        const sourceCaches = [];
        if (this._otherSourceCaches[source]) {
            sourceCaches.push(this._otherSourceCaches[source]);
        }
        if (this._symbolSourceCaches[source]) {
            sourceCaches.push(this._symbolSourceCaches[source]);
        }
        return sourceCaches;
    }

    _isSourceCacheLoaded(source: string): boolean {
        const sourceCaches = this.getOwnSourceCaches(source);
        if (sourceCaches.length === 0) {
            this.fire(new ErrorEvent(new Error(`There is no source with ID '${source}'`)));
            return false;
        }
        return sourceCaches.every(sc => sc.loaded());
    }

    has3DLayers(): boolean {
        return this._has3DLayers;
    }

    hasSymbolLayers(): boolean {
        return this._hasSymbolLayers;
    }

    hasCircleLayers(): boolean {
        return this._hasCircleLayers;
    }

    _clearWorkerCaches() {
        this.dispatcher.broadcast('clearCaches');
    }

    destroy() {
        this._clearWorkerCaches();
        if (this.terrainSetForDrapingOnly()) {
            delete this.terrain;
            delete this.stylesheet.terrain;
        }
    }
}

Style.getSourceType = getSourceType;
Style.setSourceType = setSourceType;
Style.registerForPluginStateChange = registerForPluginStateChange;

export default Style;
