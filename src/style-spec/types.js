// @flow
// Generated code; do not edit. Edit build/generate-flow-typed-style-spec.js instead.
/* eslint-disable */

export type ColorSpecification = string;

export type FormattedSpecification = string;

export type ResolvedImageSpecification = string;

export type PromoteIdSpecification = {[_: string]: string} | string;

export type FilterSpecification =
    | ['has', string]
    | ['!has', string]
    | ['==', string, string | number | boolean]
    | ['!=', string, string | number | boolean]
    | ['>', string, string | number | boolean]
    | ['>=', string, string | number | boolean]
    | ['<', string, string | number | boolean]
    | ['<=', string, string | number | boolean]
    | Array<string | FilterSpecification>; // Can't type in, !in, all, any, none -- https://github.com/facebook/flow/issues/2443

export type TransitionSpecification = {
    duration?: number,
    delay?: number
};

// Note: doesn't capture interpolatable vs. non-interpolatable types.

export type CameraFunctionSpecification<T> =
    | {| type: 'exponential', stops: Array<[number, T]> |}
    | {| type: 'interval',    stops: Array<[number, T]> |};

export type SourceFunctionSpecification<T> =
    | {| type: 'exponential', stops: Array<[number, T]>, property: string, default?: T |}
    | {| type: 'interval',    stops: Array<[number, T]>, property: string, default?: T |}
    | {| type: 'categorical', stops: Array<[string | number | boolean, T]>, property: string, default?: T |}
    | {| type: 'identity', property: string, default?: T |};

export type CompositeFunctionSpecification<T> =
    | {| type: 'exponential', stops: Array<[{zoom: number, value: number}, T]>, property: string, default?: T |}
    | {| type: 'interval',    stops: Array<[{zoom: number, value: number}, T]>, property: string, default?: T |}
    | {| type: 'categorical', stops: Array<[{zoom: number, value: string | number | boolean}, T]>, property: string, default?: T |};

export type ExpressionSpecification = Array<mixed>;

export type PropertyValueSpecification<T> =
    | T
    | CameraFunctionSpecification<T>
    | ExpressionSpecification;

export type DataDrivenPropertyValueSpecification<T> =
    | T
    | CameraFunctionSpecification<T>
    | SourceFunctionSpecification<T>
    | CompositeFunctionSpecification<T>
    | ExpressionSpecification;

export type StyleSpecification = {|
    "version": 8,
    "fragment"?: boolean,
    "name"?: string,
    "metadata"?: mixed,
    "center"?: Array<number>,
    "zoom"?: number,
    "bearing"?: number,
    "pitch"?: number,
    "light"?: LightSpecification,
    "lights"?: Array<LightsSpecification>,
    "terrain"?: TerrainSpecification,
    "fog"?: FogSpecification,
    "camera"?: CameraSpecification,
    "imports"?: Array<ImportSpecification>,
    "schema"?: SchemaSpecification,
    "sources": SourcesSpecification,
    "sprite"?: string,
    "glyphs"?: string,
    "transition"?: TransitionSpecification,
    "projection"?: ProjectionSpecification,
    "layers": Array<LayerSpecification>,
    "models"?: ModelsSpecification
|}

export type SourcesSpecification = {
    [_: string]: SourceSpecification
}

export type ModelsSpecification = {
    [_: string]: ModelSpecification
}

export type LightSpecification = {|
    "anchor"?: PropertyValueSpecification<"map" | "viewport">,
    "position"?: PropertyValueSpecification<[number, number, number]>,
    "color"?: PropertyValueSpecification<ColorSpecification>,
    "intensity"?: PropertyValueSpecification<number>
|}

export type TerrainSpecification = {|
    "source": string,
    "exaggeration"?: PropertyValueSpecification<number>
|}

