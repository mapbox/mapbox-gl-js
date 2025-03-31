import assert from 'assert';
import murmur3 from 'murmurhash-js';
import {Event, ErrorEvent, Evented} from '../util/evented';
import StyleChanges from './style_changes';
import createStyleLayer from './create_style_layer';
import loadSprite from './load_sprite';
import ImageManager from '../render/image_manager';
import GlyphManager, {LocalGlyphMode} from '../render/glyph_manager';
import Light from './light';
import Terrain, {DrapeRenderMode} from './terrain';
import Fog from './fog';
import Snow from './snow';
import Rain from './rain';
import {pick, clone, extend, deepEqual, filterObject, cartesianPositionToSpherical, warnOnce} from '../util/util';
import {getJSON, getReferrer, makeRequest, ResourceType} from '../util/ajax';
import {isMapboxURL} from '../util/mapbox_url';
import {stripQueryParameters} from '../util/url';
import browser from '../util/browser';
import Dispatcher from '../util/dispatcher';
import Lights from '../../3d-style/style/lights';
import {getProperties as getAmbientProps} from '../../3d-style/style/ambient_light_properties';
import {getProperties as getDirectionalProps} from '../../3d-style/style/directional_light_properties';
import {createExpression} from '../style-spec/expression/index';
import {
    validateStyle,
    validateLayoutProperty,
    validatePaintProperty,
    validateSource,
    validateLayer,
    validateFilter,
    validateTerrain,
    validateLights,
    validateModel,
    emitValidationErrors as _emitValidationErrors
} from './validate_style';
import {QueryGeometry} from '../style/query_geometry';
import {
    create as createSource,
    getType as getSourceType,
    setType as setSourceType,
} from '../source/source';
import {queryRenderedFeatures, queryRenderedSymbols, querySourceFeatures, shouldSkipFeatureVariant} from '../source/query_features';
import SourceCache from '../source/source_cache';
import BuildingIndex from '../source/building_index';
import styleSpec from '../style-spec/reference/latest';
import {getGlobalWorkerPool as getWorkerPool} from '../util/worker_pool_factory';
import deref from '../style-spec/deref';
import emptyStyle from '../style-spec/empty';
import diffStyles, {operations as diffOperations} from '../style-spec/diff';
import {
    registerForPluginStateChange,
    evented as rtlTextPluginEvented,
    triggerPluginCompletionEvent
} from '../source/rtl_text_plugin';
import PauseablePlacement from './pauseable_placement';
import CrossTileSymbolIndex from '../symbol/cross_tile_symbol_index';
import {validateCustomStyleLayer} from './style_layer/custom_style_layer';
import {isFQID, makeFQID, getNameFromFQID, getScopeFromFQID} from '../util/fqid';
import {shadowDirectionFromProperties} from '../../3d-style/render/shadow_renderer';
import ModelManager from '../../3d-style/render/model_manager';
import {DEFAULT_MAX_ZOOM, DEFAULT_MIN_ZOOM} from '../geo/transform';
import {RGBAImage} from '../util/image';
import {evaluateColorThemeProperties} from '../util/lut';
import EvaluationParameters from './evaluation_parameters';
import {expandSchemaWithIndoor} from './indoor_manager';
import featureFilter from '../style-spec/feature_filter/index';
import {TargetFeature} from '../util/vectortile_to_geojson';
import {loadIconset} from './load_iconset';
import {ImageId} from '../style-spec/expression/types/image_id';
import {Iconset} from './iconset';

import type GeoJSONSource from '../source/geojson_source';
import type {ReplacementSource} from "../../3d-style/source/replacement_source";
import type Painter from '../render/painter';
import type StyleLayer from './style_layer';
import type SymbolStyleLayer from '../style/style_layer/symbol_style_layer';
import type {
    ColorThemeSpecification,
    LayerSpecification,
    LayoutSpecification,
    PaintSpecification,
    FilterSpecification,
    StyleSpecification,
    ImportSpecification,
    LightSpecification,
    SourceSpecification,
    TerrainSpecification,
    LightsSpecification,
    FlatLightSpecification,
    FogSpecification,
    SnowSpecification,
    RainSpecification,
    ProjectionSpecification,
    TransitionSpecification,
    ConfigSpecification,
    SchemaSpecification,
    CameraSpecification,
    FeaturesetsSpecification,
    IconsetSpecification
} from '../style-spec/types';
import type {Callback} from '../types/callback';
import type {StyleImage, StyleImageMap} from './style_image';
import type Transform from '../geo/transform';
import type {Map as MapboxMap} from '../ui/map';
import type {MapEvents} from '../ui/events';
import type {vec3} from 'gl-matrix';
import type {LightProps as Directional} from '../../3d-style/style/directional_light_properties';
import type {LightProps as Ambient} from '../../3d-style/style/ambient_light_properties';
import type {Placement} from '../symbol/placement';
import type {Cancelable} from '../types/cancelable';
import type {RequestParameters, ResponseCallback} from '../util/ajax';
import type {CustomLayerInterface} from './style_layer/custom_style_layer';
import type {Validator, ValidationErrors} from './validate_style';
import type {OverscaledTileID} from '../source/tile_id';
import type {FeatureState, StyleExpression} from '../style-spec/expression/index';
import type {PointLike} from '../types/point-like';
import type {ISource, Source, SourceClass} from '../source/source';
import type {TransitionParameters, ConfigOptions} from './properties';
import type {QrfQuery, QrfTarget, QueryResult} from '../source/query_features';
import type {GeoJSONFeature, FeaturesetDescriptor, TargetDescriptor, default as Feature} from '../util/vectortile_to_geojson';
import type {LUT} from '../util/lut';
import type {SerializedExpression} from '../style-spec/expression/expression';
import type {FontStacks, GlyphMap} from '../render/glyph_manager';
import type {RasterizeImagesParameters, RasterizedImageMap} from '../render/image_manager';
import type {StringifiedImageId} from '../style-spec/expression/types/image_id';

export type QueryRenderedFeaturesParams = {
    layers?: string[];
    filter?: FilterSpecification;
    validate?: boolean;
    target?: never;
};

export type QueryRenderedFeaturesetParams = {
    target: TargetDescriptor;
    filter?: FilterSpecification;
    validate?: boolean;
    layers?: never;
};

export type GetImagesParameters = {
    images: ImageId[];
    scope: string;
    source: string;
    tileID: OverscaledTileID;
    type: 'icons' | 'patterns';
};

export type SetImagesParameters = {
    images: ImageId[];
    scope: string;
};

export type GetGlyphsParameters = {
    scope: string;
    stacks: FontStacks;
    uid?: number;
};

// We're skipping validation errors with the `source.canvas` identifier in order
// to continue to allow canvas sources to be added at runtime/updated in
// smart setStyle (see https://github.com/mapbox/mapbox-gl-js/pull/6424):
const emitValidationErrors = (evented: Evented, errors?: ValidationErrors | null) =>
    _emitValidationErrors(evented, errors && errors.filter(error => error.identifier !== 'source.canvas'));

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
    'setSnow',
    'setRain',
    'setProjection',
    'setCamera',
    'addImport',
    'removeImport',
    'updateImport'
    // 'setGlyphs',
    // 'setSprite',
]);

const ignoredDiffOperations = pick(diffOperations, [
    'setCenter',
    'setZoom',
    'setBearing',
    'setPitch'
]);

/**
 * Layer types that has no features and are not queryable with QRF API.
 */
const featurelessLayerTypes = new Set(['background', 'sky', 'slot', 'custom']);

const empty = emptyStyle();

type AnyLayerSource = {
    source?: LayerSpecification['source'] | SourceSpecification
}

/**
 * Helper type that represents user provided layer in addLayer method.
 * @private
 */
export type AnyLayer = Omit<LayerSpecification, 'source'> & AnyLayerSource | CustomLayerInterface;

export type FeatureSelector = {
    id: string | number;
    source: string;
    sourceLayer?: string;
}

export type SourceSelector = {
    id?: string | number;
    source: string;
    sourceLayer?: string;
}

export type StyleOptions = {
    validate?: boolean;
    localFontFamily?: string | null | undefined;
    localIdeographFontFamily?: string;
    dispatcher?: Dispatcher;
    imageManager?: ImageManager;
    glyphManager?: GlyphManager;
    modelManager?: ModelManager;
    styleChanges?: StyleChanges;
    configOptions?: ConfigOptions;
    colorThemeOverride?: ColorThemeSpecification;
    scope?: string;
    importDepth?: number;
    importsCache?: Map<string, StyleSpecification>;
    resolvedImports?: Set<string>;
    config?: ConfigSpecification | null | undefined;
    initialConfig?: {
        [key: string]: ConfigSpecification;
    };
    configDependentLayers?: Set<string>;
};

export type StyleSetterOptions = {
    validate?: boolean;
    isInitialLoad?: boolean;
};

export type Fragment = {
    id: string;
    style: Style;
    config?: ConfigSpecification | null | undefined;
};

type StyleColorTheme = {
    lut: LUT | null;
    lutLoading: boolean;
    lutLoadingCorrelationID: number;
    colorTheme: ColorThemeSpecification | null;
    colorThemeOverride: ColorThemeSpecification | null;
};

type FeaturesetSelector = {
    layerId: string;
    namespace?: string;
    properties?: Record<string, StyleExpression>;
    uniqueFeatureID: boolean;
};

const MAX_IMPORT_DEPTH = 5;
const defaultTransition = {duration: 300, delay: 0};

/**
 * @private
 */
class Style extends Evented<MapEvents> {
    map: MapboxMap;
    stylesheet: StyleSpecification;
    dispatcher: Dispatcher;
    imageManager: ImageManager;
    glyphManager: GlyphManager;
    modelManager: ModelManager;
    ambientLight: Lights<Ambient> | null | undefined;
    directionalLight: Lights<Directional> | null | undefined;
    light: Light;
    terrain: Terrain | null | undefined;
    disableElevatedTerrain: boolean | null | undefined;
    fog: Fog | null | undefined;
    snow: Snow | null | undefined;
    rain: Rain | null | undefined;
    camera: CameraSpecification;
    _styleColorTheme: StyleColorTheme;
    _styleColorThemeForScope: {
        [_: string]: StyleColorTheme;
    };
    transition: TransitionSpecification;
    projection: ProjectionSpecification;

    // Serializable identifier of style, which we use for telemetry
    globalId: string | null;

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
    _mergedLayers: Record<string, StyleLayer>;
    _mergedSlots: Array<string>;
    _mergedSourceCaches: Record<string, SourceCache>;
    _mergedOtherSourceCaches: Record<string, SourceCache>;
    _mergedSymbolSourceCaches: Record<string, SourceCache>;
    _clipLayerPresent: boolean;

