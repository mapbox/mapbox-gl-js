import type GeoJSONFeature from '../util/vectortile_to_geojson';
import type {MapOptions} from '../ui/map';
import type {Event, ErrorEvent} from '../util/evented';
import type {RequestTransformFunction} from '../util/mapbox';
import type {MapDataEvent, MapMouseEvent, MapTouchEvent} from '../ui/events';

/**
 * List of type aliases for partial backwards compatibility with @types/mapbox-gl.
 */

/**
 * @deprecated Use `MapOptions` instead.
 */
export type MapboxOptions = MapOptions;

/**
 * @deprecated Use `Event` instead.
 */
export type MapboxEvent = Event;

/**
 * @deprecated Use `ErrorEvent` instead.
 */
export type MapboxErrorEvent = ErrorEvent;

/**
 * @deprecated Use `MapDataEvent` instead.
 */
export type MapSourceDataEvent = MapDataEvent;

/**
 * @deprecated Use `MapDataEvent` instead.
 */
export type MapStyleDataEvent = MapDataEvent;

/**
 * @deprecated Use `MapMouseEvent` instead.
 */
export type MapLayerMouseEvent = MapMouseEvent;

/**
 * @deprecated Use `MapTouchEvent` instead.
 */
export type MapLayerTouchEvent = MapTouchEvent;

/**
 * @deprecated Use `RequestTransformFunction` instead.
*/
export type TransformRequestFunction = RequestTransformFunction;

/**
 * @deprecated Use `GeoJSONFeature` instead.
*/
export type MapboxGeoJSONFeature = GeoJSONFeature;

/**
 * @deprecated Use `MapOptions['fitBoundsOptions']` instead.
*/
export type FitBoundsOptions = MapOptions['fitBoundsOptions'];