export type FogSpecification = {|
    "range"?: PropertyValueSpecification<[number, number]>,
    "color"?: PropertyValueSpecification<ColorSpecification>,
    "high-color"?: PropertyValueSpecification<ColorSpecification>,
    "space-color"?: PropertyValueSpecification<ColorSpecification>,
    "horizon-blend"?: PropertyValueSpecification<number>,
    "star-intensity"?: PropertyValueSpecification<number>,
    "vertical-range"?: PropertyValueSpecification<[number, number]>
|}

export type CameraSpecification = {|
    "camera-projection"?: PropertyValueSpecification<"perspective" | "orthographic">
|}

export type ProjectionSpecification = {|
    "name": "albers" | "equalEarth" | "equirectangular" | "lambertConformalConic" | "mercator" | "naturalEarth" | "winkelTripel" | "globe",
    "center"?: [number, number],
    "parallels"?: [number, number]
|}

export type ImportSpecification = {|
    "id": string,
    "url": string,
    "config"?: ConfigSpecification,
    "data"?: StyleSpecification
|}

export type ConfigSpecification = {
    [_: string]: mixed
}

export type SchemaSpecification = {
    [_: string]: OptionSpecification
}

export type OptionSpecification = {|
    "default": mixed,
    "type"?: "string" | "number" | "boolean" | "color",
    "array"?: boolean,
    "minValue"?: number,
    "maxValue"?: number,
    "stepValue"?: number,
    "values"?: Array<mixed>,
    "metadata"?: mixed
|}

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
    [_: string]: mixed
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
    [_: string]: mixed
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
    [_: string]: mixed
}

export type GeoJSONSourceSpecification = {|
    "type": "geojson",
    "data"?: mixed,
    "maxzoom"?: number,
    "attribution"?: string,
    "buffer"?: number,
    "filter"?: mixed,
    "tolerance"?: number,
    "cluster"?: boolean,
    "clusterRadius"?: number,
    "clusterMaxZoom"?: number,
    "clusterMinPoints"?: number,
    "clusterProperties"?: mixed,
    "lineMetrics"?: boolean,
    "generateId"?: boolean,
    "promoteId"?: PromoteIdSpecification
|}

export type VideoSourceSpecification = {|
    "type": "video",
    "urls": Array<string>,
    "coordinates": [[number, number], [number, number], [number, number], [number, number]]
|}

export type ImageSourceSpecification = {|
    "type": "image",
    "url"?: string,
    "coordinates": [[number, number], [number, number], [number, number], [number, number]]
|}

export type ModelSourceSpecification = {|
    "type": "model" | "batched-model",
    "maxzoom"?: number,
    "minzoom"?: number,
    "tiles"?: Array<string>
|}

export type SourceSpecification =
    | VectorSourceSpecification
    | RasterSourceSpecification
    | RasterDEMSourceSpecification
    | GeoJSONSourceSpecification
    | VideoSourceSpecification
    | ImageSourceSpecification
    | ModelSourceSpecification

export type ModelSpecification = string;

export type AmbientLightSpecification = {|
    "id": string,
    "properties"?: {|
        "color"?: PropertyValueSpecification<ColorSpecification>,
        "intensity"?: PropertyValueSpecification<number>
    |},
    "type": "ambient"
|}

export type DirectionalLightSpecification = {|
    "id": string,
    "properties"?: {|
        "direction"?: PropertyValueSpecification<[number, number]>,
        "color"?: PropertyValueSpecification<ColorSpecification>,
        "intensity"?: PropertyValueSpecification<number>,
        "cast-shadows"?: ExpressionSpecification,
        "shadow-intensity"?: PropertyValueSpecification<number>
    |},
    "type": "directional"
|}

export type FlatLightSpecification = {|
    "id": string,
    "properties"?: {|
        "anchor"?: PropertyValueSpecification<"map" | "viewport">,
        "position"?: PropertyValueSpecification<[number, number, number]>,
        "color"?: PropertyValueSpecification<ColorSpecification>,
        "intensity"?: PropertyValueSpecification<number>
    |},
    "type": "flat"
|}

export type LightsSpecification =
    | AmbientLightSpecification
    | DirectionalLightSpecification
    | FlatLightSpecification;

