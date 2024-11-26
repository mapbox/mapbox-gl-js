// Generated code; do not edit. Edit build/generate-typed-style-spec.ts instead.

import type {UnionToIntersection} from './union-to-intersection';

export type ColorSpecification = string;

export type FormattedSpecification = string;

export type ResolvedImageSpecification = string;

export type PromoteIdSpecification = {[_: string]: string} | string;

export type FilterSpecification =
    | ExpressionSpecification
    | ['has', string]
    | ['!has', string]
    | ['==', string, string | number | boolean]
    | ['!=', string, string | number | boolean]
    | ['>', string, string | number | boolean]
    | ['>=', string, string | number | boolean]
    | ['<', string, string | number | boolean]
    | ['<=', string, string | number | boolean]
    | Array<string | FilterSpecification>;

export type TransitionSpecification = {
    duration?: number,
    delay?: number
};

// Note: doesn't capture interpolatable vs. non-interpolatable types.

export type PropertyFunctionStop<T> = [number, T];
export type ZoomAndPropertyFunctionStop<T> = [{zoom: number; value: string | number | boolean}, T];

/**
 * @deprecated Use [Expressions](https://docs.mapbox.com/style-spec/reference/expressions/) syntax instead.
*/
export type FunctionSpecification<T> = {
    stops: Array<PropertyFunctionStop<T> | ZoomAndPropertyFunctionStop<T>>;
    base?: number;
    property?: string;
    type?: 'identity' | 'exponential' | 'interval' | 'categorical';
    colorSpace?: 'rgb' | 'lab' | 'hcl';
    default?: T;
};

export type CameraFunctionSpecification<T> =
    | { type: 'exponential', stops: Array<[number, T]> }
    | { type: 'interval',    stops: Array<[number, T]> };

export type SourceFunctionSpecification<T> =
    | { type: 'exponential', stops: Array<[number, T]>, property: string, default?: T }
    | { type: 'interval',    stops: Array<[number, T]>, property: string, default?: T }
    | { type: 'categorical', stops: Array<[string | number | boolean, T]>, property: string, default?: T }
    | { type: 'identity', property: string, default?: T };

export type CompositeFunctionSpecification<T> =
    | { type: 'exponential', stops: Array<[{zoom: number, value: number}, T]>, property: string, default?: T }
    | { type: 'interval',    stops: Array<[{zoom: number, value: number}, T]>, property: string, default?: T }
    | { type: 'categorical', stops: Array<[{zoom: number, value: string | number | boolean}, T]>, property: string, default?: T };

export type ExpressionSpecification = [string, ...any[]];

export type PropertyValueSpecification<T> =
    | T
    | CameraFunctionSpecification<T>
    | ExpressionSpecification;

export type DataDrivenPropertyValueSpecification<T> =
    | T
    | FunctionSpecification<T>
    | CameraFunctionSpecification<T>
    | SourceFunctionSpecification<T>
    | CompositeFunctionSpecification<T>
    | ExpressionSpecification
    | (T extends Array<infer U> ? Array<U | ExpressionSpecification> : never);

export type StyleSpecification = {
    "version": 8,
    "fragment"?: boolean,
    "name"?: string,
    "metadata"?: unknown,
    "center"?: Array<number>,
    "zoom"?: number,
    "bearing"?: number,
    "pitch"?: number,
    "light"?: LightSpecification,
    "lights"?: Array<LightsSpecification>,
    "terrain"?: TerrainSpecification | null | undefined,
    "fog"?: FogSpecification,
    "camera"?: CameraSpecification,
    "color-theme"?: ColorThemeSpecification,
    "imports"?: Array<ImportSpecification>,
    "schema"?: SchemaSpecification,
    "sources": SourcesSpecification,
    "sprite"?: string,
    "glyphs"?: string,
    "transition"?: TransitionSpecification,
    "projection"?: ProjectionSpecification,
    "layers": Array<LayerSpecification>,
    "models"?: ModelsSpecification,
    /**
     * @experimental This property is experimental and subject to change in future versions.
     */
    "featuresets"?: FeaturesetsSpecification
}

export type SourcesSpecification = {
    [_: string]: SourceSpecification
}

export type ModelsSpecification = {
    [_: string]: ModelSpecification
}

export type LightSpecification = {
    "anchor"?: PropertyValueSpecification<"map" | "viewport">,
    "position"?: PropertyValueSpecification<[number, number, number]>,
    "position-transition"?: TransitionSpecification,
    "color"?: PropertyValueSpecification<ColorSpecification>,
    "color-transition"?: TransitionSpecification,
    "intensity"?: PropertyValueSpecification<number>,
    "intensity-transition"?: TransitionSpecification
}

export type TerrainSpecification = {
    "source": string,
    "exaggeration"?: PropertyValueSpecification<number>,
    "exaggeration-transition"?: TransitionSpecification
}

export type FogSpecification = {
    "range"?: PropertyValueSpecification<[number, number]>,
    "range-transition"?: TransitionSpecification,
    "color"?: PropertyValueSpecification<ColorSpecification>,
    "color-transition"?: TransitionSpecification,
    "high-color"?: PropertyValueSpecification<ColorSpecification>,
    "high-color-transition"?: TransitionSpecification,
    "space-color"?: PropertyValueSpecification<ColorSpecification>,
    "space-color-transition"?: TransitionSpecification,
    "horizon-blend"?: PropertyValueSpecification<number>,
    "horizon-blend-transition"?: TransitionSpecification,
    "star-intensity"?: PropertyValueSpecification<number>,
    "star-intensity-transition"?: TransitionSpecification,
    "vertical-range"?: PropertyValueSpecification<[number, number]>,
    "vertical-range-transition"?: TransitionSpecification
}

export type CameraSpecification = {
    "camera-projection"?: PropertyValueSpecification<"perspective" | "orthographic">,
    "camera-projection-transition"?: TransitionSpecification
}

export type ColorThemeSpecification = {
    "data"?: ExpressionSpecification
}

export type ProjectionSpecification = {
    "name": "albers" | "equalEarth" | "equirectangular" | "lambertConformalConic" | "mercator" | "naturalEarth" | "winkelTripel" | "globe",
    "center"?: [number, number],
    "parallels"?: [number, number]
}

