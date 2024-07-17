import type {GeoJSONFeature} from '../util/vectortile_to_geojson';
import type {MapOptions} from '../ui/map';
import type {FeatureSelector} from '../style/style';
import type {ErrorEvent} from '../util/evented';
import type {RequestTransformFunction} from '../util/mapbox';
import type {MapEvent, MapMouseEvent, MapTouchEvent} from '../ui/events';
import type {
    Source,
    VectorTileSource,
    RasterTileSource,
} from '../source/source_types';

/**
 * List of type aliases for partial backwards compatibility with @types/mapbox-gl.
 * https://github.com/DefinitelyTyped/DefinitelyTyped/blob/5a4218ff5d0efa72761f5e740e501666e22261e0/types/mapbox-gl/index.d.ts
 */

/**
 * @deprecated Use `MapOptions` instead.
 */
export type MapboxOptions = MapOptions;

/**
 * @deprecated Use `MapEvent` instead.
 */
export type MapboxEvent = MapEvent;

/**
 * @deprecated Use `ErrorEvent` instead.
 */
export type MapboxErrorEvent = ErrorEvent;

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
 * @deprecated Use `GeoJSONFeature` instead.
*/
export type QueryFeature = GeoJSONFeature;

/**
 * @deprecated Use `MapOptions['fitBoundsOptions']` instead.
*/
export type FitBoundsOptions = MapOptions['fitBoundsOptions'];

/**
 * @deprecated Use `FeatureSelector` instead.
*/
export type FeatureIdentifier = FeatureSelector;

/**
 * @deprecated Use `Source` instead.
*/
export type AnySourceImpl = Source;

/**
 * @deprecated Use `VectorTileSource` instead.
*/
export type VectorSourceImpl = VectorTileSource;

/**
 * @deprecated Use `RasterTileSource` instead.
*/
export type RasterSourceImpl = RasterTileSource;