export type FillLayerSpecification = {|
    "id": string,
    "type": "fill",
    "metadata"?: mixed,
    "source": string,
    "source-layer"?: string,
    "slot"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: FilterSpecification,
    "layout"?: {|
        "fill-sort-key"?: DataDrivenPropertyValueSpecification<number>,
        "visibility"?: ExpressionSpecification
    |},
    "paint"?: {|
        "fill-antialias"?: PropertyValueSpecification<boolean>,
        "fill-opacity"?: DataDrivenPropertyValueSpecification<number>,
        "fill-color"?: DataDrivenPropertyValueSpecification<ColorSpecification>,
        "fill-outline-color"?: DataDrivenPropertyValueSpecification<ColorSpecification>,
        "fill-translate"?: PropertyValueSpecification<[number, number]>,
        "fill-translate-anchor"?: PropertyValueSpecification<"map" | "viewport">,
        "fill-pattern"?: DataDrivenPropertyValueSpecification<ResolvedImageSpecification>,
        "fill-emissive-strength"?: PropertyValueSpecification<number>
    |}
|}

export type LineLayerSpecification = {|
    "id": string,
    "type": "line",
    "metadata"?: mixed,
    "source": string,
    "source-layer"?: string,
    "slot"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: FilterSpecification,
    "layout"?: {|
        "line-cap"?: DataDrivenPropertyValueSpecification<"butt" | "round" | "square">,
        "line-join"?: DataDrivenPropertyValueSpecification<"bevel" | "round" | "miter">,
        "line-miter-limit"?: PropertyValueSpecification<number>,
        "line-round-limit"?: PropertyValueSpecification<number>,
        "line-sort-key"?: DataDrivenPropertyValueSpecification<number>,
        "visibility"?: ExpressionSpecification
    |},
    "paint"?: {|
        "line-opacity"?: DataDrivenPropertyValueSpecification<number>,
        "line-color"?: DataDrivenPropertyValueSpecification<ColorSpecification>,
        "line-translate"?: PropertyValueSpecification<[number, number]>,
        "line-translate-anchor"?: PropertyValueSpecification<"map" | "viewport">,
        "line-width"?: DataDrivenPropertyValueSpecification<number>,
        "line-gap-width"?: DataDrivenPropertyValueSpecification<number>,
        "line-offset"?: DataDrivenPropertyValueSpecification<number>,
        "line-blur"?: DataDrivenPropertyValueSpecification<number>,
        "line-dasharray"?: DataDrivenPropertyValueSpecification<Array<number>>,
        "line-pattern"?: DataDrivenPropertyValueSpecification<ResolvedImageSpecification>,
        "line-gradient"?: ExpressionSpecification,
        "line-trim-offset"?: [number, number],
        "line-emissive-strength"?: PropertyValueSpecification<number>,
        "line-border-width"?: DataDrivenPropertyValueSpecification<number>,
        "line-border-color"?: DataDrivenPropertyValueSpecification<ColorSpecification>
    |}
|}

