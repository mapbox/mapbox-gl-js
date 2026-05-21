import assert from './style-spec/util/assert';
import _Point from '@mapbox/point-geometry';
import {version as _version} from '../package.json';

// Explicit type re-exports
export type * from './ui/events';
export type * from './style-spec/types.esm';
export type * from './source/source_types';
export type * from './types/deprecated-aliases';

export type {PointLike} from './types/point-like';
export type {PluginStatus} from './source/rtl_text_plugin';

export type {Event, ErrorEvent} from './util/evented';
export type {GeoJSONFeature, TargetFeature} from './util/vectortile_to_geojson';
export type {InteractionEvent} from './ui/interactions';
export type {PaddingOptions} from './geo/edge_insets';
export type {RequestParameters} from './util/ajax';
export type {RequestTransformFunction, ResourceType} from './util/mapbox';
export type {LngLatLike, LngLatBoundsLike} from './geo/lng_lat';

export type {FeatureSelector} from './style/style';
export type {StyleImageInterface} from './style/style_image';
export type {CustomLayerInterface} from './style/style_layer/custom_style_layer';
export type {CustomSourceInterface} from './source/custom_source';
export type {CanvasSourceSpecification} from './source/canvas_source';
export type {TileProvider, TileDataResponse} from './source/tile_provider';
export type {TileJSON} from './types/tilejson';

export type {Anchor} from './ui/anchor';
export type {PopupOptions} from './ui/popup';
export type {MarkerOptions} from './ui/marker';
export type {ScaleControlOptions} from './ui/control/scale_control';
export type {GeolocateControlOptions} from './ui/control/geolocate_control';
export type {NavigationControlOptions} from './ui/control/navigation_control';
export type {FullscreenControlOptions} from './ui/control/fullscreen_control';
export type {AttributionControlOptions} from './ui/control/attribution_control';
export type {MapOptions, IControl, ControlPosition} from './ui/map';
export type {FontstackCompositing} from './style/glyph_loader';
export type {AnimationOptions, CameraOptions, EasingOptions} from './ui/camera';

// Named value exports — classes, functions, constants
export const version: string = _version;
export {supported} from '@mapbox/mapbox-gl-supported';
export {Map} from './ui/map';
export {default as NavigationControl} from './ui/control/navigation_control';
export {default as GeolocateControl} from './ui/control/geolocate_control';
export {default as AttributionControl} from './ui/control/attribution_control';
export {default as ScaleControl} from './ui/control/scale_control';
export {default as FullscreenControl} from './ui/control/fullscreen_control';
export {default as IndoorControl} from './ui/control/indoor_control';
export {default as Popup} from './ui/popup';
export {default as Marker} from './ui/marker';
export {default as Style} from './style/style';
export {default as LngLat, LngLatBounds} from './geo/lng_lat';
export {_Point as Point};
export {default as MercatorCoordinate} from './geo/mercator_coordinate';
export {Evented} from './util/evented';
export {FreeCameraOptions} from './ui/free_camera';
export {setRTLTextPlugin, getRTLTextPluginStatus} from './source/rtl_text_plugin';
export {addTileProvider} from './source/tile_provider';
export {prewarm, clearPrewarmedResources} from './util/worker_pool_factory';
export {getWorkerCount, setWorkerCount} from './util/worker_pool';
export {default as config, setAccessToken, setBaseApiUrl, setMaxParallelImageRequests, getDracoUrl, setDracoUrl, getMeshoptUrl, setMeshoptUrl, getBuildingGenUrl, setBuildingGenUrl} from './util/config';

export {clearTileCache as clearStorage} from './util/tile_request_cache';
export {setNow, restoreNow} from './util/browser';

// canary assert: used to confirm that asserts have been removed from production build
assert(true, 'canary assert');