export type ImportSpecification = {
    "id": string,
    "url": string,
    "config"?: ConfigSpecification,
    "data"?: StyleSpecification
}

export type ConfigSpecification = {
    [_: string]: unknown
}

export type SchemaSpecification = {
    [_: string]: OptionSpecification
}

export type OptionSpecification = {
    "default": ExpressionSpecification,
    "type"?: "string" | "number" | "boolean" | "color",
    "array"?: boolean,
    "minValue"?: number,
    "maxValue"?: number,
    "stepValue"?: number,
    "values"?: Array<unknown>,
    "metadata"?: unknown
}

/**
 * @experimental This is experimental and subject to change in future versions.
 */
export type FeaturesetsSpecification = {
    [_: string]: FeaturesetSpecification
}

/**
 * @experimental This is experimental and subject to change in future versions.
 */
export type FeaturesetSpecification = {
    "metadata"?: unknown,
    "selectors"?: Array<SelectorSpecification>
}

/**
 * @experimental This is experimental and subject to change in future versions.
 */
export type SelectorSpecification = {
    "layer": string,
    "properties"?: SelectorPropertySpecification,
    "featureNamespace"?: string
}

/**
 * @experimental This is experimental and subject to change in future versions.
 */
export type SelectorPropertySpecification = {
    [_: string]: unknown
}

export type VectorSourceSpecification = {
    "type": "vector",
    "url"?: string,
    "tiles"?: Array<string>,
    "bounds"?: [number, number, number, number],
    "scheme"?: "xyz" | "tms",
    "minzoom"?: number,
    "maxzoom"?: number,
    "attribution"?: string,
    "promoteId"?: PromoteIdSpecification,
    "volatile"?: boolean,
    [_: string]: unknown
}

export type RasterSourceSpecification = {
    "type": "raster",
    "url"?: string,
    "tiles"?: Array<string>,
    "bounds"?: [number, number, number, number],
    "minzoom"?: number,
    "maxzoom"?: number,
    "tileSize"?: number,
    "scheme"?: "xyz" | "tms",
    "attribution"?: string,
    "volatile"?: boolean,
    [_: string]: unknown
}

export type RasterDEMSourceSpecification = {
    "type": "raster-dem",
    "url"?: string,
    "tiles"?: Array<string>,
    "bounds"?: [number, number, number, number],
    "minzoom"?: number,
    "maxzoom"?: number,
    "tileSize"?: number,
    "attribution"?: string,
    "encoding"?: "terrarium" | "mapbox",
    "volatile"?: boolean,
    [_: string]: unknown
}

/**
 * @experimental This is experimental and subject to change in future versions.
 */
export type RasterArraySourceSpecification = {
    "type": "raster-array",
    "url"?: string,
    "tiles"?: Array<string>,
    "bounds"?: [number, number, number, number],
    "minzoom"?: number,
    "maxzoom"?: number,
    "tileSize"?: number,
    "attribution"?: string,
    "rasterLayers"?: unknown,
    "volatile"?: boolean,
    [_: string]: unknown
}

export type GeoJSONSourceSpecification = {
    "type": "geojson",
    "data"?: GeoJSON.GeoJSON | string,
    "maxzoom"?: number,
    "minzoom"?: number,
    "attribution"?: string,
    "buffer"?: number,
    "filter"?: unknown,
    "tolerance"?: number,
    "cluster"?: boolean,
    "clusterRadius"?: number,
    "clusterMaxZoom"?: number,
    "clusterMinPoints"?: number,
    "clusterProperties"?: unknown,
    "lineMetrics"?: boolean,
    "generateId"?: boolean,
    "promoteId"?: PromoteIdSpecification,
    "dynamic"?: boolean
}

export type VideoSourceSpecification = {
    "type": "video",
    "urls": Array<string>,
    "coordinates": [[number, number], [number, number], [number, number], [number, number]]
}

export type ImageSourceSpecification = {
    "type": "image",
    "url"?: string,
    "coordinates": [[number, number], [number, number], [number, number], [number, number]]
}

export type ModelSourceSpecification = {
    "type": "model" | "batched-model",
    "maxzoom"?: number,
    "minzoom"?: number,
    "tiles"?: Array<string>
}

export type SourceSpecification =
    | VectorSourceSpecification
    | RasterSourceSpecification
    | RasterDEMSourceSpecification
    | RasterArraySourceSpecification
    | GeoJSONSourceSpecification
    | VideoSourceSpecification
    | ImageSourceSpecification
    | ModelSourceSpecification

export type ModelSpecification = string;

export type AmbientLightSpecification = {
    "id": string,
    "properties"?: {
        "color"?: PropertyValueSpecification<ColorSpecification>,
        "color-transition"?: TransitionSpecification,
        "intensity"?: PropertyValueSpecification<number>,
        "intensity-transition"?: TransitionSpecification
    },
    "type": "ambient"
}

export type DirectionalLightSpecification = {
    "id": string,
    "properties"?: {
        "direction"?: PropertyValueSpecification<[number, number]>,
        "direction-transition"?: TransitionSpecification,
        "color"?: PropertyValueSpecification<ColorSpecification>,
        "color-transition"?: TransitionSpecification,
        "intensity"?: PropertyValueSpecification<number>,
        "intensity-transition"?: TransitionSpecification,
        "cast-shadows"?: boolean,
        "shadow-intensity"?: PropertyValueSpecification<number>,
        "shadow-intensity-transition"?: TransitionSpecification
    },
    "type": "directional"
}

export type FlatLightSpecification = {
    "id": string,
    "properties"?: {
        "anchor"?: PropertyValueSpecification<"map" | "viewport">,
        "position"?: PropertyValueSpecification<[number, number, number]>,
        "position-transition"?: TransitionSpecification,
        "color"?: PropertyValueSpecification<ColorSpecification>,
        "color-transition"?: TransitionSpecification,
        "intensity"?: PropertyValueSpecification<number>,
        "intensity-transition"?: TransitionSpecification
    },
    "type": "flat"
}

export type LightsSpecification =
    | AmbientLightSpecification
    | DirectionalLightSpecification
    | FlatLightSpecification;