export type SymbolLayerSpecification = {|
    "id": string,
    "type": "symbol",
    "metadata"?: mixed,
    "source": string,
    "source-layer"?: string,
    "slot"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: FilterSpecification,
    "layout"?: {|
        "symbol-placement"?: PropertyValueSpecification<"point" | "line" | "line-center">,
        "symbol-spacing"?: PropertyValueSpecification<number>,
        "symbol-avoid-edges"?: PropertyValueSpecification<boolean>,
        "symbol-sort-key"?: DataDrivenPropertyValueSpecification<number>,
        "symbol-z-order"?: PropertyValueSpecification<"auto" | "viewport-y" | "source">,
        "symbol-z-elevate"?: PropertyValueSpecification<boolean>,
        "icon-allow-overlap"?: PropertyValueSpecification<boolean>,
        "icon-ignore-placement"?: PropertyValueSpecification<boolean>,
        "icon-optional"?: PropertyValueSpecification<boolean>,
        "icon-rotation-alignment"?: PropertyValueSpecification<"map" | "viewport" | "auto">,
        "icon-size"?: DataDrivenPropertyValueSpecification<number>,
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
        "visibility"?: ExpressionSpecification
    |},
    "paint"?: {|
        "icon-opacity"?: DataDrivenPropertyValueSpecification<number>,
        "icon-emissive-strength"?: DataDrivenPropertyValueSpecification<number>,
        "text-emissive-strength"?: DataDrivenPropertyValueSpecification<number>,
        "icon-color"?: DataDrivenPropertyValueSpecification<ColorSpecification>,
        "icon-halo-color"?: DataDrivenPropertyValueSpecification<ColorSpecification>,
        "icon-halo-width"?: DataDrivenPropertyValueSpecification<number>,
        "icon-halo-blur"?: DataDrivenPropertyValueSpecification<number>,
        "icon-translate"?: PropertyValueSpecification<[number, number]>,
        "icon-translate-anchor"?: PropertyValueSpecification<"map" | "viewport">,
        "icon-image-cross-fade"?: DataDrivenPropertyValueSpecification<number>,
        "text-opacity"?: DataDrivenPropertyValueSpecification<number>,
        "text-color"?: DataDrivenPropertyValueSpecification<ColorSpecification>,
        "text-halo-color"?: DataDrivenPropertyValueSpecification<ColorSpecification>,
        "text-halo-width"?: DataDrivenPropertyValueSpecification<number>,
        "text-halo-blur"?: DataDrivenPropertyValueSpecification<number>,
        "text-translate"?: PropertyValueSpecification<[number, number]>,
        "text-translate-anchor"?: PropertyValueSpecification<"map" | "viewport">
    |}
|}

export type CircleLayerSpecification = {|
    "id": string,
    "type": "circle",
    "metadata"?: mixed,
    "source": string,
    "source-layer"?: string,
    "slot"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: FilterSpecification,
    "layout"?: {|
        "circle-sort-key"?: DataDrivenPropertyValueSpecification<number>,
        "visibility"?: ExpressionSpecification
    |},
    "paint"?: {|
        "circle-radius"?: DataDrivenPropertyValueSpecification<number>,
        "circle-color"?: DataDrivenPropertyValueSpecification<ColorSpecification>,
        "circle-blur"?: DataDrivenPropertyValueSpecification<number>,
        "circle-opacity"?: DataDrivenPropertyValueSpecification<number>,
        "circle-translate"?: PropertyValueSpecification<[number, number]>,
        "circle-translate-anchor"?: PropertyValueSpecification<"map" | "viewport">,
        "circle-pitch-scale"?: PropertyValueSpecification<"map" | "viewport">,
        "circle-pitch-alignment"?: PropertyValueSpecification<"map" | "viewport">,
        "circle-stroke-width"?: DataDrivenPropertyValueSpecification<number>,
        "circle-stroke-color"?: DataDrivenPropertyValueSpecification<ColorSpecification>,
        "circle-stroke-opacity"?: DataDrivenPropertyValueSpecification<number>,
        "circle-emissive-strength"?: PropertyValueSpecification<number>
    |}
|}

export type HeatmapLayerSpecification = {|
    "id": string,
    "type": "heatmap",
    "metadata"?: mixed,
    "source": string,
    "source-layer"?: string,
    "slot"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: FilterSpecification,
    "layout"?: {|
        "visibility"?: ExpressionSpecification
    |},
    "paint"?: {|
        "heatmap-radius"?: DataDrivenPropertyValueSpecification<number>,
        "heatmap-weight"?: DataDrivenPropertyValueSpecification<number>,
        "heatmap-intensity"?: PropertyValueSpecification<number>,
        "heatmap-color"?: ExpressionSpecification,
        "heatmap-opacity"?: PropertyValueSpecification<number>
    |}
|}