    _featuresetSelectors: Record<string, Array<FeaturesetSelector>>;

    _request: Cancelable | null | undefined;
    _spriteRequest: Cancelable | null | undefined;
    _layers: {
        [_: string]: StyleLayer;
    };
    _order: Array<string>;
    _drapedFirstOrder: Array<string>;
    _sourceCaches: {
        [_: string]: SourceCache;
    };
    _otherSourceCaches: {
        [_: string]: SourceCache;
    };
    _symbolSourceCaches: {
        [_: string]: SourceCache;
    };
    _loaded: boolean;
    _shouldPrecompile: boolean;
    _precompileDone: boolean;
    _rtlTextPluginCallback: any;
    _changes: StyleChanges;
    _optionsChanged: boolean;
    _layerOrderChanged: boolean;
    _availableImages: ImageId[];
    _markersNeedUpdate: boolean;
    _brightness: number | null | undefined;
    _configDependentLayers: Set<string>;
    _config: ConfigSpecification | null | undefined;
    _initialConfig: {
        [key: string]: ConfigSpecification;
    } | null | undefined;
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

        this.globalId = null;

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
        this._clipLayerPresent = false;

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
            this.imageManager = new ImageManager(this.map._spriteFormat);
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
        this._sourceCaches = {};
        this._otherSourceCaches = {};
        this._symbolSourceCaches = {};
        this._loaded = false;
        this._precompileDone = false;
        this._shouldPrecompile = false;
        this._availableImages = [];
        this._order = [];
        this._markersNeedUpdate = false;

        this.options = options.configOptions ? options.configOptions : new Map();
        this._configDependentLayers = options.configDependentLayers ? options.configDependentLayers : new Set();
        this._config = options.config;
        this._styleColorTheme = {
            lut: null,
            lutLoading: false,
            lutLoadingCorrelationID: 0,
            colorTheme: null,
            colorThemeOverride: options.colorThemeOverride
        };
        this._styleColorThemeForScope = {};
        this._initialConfig = options.initialConfig;

        this.dispatcher.broadcast('setReferrer', getReferrer());