export type FillLayerSpecification = {
    "id": string,
    "type": "fill",
    "metadata"?: unknown,
    "source": string,
    "source-layer"?: string,
    "slot"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: FilterSpecification,
    "layout"?: {
        "fill-sort-key"?: DataDrivenPropertyValueSpecification<number>,
        "visibility"?: "visible" | "none" | ExpressionSpecification,
        /**
         * @experimental This property is experimental and subject to change in future versions.
         */
        "fill-elevation-reference"?: "none" | "hd-road-base" | "hd-road-markup" | ExpressionSpecification
    },
    "paint"?: {
        "fill-antialias"?: PropertyValueSpecification<boolean>,
        "fill-opacity"?: DataDrivenPropertyValueSpecification<number>,
        "fill-opacity-transition"?: TransitionSpecification,
        "fill-color"?: DataDrivenPropertyValueSpecification<ColorSpecification>,
        "fill-color-transition"?: TransitionSpecification,
        "fill-outline-color"?: DataDrivenPropertyValueSpecification<ColorSpecification>,
        "fill-outline-color-transition"?: TransitionSpecification,
        "fill-translate"?: PropertyValueSpecification<[number, number]>,
        "fill-translate-transition"?: TransitionSpecification,
        "fill-translate-anchor"?: PropertyValueSpecification<"map" | "viewport">,
        "fill-pattern"?: DataDrivenPropertyValueSpecification<ResolvedImageSpecification>,
        "fill-emissive-strength"?: PropertyValueSpecification<number>,
        "fill-emissive-strength-transition"?: TransitionSpecification,
        "fill-z-offset"?: DataDrivenPropertyValueSpecification<number>,
        "fill-z-offset-transition"?: TransitionSpecification
    }
}

/**
 * @deprecated Use `FillLayerSpecification['layout']` instead.
 */
export type FillLayout = FillLayerSpecification['layout'];

/**
 * @deprecated Use `FillLayerSpecification['paint']` instead.
 */
export type FillPaint = FillLayerSpecification['paint'];

export type LineLayerSpecification = {
    "id": string,
    "type": "line",
    "metadata"?: unknown,
    "source": string,
    "source-layer"?: string,
    "slot"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: FilterSpecification,
    "layout"?: {
        "line-cap"?: DataDrivenPropertyValueSpecification<"butt" | "round" | "square">,
        "line-join"?: DataDrivenPropertyValueSpecification<"bevel" | "round" | "miter" | "none">,
        "line-miter-limit"?: PropertyValueSpecification<number>,
        "line-round-limit"?: PropertyValueSpecification<number>,
        "line-sort-key"?: DataDrivenPropertyValueSpecification<number>,
        /**
         * @experimental This property is experimental and subject to change in future versions.
         */
        "line-z-offset"?: DataDrivenPropertyValueSpecification<number>,
        /**
         * @experimental This property is experimental and subject to change in future versions.
         */
        "line-elevation-reference"?: "none" | "sea" | "ground" | "hd-road-markup" | ExpressionSpecification,
        /**
         * @experimental This property is experimental and subject to change in future versions.
         */
        "line-cross-slope"?: ExpressionSpecification,
        "visibility"?: "visible" | "none" | ExpressionSpecification
    },
    "paint"?: {
        "line-opacity"?: DataDrivenPropertyValueSpecification<number>,
        "line-opacity-transition"?: TransitionSpecification,
        "line-color"?: DataDrivenPropertyValueSpecification<ColorSpecification>,
        "line-color-transition"?: TransitionSpecification,
        "line-translate"?: PropertyValueSpecification<[number, number]>,
        "line-translate-transition"?: TransitionSpecification,
        "line-translate-anchor"?: PropertyValueSpecification<"map" | "viewport">,
        "line-width"?: DataDrivenPropertyValueSpecification<number>,
        "line-width-transition"?: TransitionSpecification,
        "line-gap-width"?: DataDrivenPropertyValueSpecification<number>,
        "line-gap-width-transition"?: TransitionSpecification,
        "line-offset"?: DataDrivenPropertyValueSpecification<number>,
        "line-offset-transition"?: TransitionSpecification,
        "line-blur"?: DataDrivenPropertyValueSpecification<number>,
        "line-blur-transition"?: TransitionSpecification,
        "line-dasharray"?: DataDrivenPropertyValueSpecification<Array<number>>,
        "line-pattern"?: DataDrivenPropertyValueSpecification<ResolvedImageSpecification>,
        "line-gradient"?: ExpressionSpecification,
        "line-trim-offset"?: [number, number],
        /**
         * @experimental This property is experimental and subject to change in future versions.
         */
        "line-trim-fade-range"?: PropertyValueSpecification<[number, number]>,
        "line-trim-color"?: PropertyValueSpecification<ColorSpecification>,
        "line-trim-color-transition"?: TransitionSpecification,
        "line-emissive-strength"?: PropertyValueSpecification<number>,
        "line-emissive-strength-transition"?: TransitionSpecification,
        "line-border-width"?: DataDrivenPropertyValueSpecification<number>,
        "line-border-width-transition"?: TransitionSpecification,
        "line-border-color"?: DataDrivenPropertyValueSpecification<ColorSpecification>,
        "line-border-color-transition"?: TransitionSpecification,
        "line-occlusion-opacity"?: PropertyValueSpecification<number>,
        "line-occlusion-opacity-transition"?: TransitionSpecification
    }
}

/**
 * @deprecated Use `LineLayerSpecification['layout']` instead.
 */
export type LineLayout = LineLayerSpecification['layout'];

/**
 * @deprecated Use `LineLayerSpecification['paint']` instead.
 */
export type LinePaint = LineLayerSpecification['paint'];