export type FillExtrusionLayerSpecification = {|
    "id": string,
    "type": "fill-extrusion",
    "metadata"?: mixed,
    "source": string,
    "source-layer"?: string,
    "slot"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: FilterSpecification,
    "layout"?: {|
        "visibility"?: ExpressionSpecification,
        "fill-extrusion-edge-radius"?: ExpressionSpecification
    |},
    "paint"?: {|
        "fill-extrusion-opacity"?: PropertyValueSpecification<number>,
        "fill-extrusion-color"?: DataDrivenPropertyValueSpecification<ColorSpecification>,
        "fill-extrusion-translate"?: PropertyValueSpecification<[number, number]>,
        "fill-extrusion-translate-anchor"?: PropertyValueSpecification<"map" | "viewport">,
        "fill-extrusion-pattern"?: DataDrivenPropertyValueSpecification<ResolvedImageSpecification>,
        "fill-extrusion-height"?: DataDrivenPropertyValueSpecification<number>,
        "fill-extrusion-base"?: DataDrivenPropertyValueSpecification<number>,
        "fill-extrusion-vertical-gradient"?: PropertyValueSpecification<boolean>,
        "fill-extrusion-ambient-occlusion-intensity"?: PropertyValueSpecification<number>,
        "fill-extrusion-ambient-occlusion-radius"?: PropertyValueSpecification<number>,
        "fill-extrusion-ambient-occlusion-wall-radius"?: PropertyValueSpecification<number>,
        "fill-extrusion-ambient-occlusion-ground-radius"?: PropertyValueSpecification<number>,
        "fill-extrusion-ambient-occlusion-ground-attenuation"?: PropertyValueSpecification<number>,
        "fill-extrusion-flood-light-color"?: PropertyValueSpecification<ColorSpecification>,
        "fill-extrusion-flood-light-intensity"?: PropertyValueSpecification<number>,
        "fill-extrusion-flood-light-wall-radius"?: DataDrivenPropertyValueSpecification<number>,
        "fill-extrusion-flood-light-ground-radius"?: DataDrivenPropertyValueSpecification<number>,
        "fill-extrusion-flood-light-ground-attenuation"?: PropertyValueSpecification<number>,
        "fill-extrusion-vertical-scale"?: PropertyValueSpecification<number>,
        "fill-extrusion-rounded-roof"?: PropertyValueSpecification<boolean>,
        "fill-extrusion-cutoff-fade-range"?: ExpressionSpecification
    |}
|}

export type RasterLayerSpecification = {|
    "id": string,
    "type": "raster",
    "metadata"?: mixed,
    "source": string,
    "source-layer"?: string,
    "slot"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: FilterSpecification,
    "layout"?: {|
        "visibility"?: ExpressionSpecification
    |},
    "paint"?: {|
        "raster-opacity"?: PropertyValueSpecification<number>,
        "raster-color"?: ExpressionSpecification,
        "raster-color-mix"?: PropertyValueSpecification<[number, number, number, number]>,
        "raster-color-range"?: PropertyValueSpecification<[number, number]>,
        "raster-hue-rotate"?: PropertyValueSpecification<number>,
        "raster-brightness-min"?: PropertyValueSpecification<number>,
        "raster-brightness-max"?: PropertyValueSpecification<number>,
        "raster-saturation"?: PropertyValueSpecification<number>,
        "raster-contrast"?: PropertyValueSpecification<number>,
        "raster-resampling"?: PropertyValueSpecification<"linear" | "nearest">,
        "raster-fade-duration"?: PropertyValueSpecification<number>
    |}
|}

export type HillshadeLayerSpecification = {|
    "id": string,
    "type": "hillshade",
    "metadata"?: mixed,
    "source": string,
    "source-layer"?: string,
    "slot"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: FilterSpecification,
    "layout"?: {|
        "visibility"?: ExpressionSpecification
    |},
    "paint"?: {|
        "hillshade-illumination-direction"?: PropertyValueSpecification<number>,
        "hillshade-illumination-anchor"?: PropertyValueSpecification<"map" | "viewport">,
        "hillshade-exaggeration"?: PropertyValueSpecification<number>,
        "hillshade-shadow-color"?: PropertyValueSpecification<ColorSpecification>,
        "hillshade-highlight-color"?: PropertyValueSpecification<ColorSpecification>,
        "hillshade-accent-color"?: PropertyValueSpecification<ColorSpecification>,
        "hillshade-emissive-strength"?: PropertyValueSpecification<number>
    |}
|}