        const self = this;
        this._rtlTextPluginCallback = Style.registerForPluginStateChange((event) => {
            const state = {
                pluginStatus: event.pluginStatus,
                pluginURL: event.pluginURL
            };
            self.dispatcher.broadcast('syncRTLPluginState', state, (err, results: boolean[]) => {
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

    load(style: StyleSpecification | string | null): Style {
        if (!style) {
            return this;
        }

        if (typeof style === 'string') {
            this.loadURL(style);
        } else {
            this.loadJSON(style);
        }

        return this;
    }

    _getGlobalId(loadedStyle?: StyleSpecification | string | null): string | null {
        if (!loadedStyle) {
            return null;
        }

        if (typeof loadedStyle === 'string') {
            if (isMapboxURL(loadedStyle)) {
                return loadedStyle;
            }

            const url = stripQueryParameters(loadedStyle);

            if (!url.startsWith('http')) {
                try {
                    return new URL(url, location.href).toString();
                } catch (_e: any) {
                    return url;
                }
            }

            return url;
        }

        return `json://${murmur3(JSON.stringify(loadedStyle))}`;
    }

    _diffStyle(style: StyleSpecification | string, onStarted: (err: Error | null, isUpdateNeeded: boolean) => void, onFinished?: () => void) {
        this.globalId = this._getGlobalId(style);

        const handleStyle = (json: StyleSpecification, callback: (err: Error | null, isUpdateNeeded: boolean) => void) => {
            try {
                callback(null, this.setState(json, onFinished));
            } catch (e: any) {
                callback(e, false);
            }
        };

        if (typeof style === 'string') {
            const url = this.map._requestManager.normalizeStyleURL(style);
            const request = this.map._requestManager.transformRequest(url, ResourceType.Style);
            getJSON(request, (error?: Error | null, json?: StyleSpecification) => {
                if (error) {
                    this.fire(new ErrorEvent(error));
                } else if (json) {
                    handleStyle(json, onStarted);
                }
            });
        } else if (typeof style === 'object') {
            handleStyle(style, onStarted);
        }
    }

    loadURL(
        url: string,
        options: {
            validate?: boolean;
            accessToken?: string;
        } = {},
    ): void {
        this.fire(new Event('dataloading', {dataType: 'style'}));

        const validate = typeof options.validate === 'boolean' ?
            options.validate : !isMapboxURL(url);

        this.globalId = this._getGlobalId(url);
        url = this.map._requestManager.normalizeStyleURL(url, options.accessToken);
        this.resolvedImports.add(url);

        const cachedImport = this.importsCache.get(url);
        if (cachedImport) return this._load(cachedImport, validate);

        const request = this.map._requestManager.transformRequest(url, ResourceType.Style);
        this._request = getJSON(request, (error?: Error, json?: StyleSpecification) => {
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

        this.globalId = this._getGlobalId(json);
        this._request = browser.frame(() => {
            this._request = null;
            this._load(json, options.validate !== false);
        });
    }

    loadEmpty() {
        this.fire(new Event('dataloading', {dataType: 'style'}));
        this._load(empty, false);
    }

    _loadImports(
        imports: Array<ImportSpecification>,
        validate: boolean,
        beforeId?: string | null,
    ): Promise<any> {
        // We take the root style into account when calculating the import depth.
        if (this.importDepth >= MAX_IMPORT_DEPTH - 1) {
            warnOnce(`Style doesn't support nesting deeper than ${MAX_IMPORT_DEPTH}`);
            return Promise.resolve();
        }

        const waitForStyles = [];
        for (const importSpec of imports) {
            const style = this._createFragmentStyle(importSpec);

            // Merge everything and update layers after the import style is settled.
            const waitForStyle = new Promise((resolve) => {
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

                // Don't expose global ID for internal style to ensure
                // that we don't send in telemetry Standard style as import
                // because we already use it directly
                if (this._isInternalStyle(json)) {
                    style.globalId = null;
                }
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

            if (beforeId) {
                const beforeIndex = this.fragments.findIndex(({id}) => id === beforeId);

                assert(beforeIndex !== -1, `Import with id "${beforeId}" does not exist on this map`);

                this.fragments = this.fragments
                    .slice(0, beforeIndex)
                    .concat(fragment)
                    .concat(this.fragments.slice(beforeIndex));
            } else {
                this.fragments.push(fragment);
            }

        }

        return Promise.allSettled(waitForStyles);
    }

    getImportGlobalIds(style: Style = this, ids: Set<string> = new Set()): string[] {
        for (const fragment of style.fragments) {
            if (fragment.style.globalId) {
                ids.add(fragment.style.globalId);
            }
            this.getImportGlobalIds(fragment.style, ids);
        }

        return [...ids.values()];
    }

    _createFragmentStyle(importSpec: ImportSpecification): Style {
        const scope = this.scope ? makeFQID(importSpec.id, this.scope) : importSpec.id;

        // Merge import config and initial config from the Map constructor
        let config;
        const initialConfig = this._initialConfig && this._initialConfig[scope];
        if (importSpec.config || initialConfig) {
            config = extend({}, importSpec.config, initialConfig);
        }

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
            config,
            configOptions: this.options,
            colorThemeOverride: importSpec["color-theme"],
            configDependentLayers: this._configDependentLayers
        });

        // Bubble all events fired by the style to the map.
        style.setEventedParent(this.map, {style});

        return style;
    }

    _reloadImports() {
        this.mergeAll();
        this._updateMapProjection();
        this.updateConfigDependencies();
        this.map._triggerCameraUpdate(this.camera);

        this.dispatcher.broadcast('setLayers', {
            layers: this._serializeLayers(this._order),
            scope: this.scope,
            options: this.options
        });

        this._shouldPrecompile = this.map._precompilePrograms && this.isRootStyle();
    }

    _isInternalStyle(json: StyleSpecification): boolean {
        return this.isRootStyle() && (json.fragment || (!!json.schema && json.fragment !== false));
    }

    _load(json: StyleSpecification, validate: boolean) {
        const schema = json.indoor ? expandSchemaWithIndoor(json.schema) : json.schema;

        // This style was loaded as a root style, but it is marked as a fragment and/or has a schema. We instead load
        // it as an import with the well-known ID "basemap" to make sure that we don't expose the internals.
        if (this._isInternalStyle(json)) {
            const basemap = {id: 'basemap', data: json, url: ''};
            const style = extend({}, empty, {imports: [basemap]});
            this._load(style, validate);
            return;
        }

        this.updateConfig(this._config, schema);

        if (validate && emitValidationErrors(this, validateStyle(json))) {
            return;
        }

        this._loaded = true;
        this.stylesheet = clone(json);

        const proceedWithStyleLoad = () => {
            for (const id in json.sources) {
                this.addSource(id, json.sources[id], {validate: false, isInitialLoad: true});
            }

            if (json.iconsets) {
                for (const id in json.iconsets) {
                    this.addIconset(id, json.iconsets[id]);
                }
            }

            if (json.sprite) {
                this._loadIconset(json.sprite);
            } else {
                this.imageManager.setLoaded(true, this.scope);
                this.dispatcher.broadcast('spriteLoaded', {scope: this.scope, isLoaded: true});
            }

            this.setGlyphsUrl(json.glyphs);

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
            for (const layer of layers) {
                const styleLayer = createStyleLayer(layer, this.scope, this._styleColorTheme.lut, this.options);
                if (styleLayer.configDependencies.size !== 0) this._configDependentLayers.add(styleLayer.fqid);
                styleLayer.setEventedParent(this, {layer: {id: styleLayer.id}});
                this._layers[styleLayer.id] = styleLayer;

                const sourceCache = this.getOwnLayerSourceCache(styleLayer);
                const shadowsEnabled = !!this.directionalLight && this.directionalLight.shadowsEnabled();

                if (sourceCache && styleLayer.canCastShadows() && shadowsEnabled) {
                    sourceCache.castsShadows = true;
                }
            }

            if (this.stylesheet.featuresets) {
                this.setFeaturesetSelectors(this.stylesheet.featuresets);
            }

            if (this.stylesheet.models) {
                this.modelManager.addModels(this.stylesheet.models, this.scope);
            }

            const terrain = this.stylesheet.terrain;
            if (terrain) {
                this.checkCanvasFingerprintNoise();
                if (!this.disableElevatedTerrain && !this.terrainSetForDrapingOnly()) {
                    this._createTerrain(terrain, DrapeRenderMode.elevated);
                }
            }

            if (this.stylesheet.fog) {
                this._createFog(this.stylesheet.fog);
            }

            if (this.stylesheet.snow) {
                this._createSnow(this.stylesheet.snow);
            }

            if (this.stylesheet.rain) {
                this._createRain(this.stylesheet.rain);
            }

            if (this.stylesheet.transition) {
                this.setTransition(this.stylesheet.transition);
            }

            this.fire(new Event('data', {dataType: 'style'}));

            const isRootStyle = this.isRootStyle();

            if (json.imports) {
                this._loadImports(json.imports, validate).then(() => {
                    this._reloadImports();
                    this.fire(new Event(isRootStyle ? 'style.load' : 'style.import.load'));
                });
            } else {
                this._reloadImports();
                this.fire(new Event(isRootStyle ? 'style.load' : 'style.import.load'));
            }
        };

        this._styleColorTheme.colorTheme = this.stylesheet['color-theme'];
        const colorTheme = this._styleColorTheme.colorThemeOverride ? this._styleColorTheme.colorThemeOverride : this._styleColorTheme.colorTheme;
        if (colorTheme) {
            const data = this._evaluateColorThemeData(colorTheme);
            this._loadColorTheme(data).then(() => {
                proceedWithStyleLoad();
            }).catch((e) => {
                warnOnce(`Couldn\'t load color theme from the stylesheet: ${e}`);
                proceedWithStyleLoad();
            });
        } else {
            this._styleColorTheme.lut = null;
            proceedWithStyleLoad();
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
        let snow;
        let rain;
        let projection;
        let transition;
        let camera;
        const styleColorThemeForScope: {
            [_: string]: StyleColorTheme;
        } = {};

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

            if (style.stylesheet.snow && style.snow != null)
                snow = style.snow;

            if (style.stylesheet.rain && style.rain != null)
                rain = style.rain;

            if (style.stylesheet.camera != null)
                camera = style.stylesheet.camera;

            if (style.stylesheet.projection != null)
                projection = style.stylesheet.projection;

            if (style.stylesheet.transition != null)
                transition = style.stylesheet.transition;

            styleColorThemeForScope[style.scope] = style._styleColorTheme;
        });

        this.light = light;
        this.ambientLight = ambientLight;
        this.directionalLight = directionalLight;
        this.fog = fog;
        this.snow = snow;
        this.rain = rain;
        this._styleColorThemeForScope = styleColorThemeForScope;

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

    _prioritizeTerrain(
        prevTerrain?: Terrain | null,
        nextTerrain?: Terrain | null,
        nextTerrainSpec?: TerrainSpecification | null,
    ): Terrain | null | undefined {
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
        const mergedSourceCaches: Record<string, SourceCache> = {};
        const mergedOtherSourceCaches: Record<string, SourceCache> = {};
        const mergedSymbolSourceCaches: Record<string, SourceCache> = {};

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
        const slots: Record<string, StyleLayer[]> = {};
        const mergedOrder: StyleLayer[] = [];
        const mergedLayers: Record<string, StyleLayer> = {};

        this._mergedSlots = [];
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
                    this._mergedSlots.push(slotName);
                } else {
                    const fqid = makeFQID(layer.id, layer.scope);
                    this._mergedOrder.push(fqid);
                    mergedLayers[fqid] = layer;

                    // Typed layer bookkeeping
                    if (layer.is3D(!!this.terrain)) this._has3DLayers = true;
                    if (layer.type === 'circle') this._hasCircleLayers = true;
                    if (layer.type === 'symbol') this._hasSymbolLayers = true;
                    if (layer.type === 'clip') this._clipLayerPresent = true;
                }
            }
        };

        sort(mergedOrder);

        // Sort symbols with occlusion opacity to be rendered after all 3D layers
        this._mergedOrder.sort((layerName1: string, layerName2: string) => {
            const l1 = mergedLayers[layerName1];
            const l2 = mergedLayers[layerName2];

            if ((l1 as SymbolStyleLayer).hasInitialOcclusionOpacityProperties) {
                if (l2.is3D(!!this.terrain)) {
                    return 1;
                }
                return 0;
            }

            if (l1.is3D(!!this.terrain)) {
                if ((l2 as SymbolStyleLayer).hasInitialOcclusionOpacityProperties) {
                    return -1;
                }
                return 0;
            }

            return 0;
        });

        this._mergedLayers = mergedLayers;
        this.updateDrapeFirstLayers();
        this._buildingIndex.processLayersChanged();
    }

    terrainSetForDrapingOnly(): boolean {
        return !!this.terrain && this.terrain.drapeRenderMode === DrapeRenderMode.deferred;
    }

    getCamera(): CameraSpecification | null | undefined {
        return this.stylesheet.camera;
    }

    setCamera(camera: CameraSpecification): Style {
        this.stylesheet.camera = extend({}, this.stylesheet.camera, camera);
        this.camera = this.stylesheet.camera;
        return this;
    }

    _evaluateColorThemeData(theme: ColorThemeSpecification): string | null {
        if (!theme.data) {
            return null;
        }
        const properties = evaluateColorThemeProperties(this.scope, theme, this.options);
        return properties.get('data');
    }

    _loadColorTheme(inputData: string | null): Promise<void> {
        this._styleColorTheme.lutLoading = true;
        this._styleColorTheme.lutLoadingCorrelationID += 1;
        const correlationID = this._styleColorTheme.lutLoadingCorrelationID;
        return new Promise((resolve, reject) => {
            const dataURLPrefix = 'data:image/png;base64,';

            if (!inputData || inputData.length === 0) {
                this._styleColorTheme.lut = null;
                this._styleColorTheme.lutLoading = false;
                resolve();
                return;
            }

            let colorThemeData = inputData;
            if (!colorThemeData.startsWith(dataURLPrefix)) {
                colorThemeData = dataURLPrefix + colorThemeData;
            }

            // Reserved image name, which references the LUT in the image manager
            const styleLutName = ImageId.from('mapbox-reserved-lut');

            const lutImage = new Image();
            lutImage.src = colorThemeData;
            lutImage.onerror = () => {
                this._styleColorTheme.lutLoading = false;
                reject(new Error('Failed to load image data'));

            };
            lutImage.onload = () => {
                if (this._styleColorTheme.lutLoadingCorrelationID !== correlationID) {
                    resolve();
                    return;
                }
                this._styleColorTheme.lutLoading = false;
                const {width, height, data} = browser.getImageData(lutImage);
                if (height > 32) {
                    reject(new Error('The height of the image must be less than or equal to 32 pixels.'));
                    return;
                }
                if (width !== height * height) {
                    reject(new Error('The width of the image must be equal to the height squared.'));
                    return;
                }

                if (this.getImage(styleLutName)) {
                    this.removeImage(styleLutName);
                }
                this.addImage(styleLutName, {data: new RGBAImage({width, height}, data), pixelRatio: 1, sdf: false, usvg: false, version: 0});

                const image = this.imageManager.getImage(styleLutName, this.scope);
                if (!image) {
                    reject(new Error('Missing LUT image.'));
                } else {
                    this._styleColorTheme.lut = {
                        image: image.data,
                        data: inputData
                    };
                    resolve();
                }
            };
        });
    }

    getLut(scope: string): LUT | null {
        const styleColorTheme = this._styleColorThemeForScope[scope];
        return styleColorTheme ? styleColorTheme.lut : null;
    }

    setProjection(projection?: ProjectionSpecification | null) {
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
            const hasTerrain = (this.getTerrain() || this.stylesheet.terrain) && !this.disableElevatedTerrain;
            if (!hasTerrain) {
                this.setTerrainForDraping();
            }
        } else if (this.terrainSetForDrapingOnly()) {
            this.setTerrain(null, DrapeRenderMode.deferred);
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
                    this.imageManager.addImage(ImageId.from(id), this.scope, images[id]);
                }
            }

            this.imageManager.setLoaded(true, this.scope);
            this._availableImages = this.imageManager.listImages(this.scope);
            const params: SetImagesParameters = {scope: this.scope, images: this._availableImages};
            this.dispatcher.broadcast('setImages', params);
            this.dispatcher.broadcast('spriteLoaded', {scope: this.scope, isLoaded: true});
            this.fire(new Event('data', {dataType: 'style'}));
        });
    }

    addIconset(iconsetId: string, iconset: IconsetSpecification) {
        if (iconset.type === 'sprite') {
            this._loadSprite(iconset.url);
            return;
        }

        const source = this.getOwnSource(iconset.source);
        if (!source) {
            this.fire(new ErrorEvent(new Error(`Source "${iconset.source}" as specified by iconset "${iconsetId}" does not exist and cannot be used as an iconset source`)));
            return;
        }

        if (source.type !== 'raster-array') {
            this.fire(new ErrorEvent(new Error(`Source "${iconset.source}" as specified by iconset "${iconsetId}" is not a "raster-array" source and cannot be used as an iconset source`)));
            return;
        }

        this.imageManager.createIconset(this.scope, iconsetId);

        const sourceIconset = new Iconset(iconsetId, this);
        source.addIconset(iconsetId, sourceIconset);
    }

    _loadIconset(url: string) {
        // If the sprite is not a mapbox URL, we load
        // raster sprite if icon_set is not specified explicitly.
        if ((!isMapboxURL(url) && this.map._spriteFormat !== 'icon_set') || this.map._spriteFormat === 'raster') {
            this._loadSprite(url);
            return;
        }

        const isFallbackExists = this.map._spriteFormat === 'auto';

        this._spriteRequest = loadIconset(url, this.map._requestManager, (err, images) => {
            this._spriteRequest = null;
            if (err) {
                // Try to fallback to raster sprite
                if (isFallbackExists) {
                    this._loadSprite(url);
                } else {
                    this.fire(new ErrorEvent(err));
                }
            } else if (images) {
                for (const id in images) {
                    this.imageManager.addImage(ImageId.from(id), this.scope, images[id]);
                }
            }

            this.imageManager.setLoaded(true, this.scope);
            this._availableImages = this.imageManager.listImages(this.scope);
            const params: SetImagesParameters = {scope: this.scope, images: this._availableImages};
            this.dispatcher.broadcast('setImages', params);
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

        if (this.imageManager.hasPatternsInFlight())
            return false;

        if (!this.modelManager.isLoaded())
            return false;

        if (this._styleColorTheme.lutLoading)
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

    _serializeSources(): {
        [sourceId: string]: SourceSpecification;
        } {
        const sources: Record<string, any> = {};
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

    hasSnowTransition(): boolean {
        if (!this.snow) return false;
        return this.snow.hasTransition();
    }

    hasRainTransition(): boolean {
        if (!this.rain) return false;
        return this.rain.hasTransition();
    }

    hasTransitions(): boolean {
        if (this.hasLightTransitions()) {
            return true;
        }

        if (this.hasFogTransition()) {
            return true;
        }

        if (this.hasSnowTransition()) {
            return true;
        }

        if (this.hasRainTransition()) {
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

    /**
     * Returns active order for when terrain or globe are enabled (when draping is enabled).
     * @param drapingEnabled {boolean} speficy if order is requested for draping enabled.
     * @private
     */
    _getOrder(drapingEnabled: boolean): Array<string> {
        return drapingEnabled ? this.order : this._mergedOrder;
    }

    isLayerDraped(layer: StyleLayer): boolean {
        if (!this.terrain) return false;
        return layer.isDraped(this.getLayerSourceCache(layer));
    }

    _checkLoaded(): void {
        if (!this._loaded) {
            throw new Error('Style is not done loading');
        }
    }

    _checkLayer(layerId: string): StyleLayer | null | undefined {
        const layer = this.getOwnLayer(layerId);
        if (!layer) {
            this.fire(new ErrorEvent(new Error(`The layer '${layerId}' does not exist in the map's style.`)));
            return;
        }
        return layer;
    }

    _checkSource(sourceId: string): Source | null | undefined {
        const source = this.getOwnSource(sourceId);
        if (!source) {
            this.fire(new ErrorEvent(new Error(`The source '${sourceId}' does not exist in the map's style.`)));
            return;
        }
        return source;
    }

    precompilePrograms(layer: StyleLayer, parameters: EvaluationParameters) {
        const painter = this.map.painter;

        if (!painter) {
            return;
        }

        for (let i = (layer.minzoom || DEFAULT_MIN_ZOOM); i < (layer.maxzoom || DEFAULT_MAX_ZOOM); i++) {
            const programIds = layer.getProgramIds();
            if (!programIds) continue;

            for (const programId of programIds) {
                const params = layer.getDefaultProgramParams(programId, parameters.zoom, this._styleColorTheme.lut);
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
        let layersUpdated = false;
        if (this._changes.isDirty()) {
            const updatesByScope = this._changes.getLayerUpdatesByScope();
            for (const scope in updatesByScope) {
                const {updatedIds, removedIds} = updatesByScope[scope];
                if (updatedIds || removedIds) {
                    this._updateWorkerLayers(scope, updatedIds, removedIds);
                    layersUpdated = true;
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

            if (this.snow) {
                this.snow.updateTransitions(parameters);
            }

            if (this.rain) {
                this.rain.updateTransitions(parameters);
            }

            this._changes.reset();
        }

        const sourcesUsedBefore: Record<string, boolean> = {};

        for (const sourceId in this._mergedSourceCaches) {
            const sourceCache = this._mergedSourceCaches[sourceId];
            sourcesUsedBefore[sourceId] = sourceCache.used;
            sourceCache.used = false;
            sourceCache.tileCoverLift = 0.0;
        }

        for (const layerId of this._mergedOrder) {
            const layer = this._mergedLayers[layerId];
            layer.recalculate(parameters, this._availableImages);
            if (!layer.isHidden(parameters.zoom)) {
                const sourceCache = this.getLayerSourceCache(layer);
                if (sourceCache) {
                    sourceCache.used = true;
                    // Select the highest elevation across all layers that are rendered with this source
                    sourceCache.tileCoverLift = Math.max(sourceCache.tileCoverLift, layer.tileCoverLift());
                }
            }

            if (!this._precompileDone && this._shouldPrecompile) {
                if ('requestIdleCallback' in window) {
                    requestIdleCallback(() => {
                        this.precompilePrograms(layer, parameters);
                    });
                } else {
                    this.precompilePrograms(layer, parameters);
                }
            }
        }

        // eslint-disable-next-line
        // TODO: use only the iconsets that are actually used by the layers
        for (const sourceId in this._mergedSourceCaches) {
            const sourceCache = this._mergedSourceCaches[sourceId];
            if (!sourceCache) continue;

            const source = sourceCache._source;
            if (source.type !== 'raster-array') continue;
            // @ts-expect-error - iconsets is missing in ISource
            if (source.iconsets) sourceCache.used = true;
        }

        if (this._shouldPrecompile) {
            this._precompileDone = true;
        }

        if (this.terrain && layersUpdated) {
            // Changed layers (layout properties only) could have become drapeable.
            this.mergeLayers();
        }

        for (const sourceId in sourcesUsedBefore) {
            const sourceCache = this._mergedSourceCaches[sourceId];
            if (sourcesUsedBefore[sourceId] !== sourceCache.used) {
                const source = sourceCache.getSource() as ISource;
                source.fire(new Event('data', {sourceDataType: 'visibility', dataType:'source', sourceId: sourceCache.getSource().id}));
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

        if (this.snow) {
            this.snow.recalculate(parameters);
        }

        if (this.rain) {
            this.rain.recalculate(parameters);
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
    setState(nextState: StyleSpecification, onFinish?: () => void): boolean {
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

        const changesPromises = [];

        changes.forEach((op) => {
            changesPromises.push((this as any)[op.command].apply(this, op.args));
        });

        if (onFinish) {
            Promise.all(changesPromises).then(onFinish);
        }

        this.stylesheet = nextState;
        this.mergeAll();

        this.dispatcher.broadcast('setLayers', {
            layers: this._serializeLayers(this._order),
            scope: this.scope,
            options: this.options
        });

        return true;
    }

    addImage(id: ImageId, image: StyleImage): this {
        if (this.getImage(id) && !id.iconsetId) {
            return this.fire(new ErrorEvent(new Error('An image with this name already exists.')));
        }
        this.imageManager.addImage(id, this.scope, image);
        this._afterImageUpdated(id);
        return this;
    }

    updateImage(id: ImageId, image: StyleImage, performSymbolLayout = false) {
        this.imageManager.updateImage(id, this.scope, image);
        if (performSymbolLayout) {
            this._afterImageUpdated(id);
        }
    }

    getImage(id: ImageId): StyleImage | null | undefined {
        return this.imageManager.getImage(id, this.scope);
    }

    removeImage(id: ImageId): this {
        if (!this.getImage(id)) {
            return this.fire(new ErrorEvent(new Error('No image with this name exists.')));
        }
        this.imageManager.removeImage(id, this.scope);
        this._afterImageUpdated(id);
        return this;
    }

    _afterImageUpdated(id: ImageId) {
        this._availableImages = this.imageManager.listImages(this.scope);
        this._changes.updateImage(id);
        const params: SetImagesParameters = {scope: this.scope, images: this._availableImages};
        this.dispatcher.broadcast('setImages', params);
        this.fire(new Event('data', {dataType: 'style'}));
    }

    listImages(): ImageId[] {
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

    addSource(id: string, source: SourceSpecification & {collectResourceTiming?: boolean}, options: StyleSetterOptions = {}): void {
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

        if (this.map && this.map._collectResourceTiming) source.collectResourceTiming = true;
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

        if (sourceInstance.onAdd)
            sourceInstance.onAdd(this.map);

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
        if (source.onRemove)
            source.onRemove(this.map);
        this._changes.setDirty();
        return this;
    }

    /**
     * Set the data of a GeoJSON source, given its ID.
     * @param {string} id ID of the source.
     * @param {GeoJSON|string} data GeoJSON source.
     */
    setGeoJSONSourceData(id: string, data: GeoJSON.GeoJSON | string) {
        this._checkLoaded();

        assert(this.getOwnSource(id) !== undefined, 'There is no source with this ID');
        const geojsonSource: GeoJSONSource = this.getOwnSource(id);
        assert(geojsonSource.type === 'geojson');

        geojsonSource.setData(data);
        this._changes.setDirty();
    }

    /**
     * Get a source by ID.
     * @param {string} id ID of the desired source.
     * @returns {?Source} The source object.
     */
    getOwnSource<T extends Source>(id: string): T | undefined {
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

    areTilesLoaded(): boolean {
        const sources = this._mergedSourceCaches;
        for (const id in sources) {
            const source = sources[id];
            const tiles = source._tiles;
            for (const t in tiles) {
                const tile = tiles[t];
                if (!(tile.state === 'loaded' || tile.state === 'errored')) return false;
            }
        }
        return true;
    }

    setLights(lights?: Array<LightsSpecification> | null) {
        this._checkLoaded();

        if (!lights) {
            delete this.ambientLight;
            delete this.directionalLight;
            return;
        }

        const transitionParameters = this._getTransitionParameters();

        for (const light of lights) {
            // @ts-expect-error - TS2554 - Expected 4-5 arguments, but got 3.
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
                    this.ambientLight = new Lights<Ambient>(light, getAmbientProps(), this.scope, this.options);
                }
                break;
            case 'directional':
                if (this.directionalLight) {
                    const directionalLight = this.directionalLight;
                    directionalLight.set(light);
                    directionalLight.updateTransitions(transitionParameters);
                } else {
                    this.directionalLight = new Lights<Directional>(light, getDirectionalProps(), this.scope, this.options);
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

    calculateLightsBrightness(): number | null | undefined {
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

        const directionalColor = directional.properties.get('color').toRenderColor(null).toArray01();
        const directionalIntensity = directional.properties.get('intensity');
        const direction = directional.properties.get('direction');

        const sphericalDirection = cartesianPositionToSpherical(direction.x, direction.y, direction.z);
        const polarIntensity = 1.0 - sphericalDirection[2] / 90.0;

        const directionalBrightness = relativeLuminance(directionalColor) * directionalIntensity * polarIntensity;

        const ambientColor = ambient.properties.get('color').toRenderColor(null).toArray01();
        const ambientIntensity = ambient.properties.get('intensity');

        const ambientBrightness = relativeLuminance(ambientColor) * ambientIntensity;

        const brightness = (directionalBrightness + ambientBrightness) / 2.0;

        // Reduces decimal places to prevent bucket re-evaluation which was caused by small precision differences
        // Since in most places we directly compare the previously evaluated brightness values
        return Number(brightness.toFixed(6));
    }

    getBrightness(): number | null | undefined {
        return this._brightness;
    }

    getLights(): Array<LightsSpecification> | null | undefined {
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

    /**
     * Returns the fragment style associated with the provided fragmentId.
     * If no fragmentId is provided, returns itself.
     */
    getFragmentStyle(fragmentId?: string): Style | undefined {
        if (!fragmentId) return this;

        if (isFQID(fragmentId)) {
            const scope = getScopeFromFQID(fragmentId);
            const fragment = this.fragments.find(({id}) => id === scope);
            if (!fragment) throw new Error(`Style import '${fragmentId}' not found`);
            const name = getNameFromFQID(fragmentId);
            return fragment.style.getFragmentStyle(name);
        } else {
            const fragment = this.fragments.find(({id}) => id === fragmentId);
            return fragment ? fragment.style : undefined;
        }
    }

    setFeaturesetSelectors(featuresets?: FeaturesetsSpecification) {
        if (!featuresets) return;

        const sourceInfoMap: { [sourceInfo: string]: string } = {};
        // Helper to create consistent keys
        const createKey = (sourceId: string, sourcelayerId: string = '') => `${sourceId}::${sourcelayerId}`;

        this._featuresetSelectors = {};
        for (const featuresetId in featuresets) {
            const featuresetSelectors: FeaturesetSelector[] = this._featuresetSelectors[featuresetId] = [];
            for (const selector of featuresets[featuresetId].selectors) {
                if (selector.featureNamespace) {
                    const layer = this.getOwnLayer(selector.layer);
                    if (!layer) {
                        warnOnce(`Layer is undefined for selector: ${selector.layer}`);
                        continue;
                    }
                    const sourceKey = createKey(layer.source, layer.sourceLayer);
                    // Based on spec, "If the underlying source is the same for multiple selectors within a featureset, the same featureNamespace should be used across those selectors."
                    if (sourceKey in sourceInfoMap && sourceInfoMap[sourceKey] !== selector.featureNamespace)  {
                        warnOnce(`"featureNamespace ${selector.featureNamespace} of featureset ${featuresetId}'s selector is not associated to the same source, skip this selector`);
                        continue;
                    }
                    sourceInfoMap[sourceKey] = selector.featureNamespace;
                }
                let properties;
                if (selector.properties) {
                    for (const name in selector.properties) {
                        const expression = createExpression(selector.properties[name]);
                        if (expression.result === 'success') {
                            properties = properties || {};
                            properties[name] = expression.value;
                        }
                    }
                }

                featuresetSelectors.push({layerId: selector.layer, namespace: selector.featureNamespace, properties, uniqueFeatureID: selector._uniqueFeatureID});
            }
        }
    }

    /**
     * Returns the featureset descriptors associated with a style fragment.
     * If no fragmentId is provided, returns own featureset descriptors.
     */
    getFeaturesetDescriptors(fragmentId?: string): Array<FeaturesetDescriptor> {
        const style = this.getFragmentStyle(fragmentId);
        if (!style || !style.stylesheet.featuresets) return [];

        const featuresetDescriptors: FeaturesetDescriptor[] = [];
        for (const id in style.stylesheet.featuresets) {
            featuresetDescriptors.push({featuresetId: id, importId: style.scope ? style.scope : undefined});
        }

        return featuresetDescriptors;
    }

    /**
     * Returns the layers associated with a featureset in the style fragment.
     * If no fragmentId is provided, returns the layers associated with own featuresets.
     */
    getFeaturesetLayers(featuresetId: string, fragmentId?: string): Array<StyleLayer> {
        const style = this.getFragmentStyle(fragmentId);
        const featuresets = style.stylesheet.featuresets;
        if (!featuresets || !featuresets[featuresetId]) {
            this.fire(new ErrorEvent(new Error(`The featureset '${featuresetId}' does not exist in the map's style and cannot be queried.`)));
            return [];
        }

        const layers = [];
        for (const selector of featuresets[featuresetId].selectors) {
            const layer = style.getOwnLayer(selector.layer);
            if (layer) layers.push(layer);
        }

        return layers;
    }

    getConfigProperty(fragmentId: string, key: string): SerializedExpression | null {
        const fragmentStyle = this.getFragmentStyle(fragmentId);
        if (!fragmentStyle) return null;
        const fqid = makeFQID(key, fragmentStyle.scope);
        const expressions = fragmentStyle.options.get(fqid);
        const expression = expressions ? expressions.value || expressions.default : null;
        return expression ? expression.serialize() : null;
    }

    setConfigProperty(fragmentId: string, key: string, value: unknown) {
        const fragmentStyle = this.getFragmentStyle(fragmentId);
        if (!fragmentStyle) return;

        const schema = fragmentStyle.stylesheet.indoor ? expandSchemaWithIndoor(fragmentStyle.stylesheet.schema) : fragmentStyle.stylesheet.schema;
        if (!schema || !schema[key]) return;

        const expressionParsed = createExpression(value);
        if (expressionParsed.result !== 'success') {
            emitValidationErrors(this, expressionParsed.value);
            return;
        }

        const expression = expressionParsed.value.expression;

        const fqid = makeFQID(key, fragmentStyle.scope);
        const expressions = fragmentStyle.options.get(fqid);
        if (!expressions) return;

        let defaultExpression;
        const {minValue, maxValue, stepValue, type, values} = schema[key];
        const defaultExpressionParsed = createExpression(schema[key].default);
        if (defaultExpressionParsed.result === 'success') {
            defaultExpression = defaultExpressionParsed.value.expression;
        }

        if (!defaultExpression) {
            this.fire(new ErrorEvent(new Error(`No schema defined for the config option "${key}" in the "${fragmentId}" fragment.`)));
            return;
        }

        this.options.set(fqid, Object.assign({}, expressions, {
            value: expression,
            default: defaultExpression,
            minValue, maxValue, stepValue, type, values
        }));

        this.updateConfigDependencies(key);
    }

    getConfig(fragmentId: string): ConfigSpecification | null | undefined {
        const fragmentStyle = this.getFragmentStyle(fragmentId);
        if (!fragmentStyle) return null;

        const schema = fragmentStyle.stylesheet.schema;
        if (!schema) return null;

        const config: Record<string, any> = {};
        for (const key in schema) {
            const fqid = makeFQID(key, fragmentStyle.scope);
            const expressions = fragmentStyle.options.get(fqid);
            const expression = expressions ? expressions.value || expressions.default : null;
            config[key] = expression ? expression.serialize() : null;
        }

        return config;
    }

    setConfig(fragmentId: string, config?: ConfigSpecification | null) {
        const fragmentStyle = this.getFragmentStyle(fragmentId);
        if (!fragmentStyle) return;

        const schema = fragmentStyle.stylesheet.schema;
        fragmentStyle.updateConfig(config, schema);

        this.updateConfigDependencies();
    }

    getSchema(fragmentId: string): SchemaSpecification | null | undefined {
        const fragmentStyle = this.getFragmentStyle(fragmentId);
        if (!fragmentStyle) return null;
        return fragmentStyle.stylesheet.schema;
    }

    setSchema(fragmentId: string, schema: SchemaSpecification) {
        const fragmentStyle = this.getFragmentStyle(fragmentId);
        if (!fragmentStyle) return;

        fragmentStyle.stylesheet.schema = schema;
        fragmentStyle.updateConfig(fragmentStyle._config, schema);

        this.updateConfigDependencies();
    }

    updateConfig(config?: ConfigSpecification | null, schema?: SchemaSpecification | null) {
        this._config = config;

        if (!config && !schema) return;

        if (!schema) {
            this.fire(new ErrorEvent(new Error(`Attempting to set config for a style without schema.`)));
            return;
        }

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
                const fqid = makeFQID(id, this.scope);
                this.options.set(fqid, {
                    default: defaultExpression,
                    value: configExpression,
                    minValue, maxValue, stepValue, type, values
                });
            } else {
                this.fire(new ErrorEvent(new Error(`No schema defined for config option "${id}".`)));
            }
        }
    }

    updateConfigDependencies(configKey?: string) {
        for (const id of this._configDependentLayers) {
            const layer = this.getLayer(id);
            if (layer) {
                if (configKey && !layer.configDependencies.has(configKey)) {
                    continue;
                }

                layer.possiblyEvaluateVisibility();
                this._updateLayer(layer);
            }
        }

        if (this.ambientLight) {
            this.ambientLight.updateConfig(this.options);
        }

        if (this.directionalLight) {
            this.directionalLight.updateConfig(this.options);
        }

        if (this.fog) {
            this.fog.updateConfig(this.options);
        }

        if (this.snow) {
            this.snow.updateConfig(this.options);
        }

        if (this.rain) {
            this.rain.updateConfig(this.options);
        }

        this.forEachFragmentStyle((style: Style) => {
            const colorTheme = style._styleColorTheme.colorThemeOverride ? style._styleColorTheme.colorThemeOverride : style._styleColorTheme.colorTheme;
            if (colorTheme) {
                const data = style._evaluateColorThemeData(colorTheme);
                if ((!style._styleColorTheme.lut && data !== '') || (style._styleColorTheme.lut && data !== style._styleColorTheme.lut.data)) {
                    style.setColorTheme(colorTheme);
                }
            }
        });

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
    addLayer(layerObject: AnyLayer, before?: string, options: StyleSetterOptions = {}) {
        this._checkLoaded();

        const id = layerObject.id;

        if (this._layers[id]) {
            this.fire(new ErrorEvent(new Error(`Layer with id "${id}" already exists on this map`)));
            return;
        }

        let layer;
        if (layerObject.type === 'custom') {
            if (emitValidationErrors(this, validateCustomStyleLayer(layerObject))) return;
            layer = createStyleLayer(layerObject, this.scope, this._styleColorTheme.lut, this.options);
        } else {
            if (typeof layerObject.source === 'object') {
                this.addSource(id, layerObject.source);
                layerObject = clone(layerObject);
                layerObject = (extend(layerObject, {source: id}));
            }

            // this layer is not in the style.layers array, so we pass an impossible array index
            if (this._validate(validateLayer,
                `layers.${id}`, layerObject, {arrayIndex: -1}, options)) return;

            layer = createStyleLayer(layerObject as LayerSpecification, this.scope, this._styleColorTheme.lut, this.options);
            this._validateLayer(layer);

            layer.setEventedParent(this, {layer: {id}});
        }

        if (layer.configDependencies.size !== 0) this._configDependentLayers.add(layer.fqid);

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
    getOwnLayer<T extends StyleLayer>(id: string): T | undefined {
        return this._layers[id] as T;
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

    setLayerZoomRange(layerId: string, minzoom?: number | null, maxzoom?: number | null) {
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

    getSlots(): string[] {
        this._checkLoaded();
        return this._mergedSlots;
    }

    setSlot(layerId: string, slot?: string | null) {
        this._checkLoaded();

        const layer = this._checkLayer(layerId);
        if (!layer) return;

        if (layer.slot === slot) {
            return;
        }

        layer.slot = slot;
        this._updateLayer(layer);
    }

    setFilter(layerId: string, filter?: FilterSpecification | null,  options: StyleSetterOptions = {}) {
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
    getFilter(layerId: string): FilterSpecification | null | undefined {
        const layer = this._checkLayer(layerId);
        if (!layer) return;
        return clone(layer.filter);
    }

    setLayoutProperty<T extends keyof LayoutSpecification>(layerId: string, name: T, value: LayoutSpecification[T], options: StyleSetterOptions = {}) {
        this._checkLoaded();

        const layer = this._checkLayer(layerId);
        if (!layer) return;

        if (deepEqual(layer.getLayoutProperty(name), value)) return;

        if (value !== null && value !== undefined && !(options && options.validate === false)) {
            const key = `layers.${layerId}.layout.${name}`;
            const errors = emitValidationErrors(layer, validateLayoutProperty.call(validateStyle, {
                key,
                layerType: layer.type,
                objectKey: name,
                value,
                styleSpec,
                // Workaround for https://github.com/mapbox/mapbox-gl-js/issues/2407
                style: {glyphs: true, sprite: true}
            }));
            if (errors) {
                return;
            }
        }

        layer.setLayoutProperty(name, value);
        if (layer.configDependencies.size !== 0) this._configDependentLayers.add(layer.fqid);
        this._updateLayer(layer);
    }

    /**
     * Get a layout property's value from a given layer.
     * @param {string} layerId The layer to inspect.
     * @param {string} name The name of the layout property.
     * @returns {*} The property value.
     */
    getLayoutProperty<T extends keyof LayoutSpecification>(layerId: string, name: T): LayoutSpecification[T] | undefined {
        const layer = this._checkLayer(layerId);
        if (!layer) return;
        return layer.getLayoutProperty(name);
    }

    setPaintProperty<T extends keyof PaintSpecification>(layerId: string, name: T, value: PaintSpecification[T], options: StyleSetterOptions = {}) {
        this._checkLoaded();

        const layer = this._checkLayer(layerId);
        if (!layer) return;

        if (deepEqual(layer.getPaintProperty(name), value)) return;

        if (value !== null && value !== undefined && !(options && options.validate === false)) {
            const key = `layers.${layerId}.paint.${name}`;
            const errors = emitValidationErrors(layer, validatePaintProperty.call(validateStyle, {
                key,
                layerType: layer.type,
                objectKey: name,
                value,
                styleSpec
            }));
            if (errors) {
                return;
            }
        }

        const requiresRelayout = layer.setPaintProperty(name, value);
        if (layer.configDependencies.size !== 0) this._configDependentLayers.add(layer.fqid);
        if (requiresRelayout) {
            this._updateLayer(layer);
        }

        this._changes.updatePaintProperties(layer);
    }

    getPaintProperty<T extends keyof PaintSpecification>(layerId: string, name: T): PaintSpecification[T] | undefined {
        const layer = this._checkLayer(layerId);
        if (!layer) return;
        return layer.getPaintProperty(name);
    }

    setFeatureState(target: FeatureSelector | GeoJSONFeature | TargetFeature, state: FeatureState) {
        this._checkLoaded();

        // target is TargetFeature
        if ('target' in target) {
            if ('featuresetId' in target.target) {
                const {featuresetId, importId} = target.target;
                const fragment = this.getFragmentStyle(importId);
                const layers = fragment.getFeaturesetLayers(featuresetId);
                for (const {source, sourceLayer} of layers) {
                    fragment.setFeatureState({id: target.id, source, sourceLayer}, state);
                }
            } else if ('layerId' in target.target) {
                const {layerId} = target.target;
                const layer = this.getLayer(layerId);
                this.setFeatureState({id: target.id, source: layer.source, sourceLayer: layer.sourceLayer}, state);
            }

            return;
        }

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

    removeFeatureState(target: FeatureSelector | SourceSelector | GeoJSONFeature | TargetFeature, key?: string) {
        this._checkLoaded();

        // target is TargetFeature
        if ('target' in target) {
            if ('featuresetId' in target.target) {
                const {featuresetId, importId} = target.target;
                const fragment = this.getFragmentStyle(importId);
                const layers = fragment.getFeaturesetLayers(featuresetId);
                for (const {source, sourceLayer} of layers) {
                    fragment.removeFeatureState({id: target.id, source, sourceLayer}, key);
                }
            } else if ('layerId' in target.target) {
                const {layerId} = target.target;
                const layer = this.getLayer(layerId);
                this.removeFeatureState({id: target.id, source: layer.source, sourceLayer: layer.sourceLayer}, key);
            }

            return;
        }

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

    getFeatureState(target: FeatureSelector | GeoJSONFeature | TargetFeature): FeatureState | null | undefined {
        this._checkLoaded();

        // target is TargetFeature
        if ('target' in target) {
            let finalState: FeatureState;
            if ('featuresetId' in target.target) {
                const {featuresetId, importId} = target.target;
                const fragment = this.getFragmentStyle(importId);
                const layers = fragment.getFeaturesetLayers(featuresetId);
                for (const {source, sourceLayer} of layers) {
                    const state = fragment.getFeatureState({id: target.id, source, sourceLayer});
                    // There is possibility that the same feature id exists in multiple sources, and the states of the
                    // features must be consistent through all the sources
                    if (state && !finalState) {
                        finalState = state;
                    } else if (!deepEqual(finalState, state)) {
                        this.fire(new ErrorEvent(new Error(`The same feature id exists in multiple sources in the featureset, but their feature states are not consistent through the sources.`)));
                        return;
                    }
                }
            } else if ('layerId' in target.target) {
                const {layerId} = target.target;
                const layer = this.getLayer(layerId);
                finalState = this.getFeatureState({id: target.id, source: layer.source, sourceLayer: layer.sourceLayer});
            }

            return finalState;
        }

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

    setTransition(transition?: TransitionSpecification | null): Style {
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
            fragment: this.stylesheet.fragment,
            iconsets: this.stylesheet.iconsets,
            imports: this._serializeImports(),
            schema: this.stylesheet.schema,
            camera: this.stylesheet.camera,
            light: this.stylesheet.light,
            lights: this.stylesheet.lights,
            terrain: scopedTerrain,
            fog: this.stylesheet.fog,
            snow: this.stylesheet.snow,
            rain: this.stylesheet.rain,
            center: this.stylesheet.center,
            "color-theme": this.stylesheet["color-theme"],
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

    _updateFilteredLayers(filter: (layer: StyleLayer) => boolean) {
        for (const layer of Object.values(this._mergedLayers)) {
            if (filter(layer)) {
                this._updateLayer(layer);
            }
        }
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

    _flattenAndSortRenderedFeatures(sourceResults: Array<QueryResult>): Array<Feature> {
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

        const isLayer3D = (layerId: string) => this._mergedLayers[layerId].is3D(!!this.terrain);

        const order = this.order;

        const layerIndex: Record<string, any> = {};
        const features3D: Array<{feature: Feature; featureIndex: number; intersectionZ: number}> = [];
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

        const features: Feature[] = [];

        for (let l = order.length - 1; l >= 0; l--) {
            const layerId = order[l];

            if (isLayer3D(layerId)) {
                // add all 3D features that are in or above the current layer
                for (let i = features3D.length - 1; i >= 0; i--) {
                    const topmost3D = features3D[i].feature;
                    if (topmost3D.layer && layerIndex[topmost3D.layer.id] < l) break;
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

    queryRenderedFeatures(queryGeometry: PointLike | [PointLike, PointLike], params: QueryRenderedFeaturesParams | undefined, transform: Transform): GeoJSONFeature[] {
        let filter;
        if (params && !Array.isArray(params) && params.filter) {
            this._validate(validateFilter, 'queryRenderedFeatures.filter', params.filter, null, params);
            filter = featureFilter(params.filter);
        }

        const queries: Record<string, QrfQuery & {has3DLayers?: boolean}> = {};

        const addLayerToQuery = (styleLayer: StyleLayer) => {
            // Skip layers that don't have features.
            if (featurelessLayerTypes.has(styleLayer.type)) return;

            const sourceCache = this.getOwnLayerSourceCache(styleLayer);
            assert(sourceCache, 'queryable layers must have a source');

            const querySourceCache = queries[sourceCache.id] = queries[sourceCache.id] || {sourceCache, layers: {}, has3DLayers: false};
            if (styleLayer.is3D(!!this.terrain)) querySourceCache.has3DLayers = true;
            querySourceCache.layers[styleLayer.fqid] = querySourceCache.layers[styleLayer.fqid] || {styleLayer, targets: []};
            querySourceCache.layers[styleLayer.fqid].targets.push({filter});
        };

        if (params && params.layers) {
            if (!Array.isArray(params.layers)) {
                this.fire(new ErrorEvent(new Error('parameters.layers must be an Array.')));
                return [];
            }

            for (const layerId of params.layers) {
                const styleLayer = this._layers[layerId];
                if (!styleLayer) {
                    this.fire(new ErrorEvent(new Error(`The layer '${layerId}' does not exist in the map's style and cannot be queried for features.`)));
                    return [];
                }

                addLayerToQuery(styleLayer);
            }
        } else {
            for (const layerId in this._layers) {
                addLayerToQuery(this._layers[layerId]);
            }
        }

        const renderedFeatures = this._queryRenderedFeatures(queryGeometry, queries, transform);
        const sortedFeatures = this._flattenAndSortRenderedFeatures(renderedFeatures);

        const features = [];
        for (const feature of sortedFeatures) {
            const scope = getScopeFromFQID(feature.layer.id);
            if (scope === this.scope) features.push(feature);
        }

        return features;
    }

    queryRenderedFeatureset(queryGeometry: PointLike | [PointLike, PointLike], params: QueryRenderedFeaturesetParams | undefined, transform: Transform): TargetFeature[] {
        let filter;
        if (params && !Array.isArray(params) && params.filter) {
            this._validate(validateFilter, 'queryRenderedFeatures.filter', params.filter, null, params);
            filter = featureFilter(params.filter);
        }

        const targetId = 'mock'; // use mock target id for plain featureset queries
        const targets: QrfTarget[] = [];

        if (params && params.target) {
            targets.push(Object.assign({}, params, {targetId, filter}));
        } else {
            // Query all root-level featuresets
            const featuresetDescriptors = this.getFeaturesetDescriptors();
            for (const featureset of featuresetDescriptors) {
                targets.push({targetId, filter, target: featureset});
            }

            // Query all root-level featuresets in imported styles
            for (const {style} of this.fragments) {
                const featuresetDescriptors = style.getFeaturesetDescriptors();
                for (const featureset of featuresetDescriptors) {
                    targets.push({targetId, filter, target: featureset});
                }
            }
        }

        const features = this.queryRenderedTargets(queryGeometry, targets, transform);

        const targetFeatures = [];
        const uniqueFeatureSet = new Set<string>();
        for (const feature of features) {
            for (const variant of feature.variants[targetId]) {
                if (shouldSkipFeatureVariant(variant, feature, uniqueFeatureSet)) {
                    continue;
                }
                targetFeatures.push(new TargetFeature(feature, variant));
            }
        }

        return targetFeatures;
    }

    queryRenderedTargets(queryGeometry: PointLike | [PointLike, PointLike], targets: QrfTarget[], transform: Transform): Feature[] {
        const queries: Record<string, QrfQuery & {has3DLayers?: boolean}> = {};

        const addLayerToQuery = (styleLayer: StyleLayer, sourceCache: SourceCache, target: QrfTarget, selector?: FeaturesetSelector) => {
            assert(sourceCache, 'queryable layers must have a source');

            const querySourceCache = queries[sourceCache.id] = queries[sourceCache.id] || {sourceCache, layers: {}, has3DLayers: false};
            querySourceCache.layers[styleLayer.fqid] = querySourceCache.layers[styleLayer.fqid] || {styleLayer, targets: []};
            if (styleLayer.is3D(!!this.terrain)) querySourceCache.has3DLayers = true;

            if (!selector) {
                target.uniqueFeatureID = false;
                querySourceCache.layers[styleLayer.fqid].targets.push(target);
                return;
            }

            querySourceCache.layers[styleLayer.fqid].targets.push(Object.assign({}, target, {
                namespace: selector.namespace,
                properties: selector.properties,
                uniqueFeatureID: selector.uniqueFeatureID
            }));
        };

        for (const target of targets) {
            if ('featuresetId' in target.target) {
                const {featuresetId, importId} = target.target;
                const style = this.getFragmentStyle(importId);
                if (!style || !style._featuresetSelectors) continue;

                const selectors = style._featuresetSelectors[featuresetId];
                if (!selectors) {
                    this.fire(new ErrorEvent(new Error(`The featureset '${featuresetId}' does not exist in the map's style and cannot be queried for features.`)));
                    continue;
                }

                for (const selector of selectors) {
                    const styleLayer = style.getOwnLayer(selector.layerId);
                    if (!styleLayer || featurelessLayerTypes.has(styleLayer.type)) continue;
                    const sourceCache = style.getOwnLayerSourceCache(styleLayer);
                    addLayerToQuery(styleLayer, sourceCache, target, selector);
                }
            } else if ('layerId' in target.target) {
                const {layerId} = target.target;
                const styleLayer = this.getLayer(layerId);
                if (!styleLayer || featurelessLayerTypes.has(styleLayer.type)) continue;
                const sourceCache = this.getLayerSourceCache(styleLayer);
                addLayerToQuery(styleLayer, sourceCache, target);
            }
        }

        const renderedFeatures = this._queryRenderedFeatures(queryGeometry, queries, transform);
        const sortedFeatures = this._flattenAndSortRenderedFeatures(renderedFeatures);
        return sortedFeatures;
    }

    _queryRenderedFeatures(
        queryGeometry: PointLike | [PointLike, PointLike],
        queries: Record<string, QrfQuery & {has3DLayers?: boolean}>,
        transform: Transform
    ): Array<QueryResult> {
        const queryResults: Array<QueryResult> = [];
        const showQueryGeometry = !!this.map._showQueryGeometry;
        const queryGeometryStruct = QueryGeometry.createFromScreenPoints(queryGeometry, transform);

        for (const sourceCacheId in queries) {
            const queryResult = queryRenderedFeatures(
                queryGeometryStruct,
                queries[sourceCacheId],
                this._availableImages,
                transform,
                showQueryGeometry,
            );

            if (Object.keys(queryResult).length) queryResults.push(queryResult);
        }

        // If a placement has run, query against its CollisionIndex
        // for symbol results, and treat it as an extra source to merge
        if (this.placement) {
            for (const sourceCacheId in queries) {
                // Skip non-symbol source caches
                if (!queries[sourceCacheId].sourceCache._onlySymbols) continue;

                const queryResult = queryRenderedSymbols(
                    queryGeometryStruct.screenGeometry,
                    queries[sourceCacheId],
                    this._availableImages,
                    this.placement.collisionIndex,
                    this.placement.retainedQueryData,
                );

                if (Object.keys(queryResult).length) queryResults.push(queryResult);
            }
        }

        return queryResults;
    }

    querySourceFeatures(
        sourceId: string,
        params?: {
            sourceLayer?: string;
            filter?: FilterSpecification;
            validate?: boolean;
        }
    ): Array<Feature> {
        const filter = params && params.filter;
        if (filter) {
            this._validate(validateFilter, 'querySourceFeatures.filter', filter, null, params);
        }

        let results = [];
        const sourceCaches = this.getOwnSourceCaches(sourceId);
        for (const sourceCache of sourceCaches) {
            results = results.concat(querySourceFeatures(sourceCache, params));
        }

        return results;
    }

    addSourceType(name: string, SourceType: SourceClass, callback: Callback<undefined>): void {
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

    getTerrain(): TerrainSpecification | null | undefined {
        return this.terrain && this.terrain.drapeRenderMode === DrapeRenderMode.elevated ? this.terrain.get() : null;
    }

    setTerrainForDraping() {
        const mockTerrainOptions = {source: '', exaggeration: 0};
        this.setTerrain(mockTerrainOptions, DrapeRenderMode.deferred);
    }

    checkCanvasFingerprintNoise() {
        // This workaround disables terrain and hillshade
        // if there is noise in the Canvas2D operations used for image decoding.
        if (this.disableElevatedTerrain === undefined) {
            this.disableElevatedTerrain = browser.hasCanvasFingerprintNoise();
            if (this.disableElevatedTerrain) warnOnce('Terrain and hillshade are disabled because of Canvas2D limitations when fingerprinting protection is enabled (e.g. in private browsing mode).');
        }
    }

    // eslint-disable-next-line no-warning-comments
    // TODO: generic approach for root level property: light, terrain, skybox.
    // It is not done here to prevent rebasing issues.
    setTerrain(terrainOptions?: TerrainSpecification | null, drapeRenderMode: number = DrapeRenderMode.elevated) {
        this._checkLoaded();

        // Disabling
        if (!terrainOptions) {
            // This check prevents removing draping terrain not from #applyProjectionUpdate
            if (!this.terrainSetForDrapingOnly()) {
                delete this.terrain;

                if (this.map.transform.projection.requiresDraping) {
                    this.setTerrainForDraping();
                }
            }

            if (drapeRenderMode === DrapeRenderMode.deferred) {
                delete this.terrain;
            }

            if (terrainOptions === null) {
                this.stylesheet.terrain = null;
            } else {
                delete this.stylesheet.terrain;
            }

            this._force3DLayerUpdate();
            this._markersNeedUpdate = true;
            return;
        }

        this.checkCanvasFingerprintNoise();

        let options: TerrainSpecification = terrainOptions;
        const isUpdating = terrainOptions.source == null;
        if (drapeRenderMode === DrapeRenderMode.elevated) {
            if (this.disableElevatedTerrain) return;

            // Input validation and source object unrolling
            if (typeof options.source === 'object') {
                const id = 'terrain-dem-src';
                this.addSource(id, options.source);
                options = clone(options);
                options = extend(options, {source: id});
            }

            const validationOptions = extend({}, options);
            const validationProps: Record<string, any> = {};

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
        const fog = this.fog = new Fog(fogOptions, this.map.transform, this.scope, this.options);
        this.stylesheet.fog = fog.get();
        const parameters = this._getTransitionParameters({duration: 0});
        fog.updateTransitions(parameters);
    }

    _createSnow(snowOptions: SnowSpecification) {
        const snow = this.snow = new Snow(snowOptions, this.map.transform, this.scope, this.options);
        this.stylesheet.snow = snow.get();
        const parameters = this._getTransitionParameters({duration: 0});
        snow.updateTransitions(parameters);
    }

    _createRain(rainOptions: RainSpecification) {
        const rain = this.rain = new Rain(rainOptions, this.map.transform, this.scope, this.options);
        this.stylesheet.rain = rain.get();
        const parameters = this._getTransitionParameters({duration: 0});
        rain.updateTransitions(parameters);
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

    getFog(): FogSpecification | null | undefined {
        return this.fog ? this.fog.get() : null;
    }

    setFog(fogOptions?: FogSpecification) {
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
                fog.set(fogOptions, this.options);
                this.stylesheet.fog = fog.get();
                const parameters = this._getTransitionParameters({duration: 0});
                fog.updateTransitions(parameters);
            }
        }

        this._markersNeedUpdate = true;
    }

    getSnow(): SnowSpecification | null | undefined {
        return this.snow ? this.snow.get() : null;
    }

    setSnow(snowOptions?: SnowSpecification) {
        this._checkLoaded();

        if (!snowOptions) {
            // Remove snow
            delete this.snow;
            delete this.stylesheet.snow;
            return;
        }

        if (!this.snow) {
            // Initialize Snow
            this._createSnow(snowOptions);
        } else {
            // Updating snow
            const snow = this.snow;
            if (!deepEqual(snow.get(), snowOptions)) {
                snow.set(snowOptions, this.options);
                this.stylesheet.snow = snow.get();
                const parameters = this._getTransitionParameters({duration: 0});
                snow.updateTransitions(parameters);
            }
        }

        this._markersNeedUpdate = true;
    }

    getRain(): RainSpecification | null | undefined {
        return this.rain ? this.rain.get() : null;
    }

    setRain(rainOptions?: RainSpecification) {
        this._checkLoaded();

        if (!rainOptions) {
            // Remove rain
            delete this.rain;
            delete this.stylesheet.rain;
            return;
        }

        if (!this.rain) {
            // Initialize Rain
            this._createRain(rainOptions);
        } else {
            // Updating rain
            const rain = this.rain;
            if (!deepEqual(rain.get(), rainOptions)) {
                rain.set(rainOptions, this.options);
                this.stylesheet.rain = rain.get();
                const parameters = this._getTransitionParameters({duration: 0});
                rain.updateTransitions(parameters);
            }
        }

        this._markersNeedUpdate = true;
    }

    _reloadColorTheme() {
        const updateStyle = () => {
            for (const layerId in this._layers) {
                const layer = this._layers[layerId];
                layer.lut = this._styleColorTheme.lut;
            }
            for (const id in this._sourceCaches) {
                this._sourceCaches[id].clearTiles();
            }
        };

        const colorTheme = this._styleColorTheme.colorThemeOverride ? this._styleColorTheme.colorThemeOverride : this._styleColorTheme.colorTheme;
        if (!colorTheme) {
            this._styleColorTheme.lut = null;
            updateStyle();
            return;
        }

        const data = this._evaluateColorThemeData(colorTheme);
        this._loadColorTheme(data).then(() => {
            this.fire(new Event('colorthemeset'));
            updateStyle();
        }).catch((e) => {
            warnOnce(`Couldn\'t set color theme: ${e}`);
        });
    }

    setColorTheme(colorTheme?: ColorThemeSpecification) {
        this._checkLoaded();

        if (this._styleColorTheme.colorThemeOverride) {
            // This is just for hardening and in practice shouldn't happen.
            // In theory colorThemeOverride can have values only for imports, and it's not possible to call setColorTheme directly on an imported style.
            warnOnce(`Note: setColorTheme is called on a style with a color-theme override, the passed color-theme won't be visible.`);
        }

        this._styleColorTheme.colorTheme = colorTheme;
        this._reloadColorTheme();
    }

    setImportColorTheme(importId: string, colorTheme?: ColorThemeSpecification) {
        const fragmentStyle = this.getFragmentStyle(importId);
        if (!fragmentStyle) return;
        fragmentStyle._styleColorTheme.colorThemeOverride = colorTheme;
        fragmentStyle._reloadColorTheme();
    }

    _getTransitionParameters(transition?: TransitionSpecification | null): TransitionParameters {
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
        for (const layerId of this._mergedOrder) {
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

    _validate(
        validate: Validator,
        key: string,
        value: any,
        props: any,
        options: {
            validate?: boolean;
        } = {},
    ): boolean {
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
        delete this.snow;
        delete this.rain;
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
            if (source.reload)
                source.reload();
        }
    }

    reloadModels() {
        this.modelManager.reloadModels('');
        this.forEachFragmentStyle((style) => {
            style.modelManager.reloadModels(style.scope);
        });
    }

    updateSources(transform: Transform) {
        let lightDirection: vec3 | null | undefined;
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

    _updatePlacement(
        painter: Painter,
        transform: Transform,
        showCollisionBoxes: boolean,
        fadeDuration: number,
        crossSourceCollisions: boolean,
        replacementSource: ReplacementSource,
        forceFullPlacement: boolean = false,
    ): {
        needsRerender: boolean;
    } {
        let symbolBucketsChanged = false;
        let placementCommitted = false;

        const layerTiles: Record<string, any> = {};
        const layerTilesInYOrder: Record<string, any> = {};

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
            this.pauseablePlacement.continuePlacement(this._mergedOrder, this._mergedLayers, layerTiles, layerTilesInYOrder, this.map.painter.scaleFactor);

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
            this._buildingIndex.onNewFrame(transform.zoom);
            for (let i = 0; i < this._mergedOrder.length; i++) {
                const layerId = this._mergedOrder[i];
                const styleLayer = this._mergedLayers[layerId];
                if (styleLayer.type !== 'symbol') continue;
                const checkAgainstClipLayer = this.isLayerClipped(styleLayer);
                this.placement.updateLayerOpacities(styleLayer, layerTiles[makeFQID(styleLayer.source, styleLayer.scope)], i, checkAgainstClipLayer ? replacementSource : null);
            }
        }

        // needsRender is false when we have just finished a placement that didn't change the visibility of any symbols
        const needsRerender = !this.pauseablePlacement.isDone() || this.placement.hasTransitions(browser.now());
        return {needsRerender};
    }

    _releaseSymbolFadeTiles() {
        for (const id in this._sourceCaches) {
            this._sourceCaches[id].releaseSymbolFadeTiles();
        }
    }

    // Fragments and merging

    addImport(importSpec: ImportSpecification, beforeId?: string | null): Promise<any> | void {
        this._checkLoaded();

        const imports = this.stylesheet.imports = this.stylesheet.imports || [];

        const index = imports.findIndex(({id}) => id === importSpec.id);
        if (index !== -1) {
            this.fire(new ErrorEvent(new Error(`Import with id '${importSpec.id}' already exists in the map's style.`)));
            return;
        }

        if (!beforeId) {
            imports.push(importSpec);
            return this._loadImports([importSpec], true);
        }

        const beforeIndex = imports.findIndex(({id}) => id === beforeId);

        if (beforeIndex === -1) {
            this.fire(new ErrorEvent(new Error(`Import with id "${beforeId}" does not exist on this map.`)));
        }

        this.stylesheet.imports = imports
            .slice(0, beforeIndex)
            .concat(importSpec)
            .concat(imports.slice(beforeIndex));

        return this._loadImports([importSpec], true, beforeId);
    }

    updateImport(importId: string, importSpecification: ImportSpecification | string): Style {
        this._checkLoaded();

        const imports = this.stylesheet.imports || [];
        const index = this.getImportIndex(importId);
        if (index === -1) return this;

        if (typeof importSpecification === 'string') {
            this.setImportUrl(importId, importSpecification);
            return this;
        }

        if (importSpecification.url && importSpecification.url !== imports[index].url) {
            this.setImportUrl(importId, importSpecification.url);
        }

        if (!deepEqual(importSpecification.config, imports[index].config)) {
            this.setImportConfig(importId, importSpecification.config, importSpecification.data.schema);
        }

        if (!deepEqual(importSpecification.data, imports[index].data)) {
            this.setImportData(importId, importSpecification.data);
        }

        return this;
    }

    moveImport(importId: string, beforeId: string): Style {
        this._checkLoaded();

        let imports = this.stylesheet.imports || [];

        const index = this.getImportIndex(importId);
        if (index === -1) return this;

        const beforeIndex = this.getImportIndex(beforeId);
        if (beforeIndex === -1) return this;

        const importSpec = imports[index];
        const fragment = this.fragments[index];

        imports = imports.filter(({id}) => id !== importId);

        this.fragments = this.fragments.filter(({id}) => id !== importId);

        this.stylesheet.imports = imports
            .slice(0, beforeIndex)
            .concat(importSpec)
            .concat(imports.slice(beforeIndex));

        this.fragments = this.fragments
            .slice(0, beforeIndex)
            .concat(fragment)
            .concat(this.fragments.slice(beforeIndex));

        this.mergeLayers();
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

    setImportData(importId: string, stylesheet?: StyleSpecification | null): Style {
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

    setImportConfig(importId: string, config?: ConfigSpecification | null, importSchema?: SchemaSpecification | null): Style {
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
        if (importSchema && fragment.style.stylesheet) {
            fragment.style.stylesheet.schema = importSchema;
        }
        const schema = fragment.style.stylesheet && fragment.style.stylesheet.schema;

        fragment.config = config;
        fragment.style.updateConfig(config, schema);

        this.updateConfigDependencies();

        return this;
    }

    removeImport(importId: string): void {
        this._checkLoaded();

        const imports = this.stylesheet.imports || [];
        const index = this.getImportIndex(importId);
        if (index === -1) return;

        imports.splice(index, 1);

        // Update related fragment
        const fragment = this.fragments[index];
        fragment.style._remove();
        this.fragments.splice(index, 1);

        this._reloadImports();
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
    getLayer(id: string): StyleLayer | null | undefined {
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
    getSource(id: string, scope: string): Source | null | undefined {
        const sourceCache = this.getSourceCache(id, scope);
        return sourceCache && sourceCache.getSource();
    }

    getLayerSource(layer: StyleLayer): Source | null | undefined {
        const sourceCache = this.getLayerSourceCache(layer);
        return sourceCache && sourceCache.getSource();
    }

    getSourceCache(id: string, scope?: string | null): SourceCache | undefined {
        const fqid = makeFQID(id, scope);
        return this._mergedOtherSourceCaches[fqid];
    }

    getLayerSourceCache(layer: StyleLayer): SourceCache | undefined {
        const fqid = makeFQID(layer.source, layer.scope);
        return layer.type === 'symbol' ?
            this._mergedSymbolSourceCaches[fqid] :
            this._mergedOtherSourceCaches[fqid];
    }

    /**
     * Returns all source caches for a given style FQID.
     * If no FQID is provided, returns all source caches,
     * including source caches in imported styles.
     * @param {string} fqid Style FQID.
     * @returns {Array<SourceCache>} List of source caches.
     */
    getSourceCaches(fqid?: string | null): Array<SourceCache> {
        if (fqid == null)
            return Object.values(this._mergedSourceCaches);

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

    getGlyphsUrl(): string | undefined {
        return this.stylesheet.glyphs;
    }

    setGlyphsUrl(url: string) {
        this.stylesheet.glyphs = url;
        this.glyphManager.setURL(url, this.scope);
    }

    // Callbacks from web workers

    getImages(mapId: string, params: GetImagesParameters, callback: Callback<StyleImageMap<StringifiedImageId>>) {
        this.imageManager.getImages(params.images, params.scope, callback);

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
                const dependencies = params.images.map(id => ImageId.toString(id));
                sourceCache.setDependencies(params.tileID.key, params.type, dependencies);
            }
        };
        setDependencies(this._otherSourceCaches[params.source]);
        setDependencies(this._symbolSourceCaches[params.source]);
    }

    rasterizeImages(mapId: string, params: RasterizeImagesParameters, callback: Callback<RasterizedImageMap>) {
        this.imageManager.rasterizeImages(params, callback);
    }

    getGlyphs(mapId: string, params: GetGlyphsParameters, callback: Callback<GlyphMap>) {
        this.glyphManager.getGlyphs(params.stacks, params.scope, callback);
    }

    getResource(mapId: string, params: RequestParameters, callback: ResponseCallback<unknown>): Cancelable {
        return makeRequest(params, callback);
    }

    getOwnSourceCache(source: string): SourceCache | undefined {
        return this._otherSourceCaches[source];
    }

    getOwnLayerSourceCache(layer: StyleLayer): SourceCache | undefined {
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

    isLayerClipped(layer: StyleLayer, source?: Source | null): boolean {
        // fill-extrusions can be conflated by landmarks.
        if (!this._clipLayerPresent && layer.type !== 'fill-extrusion') return false;
        const isFillExtrusion = layer.type === 'fill-extrusion' && layer.sourceLayer === 'building';

        if (layer.is3D(!!this.terrain)) {
            if (isFillExtrusion || (!!source && source.type === 'batched-model')) return true;
            if (layer.type === 'model') {
                return true;
            }
        } else if (layer.type === 'symbol') {
            return true;
        }

        return false;
    }

    _clearWorkerCaches() {
        // @ts-expect-error - TS2554 - Expected 2-3 arguments, but got 1.
        this.dispatcher.broadcast('clearCaches');
    }

    destroy() {
        this._clearWorkerCaches();
        this.fragments.forEach(fragment => {
            fragment.style._remove();
        });
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