export type SymbolLayerSpecification = {
    "id": string,
    "type": "symbol",
    "metadata"?: unknown,
    "source": string,
    "source-layer"?: string,
    "slot"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: FilterSpecification,
    "layout"?: {
        "symbol-placement"?: PropertyValueSpecification<"point" | "line" | "line-center">,
        "symbol-spacing"?: PropertyValueSpecification<number>,
        "symbol-avoid-edges"?: PropertyValueSpecification<boolean>,
        "symbol-sort-key"?: DataDrivenPropertyValueSpecification<number>,
        "symbol-z-order"?: PropertyValueSpecification<"auto" | "viewport-y" | "source">,
        "symbol-z-elevate"?: PropertyValueSpecification<boolean>,
        /**
         * @experimental This property is experimental and subject to change in future versions.
         */
        "symbol-elevation-reference"?: PropertyValueSpecification<"sea" | "ground" | "hd-road-markup">,
        "icon-allow-overlap"?: PropertyValueSpecification<boolean>,
        "icon-ignore-placement"?: PropertyValueSpecification<boolean>,
        "icon-optional"?: PropertyValueSpecification<boolean>,
        "icon-rotation-alignment"?: PropertyValueSpecification<"map" | "viewport" | "auto">,
        "icon-size"?: DataDrivenPropertyValueSpecification<number>,
        /**
         * @experimental This property is experimental and subject to change in future versions.
         */
        "icon-size-scale-range"?: ExpressionSpecification,
        "icon-text-fit"?: DataDrivenPropertyValueSpecification<"none" | "width" | "height" | "both">,
        "icon-text-fit-padding"?: DataDrivenPropertyValueSpecification<[number, number, number, number]>,
        "icon-image"?: DataDrivenPropertyValueSpecification<ResolvedImageSpecification>,
        "icon-rotate"?: DataDrivenPropertyValueSpecification<number>,
        "icon-padding"?: PropertyValueSpecification<number>,
        "icon-keep-upright"?: PropertyValueSpecification<boolean>,
        "icon-offset"?: DataDrivenPropertyValueSpecification<[number, number]>,
        "icon-anchor"?: DataDrivenPropertyValueSpecification<"center" | "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right">,
        "icon-pitch-alignment"?: PropertyValueSpecification<"map" | "viewport" | "auto">,
        "text-pitch-alignment"?: PropertyValueSpecification<"map" | "viewport" | "auto">,
        "text-rotation-alignment"?: PropertyValueSpecification<"map" | "viewport" | "auto">,
        "text-field"?: DataDrivenPropertyValueSpecification<FormattedSpecification>,
        "text-font"?: DataDrivenPropertyValueSpecification<Array<string>>,
        "text-size"?: DataDrivenPropertyValueSpecification<number>,
        /**
         * @experimental This property is experimental and subject to change in future versions.
         */
        "text-size-scale-range"?: ExpressionSpecification,
        "text-max-width"?: DataDrivenPropertyValueSpecification<number>,
        "text-line-height"?: DataDrivenPropertyValueSpecification<number>,
        "text-letter-spacing"?: DataDrivenPropertyValueSpecification<number>,
        "text-justify"?: DataDrivenPropertyValueSpecification<"auto" | "left" | "center" | "right">,
        "text-radial-offset"?: DataDrivenPropertyValueSpecification<number>,
        "text-variable-anchor"?: PropertyValueSpecification<Array<"center" | "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right">>,
        "text-anchor"?: DataDrivenPropertyValueSpecification<"center" | "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right">,
        "text-max-angle"?: PropertyValueSpecification<number>,
        "text-writing-mode"?: PropertyValueSpecification<Array<"horizontal" | "vertical">>,
        "text-rotate"?: DataDrivenPropertyValueSpecification<number>,
        "text-padding"?: PropertyValueSpecification<number>,
        "text-keep-upright"?: PropertyValueSpecification<boolean>,
        "text-transform"?: DataDrivenPropertyValueSpecification<"none" | "uppercase" | "lowercase">,
        "text-offset"?: DataDrivenPropertyValueSpecification<[number, number]>,
        "text-allow-overlap"?: PropertyValueSpecification<boolean>,
        "text-ignore-placement"?: PropertyValueSpecification<boolean>,
        "text-optional"?: PropertyValueSpecification<boolean>,
        "visibility"?: "visible" | "none" | ExpressionSpecification
    },
    "paint"?: {
        "icon-opacity"?: DataDrivenPropertyValueSpecification<number>,
        "icon-opacity-transition"?: TransitionSpecification,
        "icon-occlusion-opacity"?: DataDrivenPropertyValueSpecification<number>,
        "icon-occlusion-opacity-transition"?: TransitionSpecification,
        "icon-emissive-strength"?: DataDrivenPropertyValueSpecification<number>,
        "icon-emissive-strength-transition"?: TransitionSpecification,
        "text-emissive-strength"?: DataDrivenPropertyValueSpecification<number>,
        "text-emissive-strength-transition"?: TransitionSpecification,
        "icon-color"?: DataDrivenPropertyValueSpecification<ColorSpecification>,
        "icon-color-transition"?: TransitionSpecification,
        "icon-halo-color"?: DataDrivenPropertyValueSpecification<ColorSpecification>,
        "icon-halo-color-transition"?: TransitionSpecification,
        "icon-halo-width"?: DataDrivenPropertyValueSpecification<number>,
        "icon-halo-width-transition"?: TransitionSpecification,
        "icon-halo-blur"?: DataDrivenPropertyValueSpecification<number>,
        "icon-halo-blur-transition"?: TransitionSpecification,
        "icon-translate"?: PropertyValueSpecification<[number, number]>,
        "icon-translate-transition"?: TransitionSpecification,
        "icon-translate-anchor"?: PropertyValueSpecification<"map" | "viewport">,
        "icon-image-cross-fade"?: DataDrivenPropertyValueSpecification<number>,
        "icon-image-cross-fade-transition"?: TransitionSpecification,
        "text-opacity"?: DataDrivenPropertyValueSpecification<number>,
        "text-opacity-transition"?: TransitionSpecification,
        "text-occlusion-opacity"?: DataDrivenPropertyValueSpecification<number>,
        "text-occlusion-opacity-transition"?: TransitionSpecification,
        "text-color"?: DataDrivenPropertyValueSpecification<ColorSpecification>,
        "text-color-transition"?: TransitionSpecification,
        "text-halo-color"?: DataDrivenPropertyValueSpecification<ColorSpecification>,
        "text-halo-color-transition"?: TransitionSpecification,
        "text-halo-width"?: DataDrivenPropertyValueSpecification<number>,
        "text-halo-width-transition"?: TransitionSpecification,
        "text-halo-blur"?: DataDrivenPropertyValueSpecification<number>,
        "text-halo-blur-transition"?: TransitionSpecification,
        "text-translate"?: PropertyValueSpecification<[number, number]>,
        "text-translate-transition"?: TransitionSpecification,
        "text-translate-anchor"?: PropertyValueSpecification<"map" | "viewport">,
        "icon-color-saturation"?: ExpressionSpecification,
        "icon-color-contrast"?: ExpressionSpecification,
        "icon-color-brightness-min"?: ExpressionSpecification,
        "icon-color-brightness-max"?: ExpressionSpecification,
        "symbol-z-offset"?: DataDrivenPropertyValueSpecification<number>,
        "symbol-z-offset-transition"?: TransitionSpecification
    }
}