export type ModelLayerSpecification = {|
    "id": string,
    "type": "model",
    "metadata"?: mixed,
    "source": string,
    "source-layer"?: string,
    "slot"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: FilterSpecification,
    "layout"?: {|
        "visibility"?: ExpressionSpecification,
        "model-id"?: DataDrivenPropertyValueSpecification<string>
    |},
    "paint"?: {|
        "model-opacity"?: PropertyValueSpecification<number>,
        "model-rotation"?: DataDrivenPropertyValueSpecification<[number, number, number]>,
        "model-scale"?: DataDrivenPropertyValueSpecification<[number, number, number]>,
        "model-translation"?: DataDrivenPropertyValueSpecification<[number, number, number]>,
        "model-color"?: DataDrivenPropertyValueSpecification<ColorSpecification>,
        "model-color-mix-intensity"?: DataDrivenPropertyValueSpecification<number>,
        "model-type"?: "common-3d" | "location-indicator",
        "model-cast-shadows"?: ExpressionSpecification,
        "model-receive-shadows"?: ExpressionSpecification,
        "model-ambient-occlusion-intensity"?: PropertyValueSpecification<number>,
        "model-emissive-strength"?: DataDrivenPropertyValueSpecification<number>,
        "model-roughness"?: DataDrivenPropertyValueSpecification<number>,
        "model-height-based-emissive-strength-multiplier"?: DataDrivenPropertyValueSpecification<[number, number, number, number, number]>,
        "model-cutoff-fade-range"?: ExpressionSpecification
    |}
|}

export type BackgroundLayerSpecification = {|
    "id": string,
    "type": "background",
    "metadata"?: mixed,
    "slot"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "layout"?: {|
        "visibility"?: ExpressionSpecification
    |},
    "paint"?: {|
        "background-color"?: PropertyValueSpecification<ColorSpecification>,
        "background-pattern"?: PropertyValueSpecification<ResolvedImageSpecification>,
        "background-opacity"?: PropertyValueSpecification<number>,
        "background-emissive-strength"?: PropertyValueSpecification<number>
    |}
|}

export type SkyLayerSpecification = {|
    "id": string,
    "type": "sky",
    "metadata"?: mixed,
    "slot"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "layout"?: {|
        "visibility"?: ExpressionSpecification
    |},
    "paint"?: {|
        "sky-type"?: PropertyValueSpecification<"gradient" | "atmosphere">,
        "sky-atmosphere-sun"?: PropertyValueSpecification<[number, number]>,
        "sky-atmosphere-sun-intensity"?: number,
        "sky-gradient-center"?: PropertyValueSpecification<[number, number]>,
        "sky-gradient-radius"?: PropertyValueSpecification<number>,
        "sky-gradient"?: ExpressionSpecification,
        "sky-atmosphere-halo-color"?: ColorSpecification,
        "sky-atmosphere-color"?: ColorSpecification,
        "sky-opacity"?: PropertyValueSpecification<number>
    |}
|}

export type SlotLayerSpecification = {|
    "id": string,
    "type": "slot",
    "metadata"?: mixed,
    "slot"?: string
|}

export type LayerSpecification =
    | FillLayerSpecification
    | LineLayerSpecification
    | SymbolLayerSpecification
    | CircleLayerSpecification
    | HeatmapLayerSpecification
    | FillExtrusionLayerSpecification
    | RasterLayerSpecification
    | HillshadeLayerSpecification
    | ModelLayerSpecification
    | BackgroundLayerSpecification
    | SkyLayerSpecification
    | SlotLayerSpecification;