/**
 * @deprecated Use `SymbolLayerSpecification['layout']` instead.
 */
export type SymbolLayout = SymbolLayerSpecification['layout'];

/**
 * @deprecated Use `SymbolLayerSpecification['paint']` instead.
 */
export type SymbolPaint = SymbolLayerSpecification['paint'];

export type CircleLayerSpecification = {
    "id": string,
    "type": "circle",
    "metadata"?: unknown,
    "source": string,
    "source-layer"?: string,
    "slot"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: FilterSpecification,
    "layout"?: {
        "circle-sort-key"?: DataDrivenPropertyValueSpecification<number>,
        "visibility"?: "visible" | "none" | ExpressionSpecification
    },
    "paint"?: {
        "circle-radius"?: DataDrivenPropertyValueSpecification<number>,
        "circle-radius-transition"?: TransitionSpecification,
        "circle-color"?: DataDrivenPropertyValueSpecification<ColorSpecification>,
        "circle-color-transition"?: TransitionSpecification,
        "circle-blur"?: DataDrivenPropertyValueSpecification<number>,
        "circle-blur-transition"?: TransitionSpecification,
        "circle-opacity"?: DataDrivenPropertyValueSpecification<number>,
        "circle-opacity-transition"?: TransitionSpecification,
        "circle-translate"?: PropertyValueSpecification<[number, number]>,
        "circle-translate-transition"?: TransitionSpecification,
        "circle-translate-anchor"?: PropertyValueSpecification<"map" | "viewport">,
        "circle-pitch-scale"?: PropertyValueSpecification<"map" | "viewport">,
        "circle-pitch-alignment"?: PropertyValueSpecification<"map" | "viewport">,
        "circle-stroke-width"?: DataDrivenPropertyValueSpecification<number>,
        "circle-stroke-width-transition"?: TransitionSpecification,
        "circle-stroke-color"?: DataDrivenPropertyValueSpecification<ColorSpecification>,
        "circle-stroke-color-transition"?: TransitionSpecification,
        "circle-stroke-opacity"?: DataDrivenPropertyValueSpecification<number>,
        "circle-stroke-opacity-transition"?: TransitionSpecification,
        "circle-emissive-strength"?: PropertyValueSpecification<number>,
        "circle-emissive-strength-transition"?: TransitionSpecification
    }
}

/**
 * @deprecated Use `CircleLayerSpecification['layout']` instead.
 */
export type CircleLayout = CircleLayerSpecification['layout'];

/**
 * @deprecated Use `CircleLayerSpecification['paint']` instead.
 */
export type CirclePaint = CircleLayerSpecification['paint'];

export type HeatmapLayerSpecification = {
    "id": string,
    "type": "heatmap",
    "metadata"?: unknown,
    "source": string,
    "source-layer"?: string,
    "slot"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: FilterSpecification,
    "layout"?: {
        "visibility"?: "visible" | "none" | ExpressionSpecification
    },
    "paint"?: {
        "heatmap-radius"?: DataDrivenPropertyValueSpecification<number>,
        "heatmap-radius-transition"?: TransitionSpecification,
        "heatmap-weight"?: DataDrivenPropertyValueSpecification<number>,
        "heatmap-intensity"?: PropertyValueSpecification<number>,
        "heatmap-intensity-transition"?: TransitionSpecification,
        "heatmap-color"?: ExpressionSpecification,
        "heatmap-opacity"?: PropertyValueSpecification<number>,
        "heatmap-opacity-transition"?: TransitionSpecification
    }
}

/**
 * @deprecated Use `HeatmapLayerSpecification['layout']` instead.
 */
export type HeatmapLayout = HeatmapLayerSpecification['layout'];

/**
 * @deprecated Use `HeatmapLayerSpecification['paint']` instead.
 */
export type HeatmapPaint = HeatmapLayerSpecification['paint'];

export type FillExtrusionLayerSpecification = {
    "id": string,
    "type": "fill-extrusion",
    "metadata"?: unknown,
    "source": string,
    "source-layer"?: string,
    "slot"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: FilterSpecification,
    "layout"?: {
        "visibility"?: "visible" | "none" | ExpressionSpecification,
        /**
         * @experimental This property is experimental and subject to change in future versions.
         */
        "fill-extrusion-edge-radius"?: ExpressionSpecification
    },
    "paint"?: {
        "fill-extrusion-opacity"?: PropertyValueSpecification<number>,
        "fill-extrusion-opacity-transition"?: TransitionSpecification,
        "fill-extrusion-color"?: DataDrivenPropertyValueSpecification<ColorSpecification>,
        "fill-extrusion-color-transition"?: TransitionSpecification,
        "fill-extrusion-translate"?: PropertyValueSpecification<[number, number]>,
        "fill-extrusion-translate-transition"?: TransitionSpecification,
        "fill-extrusion-translate-anchor"?: PropertyValueSpecification<"map" | "viewport">,
        "fill-extrusion-pattern"?: DataDrivenPropertyValueSpecification<ResolvedImageSpecification>,
        "fill-extrusion-height"?: DataDrivenPropertyValueSpecification<number>,
        "fill-extrusion-height-transition"?: TransitionSpecification,
        "fill-extrusion-base"?: DataDrivenPropertyValueSpecification<number>,
        "fill-extrusion-base-transition"?: TransitionSpecification,
        /**
         * @experimental This property is experimental and subject to change in future versions.
         */
        "fill-extrusion-height-alignment"?: "terrain" | "flat",
        /**
         * @experimental This property is experimental and subject to change in future versions.
         */
        "fill-extrusion-base-alignment"?: "terrain" | "flat",
        "fill-extrusion-vertical-gradient"?: PropertyValueSpecification<boolean>,
        "fill-extrusion-ambient-occlusion-intensity"?: PropertyValueSpecification<number>,
        "fill-extrusion-ambient-occlusion-intensity-transition"?: TransitionSpecification,
        "fill-extrusion-ambient-occlusion-radius"?: PropertyValueSpecification<number>,
        "fill-extrusion-ambient-occlusion-radius-transition"?: TransitionSpecification,
        "fill-extrusion-ambient-occlusion-wall-radius"?: PropertyValueSpecification<number>,
        "fill-extrusion-ambient-occlusion-wall-radius-transition"?: TransitionSpecification,
        "fill-extrusion-ambient-occlusion-ground-radius"?: PropertyValueSpecification<number>,
        "fill-extrusion-ambient-occlusion-ground-radius-transition"?: TransitionSpecification,
        "fill-extrusion-ambient-occlusion-ground-attenuation"?: PropertyValueSpecification<number>,
        "fill-extrusion-ambient-occlusion-ground-attenuation-transition"?: TransitionSpecification,
        "fill-extrusion-flood-light-color"?: PropertyValueSpecification<ColorSpecification>,
        "fill-extrusion-flood-light-color-transition"?: TransitionSpecification,
        "fill-extrusion-flood-light-intensity"?: PropertyValueSpecification<number>,
        "fill-extrusion-flood-light-intensity-transition"?: TransitionSpecification,
        "fill-extrusion-flood-light-wall-radius"?: DataDrivenPropertyValueSpecification<number>,
        "fill-extrusion-flood-light-wall-radius-transition"?: TransitionSpecification,
        "fill-extrusion-flood-light-ground-radius"?: DataDrivenPropertyValueSpecification<number>,
        "fill-extrusion-flood-light-ground-radius-transition"?: TransitionSpecification,
        "fill-extrusion-flood-light-ground-attenuation"?: PropertyValueSpecification<number>,
        "fill-extrusion-flood-light-ground-attenuation-transition"?: TransitionSpecification,
        "fill-extrusion-vertical-scale"?: PropertyValueSpecification<number>,
        "fill-extrusion-vertical-scale-transition"?: TransitionSpecification,
        /**
         * @experimental This property is experimental and subject to change in future versions.
         */
        "fill-extrusion-rounded-roof"?: PropertyValueSpecification<boolean>,
        "fill-extrusion-cutoff-fade-range"?: ExpressionSpecification,
        "fill-extrusion-emissive-strength"?: DataDrivenPropertyValueSpecification<number>,
        "fill-extrusion-emissive-strength-transition"?: TransitionSpecification,
        "fill-extrusion-line-width"?: DataDrivenPropertyValueSpecification<number>,
        "fill-extrusion-line-width-transition"?: TransitionSpecification,
        "fill-extrusion-cast-shadows"?: boolean
    }
}

/**
 * @deprecated Use `FillExtrusionLayerSpecification['layout']` instead.
 */
export type FillExtrusionLayout = FillExtrusionLayerSpecification['layout'];

/**
 * @deprecated Use `FillExtrusionLayerSpecification['paint']` instead.
 */
export type FillExtrusionPaint = FillExtrusionLayerSpecification['paint'];

export type RasterLayerSpecification = {
    "id": string,
    "type": "raster",
    "metadata"?: unknown,
    "source": string,
    "source-layer"?: string,
    "slot"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: FilterSpecification,
    "layout"?: {
        "visibility"?: "visible" | "none" | ExpressionSpecification
    },
    "paint"?: {
        "raster-opacity"?: PropertyValueSpecification<number>,
        "raster-opacity-transition"?: TransitionSpecification,
        "raster-color"?: ExpressionSpecification,
        "raster-color-mix"?: PropertyValueSpecification<[number, number, number, number]>,
        "raster-color-mix-transition"?: TransitionSpecification,
        "raster-color-range"?: PropertyValueSpecification<[number, number]>,
        "raster-color-range-transition"?: TransitionSpecification,
        "raster-hue-rotate"?: PropertyValueSpecification<number>,
        "raster-hue-rotate-transition"?: TransitionSpecification,
        "raster-brightness-min"?: PropertyValueSpecification<number>,
        "raster-brightness-min-transition"?: TransitionSpecification,
        "raster-brightness-max"?: PropertyValueSpecification<number>,
        "raster-brightness-max-transition"?: TransitionSpecification,
        "raster-saturation"?: PropertyValueSpecification<number>,
        "raster-saturation-transition"?: TransitionSpecification,
        "raster-contrast"?: PropertyValueSpecification<number>,
        "raster-contrast-transition"?: TransitionSpecification,
        "raster-resampling"?: PropertyValueSpecification<"linear" | "nearest">,
        "raster-fade-duration"?: PropertyValueSpecification<number>,
        "raster-emissive-strength"?: PropertyValueSpecification<number>,
        "raster-emissive-strength-transition"?: TransitionSpecification,
        /**
         * @experimental This property is experimental and subject to change in future versions.
         */
        "raster-array-band"?: string,
        "raster-elevation"?: PropertyValueSpecification<number>,
        "raster-elevation-transition"?: TransitionSpecification
    }
}

/**
 * @deprecated Use `RasterLayerSpecification['layout']` instead.
 */
export type RasterLayout = RasterLayerSpecification['layout'];

/**
 * @deprecated Use `RasterLayerSpecification['paint']` instead.
 */
export type RasterPaint = RasterLayerSpecification['paint'];

export type RasterParticleLayerSpecification = {
    "id": string,
    "type": "raster-particle",
    "metadata"?: unknown,
    "source": string,
    "source-layer"?: string,
    "slot"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: FilterSpecification,
    "layout"?: {
        "visibility"?: "visible" | "none" | ExpressionSpecification
    },
    "paint"?: {
        "raster-particle-array-band"?: string,
        "raster-particle-count"?: number,
        "raster-particle-color"?: ExpressionSpecification,
        "raster-particle-max-speed"?: number,
        "raster-particle-speed-factor"?: PropertyValueSpecification<number>,
        "raster-particle-speed-factor-transition"?: TransitionSpecification,
        "raster-particle-fade-opacity-factor"?: PropertyValueSpecification<number>,
        "raster-particle-fade-opacity-factor-transition"?: TransitionSpecification,
        "raster-particle-reset-rate-factor"?: number,
        "raster-particle-elevation"?: PropertyValueSpecification<number>,
        "raster-particle-elevation-transition"?: TransitionSpecification
    }
}

/**
 * @deprecated Use `RasterParticleLayerSpecification['layout']` instead.
 */
export type RasterParticleLayout = RasterParticleLayerSpecification['layout'];

/**
 * @deprecated Use `RasterParticleLayerSpecification['paint']` instead.
 */
export type RasterParticlePaint = RasterParticleLayerSpecification['paint'];

export type HillshadeLayerSpecification = {
    "id": string,
    "type": "hillshade",
    "metadata"?: unknown,
    "source": string,
    "source-layer"?: string,
    "slot"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: FilterSpecification,
    "layout"?: {
        "visibility"?: "visible" | "none" | ExpressionSpecification
    },
    "paint"?: {
        "hillshade-illumination-direction"?: PropertyValueSpecification<number>,
        "hillshade-illumination-anchor"?: PropertyValueSpecification<"map" | "viewport">,
        "hillshade-exaggeration"?: PropertyValueSpecification<number>,
        "hillshade-exaggeration-transition"?: TransitionSpecification,
        "hillshade-shadow-color"?: PropertyValueSpecification<ColorSpecification>,
        "hillshade-shadow-color-transition"?: TransitionSpecification,
        "hillshade-highlight-color"?: PropertyValueSpecification<ColorSpecification>,
        "hillshade-highlight-color-transition"?: TransitionSpecification,
        "hillshade-accent-color"?: PropertyValueSpecification<ColorSpecification>,
        "hillshade-accent-color-transition"?: TransitionSpecification,
        "hillshade-emissive-strength"?: PropertyValueSpecification<number>,
        "hillshade-emissive-strength-transition"?: TransitionSpecification
    }
}

/**
 * @deprecated Use `HillshadeLayerSpecification['layout']` instead.
 */
export type HillshadeLayout = HillshadeLayerSpecification['layout'];

/**
 * @deprecated Use `HillshadeLayerSpecification['paint']` instead.
 */
export type HillshadePaint = HillshadeLayerSpecification['paint'];

export type ModelLayerSpecification = {
    "id": string,
    "type": "model",
    "metadata"?: unknown,
    "source": string,
    "source-layer"?: string,
    "slot"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: FilterSpecification,
    "layout"?: {
        "visibility"?: "visible" | "none" | ExpressionSpecification,
        "model-id"?: DataDrivenPropertyValueSpecification<string>
    },
    "paint"?: {
        "model-opacity"?: PropertyValueSpecification<number>,
        "model-opacity-transition"?: TransitionSpecification,
        "model-rotation"?: DataDrivenPropertyValueSpecification<[number, number, number]>,
        "model-rotation-transition"?: TransitionSpecification,
        "model-scale"?: DataDrivenPropertyValueSpecification<[number, number, number]>,
        "model-scale-transition"?: TransitionSpecification,
        "model-translation"?: DataDrivenPropertyValueSpecification<[number, number, number]>,
        "model-translation-transition"?: TransitionSpecification,
        "model-color"?: DataDrivenPropertyValueSpecification<ColorSpecification>,
        "model-color-transition"?: TransitionSpecification,
        "model-color-mix-intensity"?: DataDrivenPropertyValueSpecification<number>,
        "model-color-mix-intensity-transition"?: TransitionSpecification,
        "model-type"?: "common-3d" | "location-indicator",
        "model-cast-shadows"?: boolean,
        "model-receive-shadows"?: boolean,
        "model-ambient-occlusion-intensity"?: PropertyValueSpecification<number>,
        "model-ambient-occlusion-intensity-transition"?: TransitionSpecification,
        "model-emissive-strength"?: DataDrivenPropertyValueSpecification<number>,
        "model-emissive-strength-transition"?: TransitionSpecification,
        "model-roughness"?: DataDrivenPropertyValueSpecification<number>,
        "model-roughness-transition"?: TransitionSpecification,
        "model-height-based-emissive-strength-multiplier"?: DataDrivenPropertyValueSpecification<[number, number, number, number, number]>,
        "model-height-based-emissive-strength-multiplier-transition"?: TransitionSpecification,
        "model-cutoff-fade-range"?: ExpressionSpecification,
        "model-front-cutoff"?: PropertyValueSpecification<[number, number, number]>
    }
}

/**
 * @deprecated Use `ModelLayerSpecification['layout']` instead.
 */
export type ModelLayout = ModelLayerSpecification['layout'];

/**
 * @deprecated Use `ModelLayerSpecification['paint']` instead.
 */
export type ModelPaint = ModelLayerSpecification['paint'];

export type BackgroundLayerSpecification = {
    "id": string,
    "type": "background",
    "metadata"?: unknown,
    "source"?: never,
    "source-layer"?: never,
    "slot"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: never,
    "layout"?: {
        "visibility"?: "visible" | "none" | ExpressionSpecification
    },
    "paint"?: {
        "background-pitch-alignment"?: "map" | "viewport" | ExpressionSpecification,
        "background-color"?: PropertyValueSpecification<ColorSpecification>,
        "background-color-transition"?: TransitionSpecification,
        "background-pattern"?: PropertyValueSpecification<ResolvedImageSpecification>,
        "background-opacity"?: PropertyValueSpecification<number>,
        "background-opacity-transition"?: TransitionSpecification,
        "background-emissive-strength"?: PropertyValueSpecification<number>,
        "background-emissive-strength-transition"?: TransitionSpecification
    }
}

/**
 * @deprecated Use `BackgroundLayerSpecification['layout']` instead.
 */
export type BackgroundLayout = BackgroundLayerSpecification['layout'];

/**
 * @deprecated Use `BackgroundLayerSpecification['paint']` instead.
 */
export type BackgroundPaint = BackgroundLayerSpecification['paint'];

export type SkyLayerSpecification = {
    "id": string,
    "type": "sky",
    "metadata"?: unknown,
    "source"?: never,
    "source-layer"?: never,
    "slot"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: never,
    "layout"?: {
        "visibility"?: "visible" | "none" | ExpressionSpecification
    },
    "paint"?: {
        "sky-type"?: PropertyValueSpecification<"gradient" | "atmosphere">,
        "sky-atmosphere-sun"?: PropertyValueSpecification<[number, number]>,
        "sky-atmosphere-sun-intensity"?: number,
        "sky-gradient-center"?: PropertyValueSpecification<[number, number]>,
        "sky-gradient-radius"?: PropertyValueSpecification<number>,
        "sky-gradient"?: ExpressionSpecification,
        "sky-atmosphere-halo-color"?: ColorSpecification,
        "sky-atmosphere-color"?: ColorSpecification,
        "sky-opacity"?: PropertyValueSpecification<number>,
        "sky-opacity-transition"?: TransitionSpecification
    }
}

/**
 * @deprecated Use `SkyLayerSpecification['layout']` instead.
 */
export type SkyLayout = SkyLayerSpecification['layout'];

/**
 * @deprecated Use `SkyLayerSpecification['paint']` instead.
 */
export type SkyPaint = SkyLayerSpecification['paint'];

export type SlotLayerSpecification = {
    "id": string,
    "type": "slot",
    "metadata"?: unknown,
    "source"?: never,
    "source-layer"?: never,
    "slot"?: string,
    "minzoom"?: never,
    "maxzoom"?: never,
    "filter"?: never,
    "layout"?: never,
    "paint"?: never
}

export type ClipLayerSpecification = {
    "id": string,
    "type": "clip",
    "metadata"?: unknown,
    "source": string,
    "source-layer"?: string,
    "slot"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: FilterSpecification,
    "layout"?: {
        /**
         * @experimental This property is experimental and subject to change in future versions.
         */
        "clip-layer-types"?: ExpressionSpecification,
        /**
         * @experimental This property is experimental and subject to change in future versions.
         */
        "clip-layer-scope"?: ExpressionSpecification
    },
    "paint"?: never
}

/**
 * @deprecated Use `ClipLayerSpecification['layout']` instead.
 */
export type ClipLayout = ClipLayerSpecification['layout'];

export type LayerSpecification =
    | FillLayerSpecification
    | LineLayerSpecification
    | SymbolLayerSpecification
    | CircleLayerSpecification
    | HeatmapLayerSpecification
    | FillExtrusionLayerSpecification
    | RasterLayerSpecification
    | RasterParticleLayerSpecification
    | HillshadeLayerSpecification
    | ModelLayerSpecification
    | BackgroundLayerSpecification
    | SkyLayerSpecification
    | SlotLayerSpecification
    | ClipLayerSpecification;

export type LayoutSpecification = UnionToIntersection<NonNullable<LayerSpecification['layout']>>;

export type PaintSpecification = UnionToIntersection<NonNullable<LayerSpecification['paint']>>;

// Aliases for easier migration from @types/mapbox-gl

export type Layer = Pick<
    LayerSpecification,
    | "id"
    | "type"
    | "source"
    | "source-layer"
    | "slot"
    | "filter"
    | "layout"
    | "paint"
    | "minzoom"
    | "maxzoom"
    | "metadata"
>;

/**
 * @deprecated Use `StyleSpecification` instead.
 */
export type Style = StyleSpecification;

/**
 * @deprecated Use `LayerSpecification` instead.
 */
export type AnyLayer = LayerSpecification;

/**
 * @deprecated Use `FillLayerSpecification` instead.
 */
export type FillLayer = FillLayerSpecification;

/**
 * @deprecated Use `LineLayerSpecification` instead.
 */
export type LineLayer = LineLayerSpecification;

/**
 * @deprecated Use `SymbolLayerSpecification` instead.
 */
export type SymbolLayer = SymbolLayerSpecification;

/**
 * @deprecated Use `CircleLayerSpecification` instead.
 */
export type CircleLayer = CircleLayerSpecification;

/**
 * @deprecated Use `HeatmapLayerSpecification` instead.
 */
export type HeatmapLayer = HeatmapLayerSpecification;

/**
 * @deprecated Use `FillExtrusionLayerSpecification` instead.
 */
export type FillExtrusionLayer = FillExtrusionLayerSpecification;

/**
 * @deprecated Use `RasterLayerSpecification` instead.
 */
export type RasterLayer = RasterLayerSpecification;

/**
 * @deprecated Use `RasterParticleLayerSpecification` instead.
 */
export type RasterParticleLayer = RasterParticleLayerSpecification;

/**
 * @deprecated Use `HillshadeLayerSpecification` instead.
 */
export type HillshadeLayer = HillshadeLayerSpecification;

/**
 * @deprecated Use `ModelLayerSpecification` instead.
 */
export type ModelLayer = ModelLayerSpecification;

/**
 * @deprecated Use `BackgroundLayerSpecification` instead.
 */
export type BackgroundLayer = BackgroundLayerSpecification;

/**
 * @deprecated Use `SkyLayerSpecification` instead.
 */
export type SkyLayer = SkyLayerSpecification;

/**
 * @deprecated Use `SlotLayerSpecification` instead.
 */
export type SlotLayer = SlotLayerSpecification;

/**
 * @deprecated Use `ClipLayerSpecification` instead.
 */
export type ClipLayer = ClipLayerSpecification;

/**
 * @deprecated Use `LayoutSpecification` instead.
 */
export type AnyLayout = LayoutSpecification;

/**
 * @deprecated Use `PaintSpecification` instead.
 */
export type AnyPaint = PaintSpecification;

/**
 * @deprecated Use `ExpressionSpecification` instead.
 */
export type Expression = ExpressionSpecification;

/**
 * @deprecated Use `TransitionSpecification` instead.
 */
export type Transition = TransitionSpecification;

/**
 * @deprecated Use `SourceSpecification` instead.
 */
export type AnySourceData = SourceSpecification;

/**
 * @deprecated Use `SourcesSpecification` instead.
 */
export type Sources = SourcesSpecification;

/**
 * @deprecated Use `ProjectionSpecification` instead.
 */
export type Projection = ProjectionSpecification;
