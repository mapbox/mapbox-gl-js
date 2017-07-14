// Generated code; do not edit. Edit build/generate-flow-typed-style-spec.js instead.

declare type ColorSpecification = string;
declare type FilterSpecification = Array<any>;

declare type StyleSpecification = {|
    "version": 8,
    "name"?: string,
    "metadata"?: mixed,
    "center"?: Array<number>,
    "zoom"?: number,
    "bearing"?: number,
    "pitch"?: number,
    "light"?: LightSpecification,
    "sources": {[string]: SourceSpecification},
    "sprite"?: string,
    "glyphs"?: string,
    "transition"?: TransitionSpecification,
    "layers": Array<LayerSpecification>
|}

declare type LightSpecification = {|
    "anchor"?: "map" | "viewport",
    "position"?: [number, number, number],
    "color"?: ColorSpecification,
    "intensity"?: number
|}

declare type TileSourceSpecification = {
    "type": "vector" | "raster",
    "url"?: string,
    "tiles"?: Array<string>,
    "minzoom"?: number,
    "maxzoom"?: number,
    "tileSize"?: number
}

declare type GeojsonSourceSpecification = {|
    "type": "geojson",
    "data"?: mixed,
    "maxzoom"?: number,
    "buffer"?: number,
    "tolerance"?: number,
    "cluster"?: boolean,
    "clusterRadius"?: number,
    "clusterMaxZoom"?: number
|}

declare type VideoSourceSpecification = {|
    "type": "video",
    "urls": Array<string>,
    "coordinates": [[number, number], [number, number], [number, number], [number, number]]
|}

declare type ImageSourceSpecification = {|
    "type": "image",
    "url": string,
    "coordinates": [[number, number], [number, number], [number, number], [number, number]]
|}

declare type CanvasSourceSpecification = {|
    "type": "canvas",
    "coordinates": [[number, number], [number, number], [number, number], [number, number]],
    "animate"?: boolean,
    "canvas": string
|}

declare type SourceSpecification =
    | TileSourceSpecification
    | GeojsonSourceSpecification
    | VideoSourceSpecification
    | ImageSourceSpecification
    | CanvasSourceSpecification

declare type FillLayerSpecification = {|
    "id": string,
    "type": "fill",
    "metadata"?: mixed,
    "source": string,
    "source-layer"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: FilterSpecification,
    "layout"?: {|
        "fill-antialias"?: boolean,
        "fill-opacity"?: number,
        "fill-color"?: ColorSpecification,
        "fill-outline-color"?: ColorSpecification,
        "fill-translate"?: [number, number],
        "fill-translate-anchor"?: "map" | "viewport",
        "fill-pattern"?: string
    |},
    "paint"?: {|
        "visibility"?: "visible" | "none"
    |}
|}

declare type LineLayerSpecification = {|
    "id": string,
    "type": "line",
    "metadata"?: mixed,
    "source": string,
    "source-layer"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: FilterSpecification,
    "layout"?: {|
        "line-opacity"?: number,
        "line-color"?: ColorSpecification,
        "line-translate"?: [number, number],
        "line-translate-anchor"?: "map" | "viewport",
        "line-width"?: number,
        "line-gap-width"?: number,
        "line-offset"?: number,
        "line-blur"?: number,
        "line-dasharray"?: Array<number>,
        "line-pattern"?: string
    |},
    "paint"?: {|
        "line-cap"?: "butt" | "round" | "square",
        "line-join"?: "bevel" | "round" | "miter",
        "line-miter-limit"?: number,
        "line-round-limit"?: number,
        "visibility"?: "visible" | "none"
    |}
|}

declare type SymbolLayerSpecification = {|
    "id": string,
    "type": "symbol",
    "metadata"?: mixed,
    "source": string,
    "source-layer"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: FilterSpecification,
    "layout"?: {|
        "icon-opacity"?: number,
        "icon-color"?: ColorSpecification,
        "icon-halo-color"?: ColorSpecification,
        "icon-halo-width"?: number,
        "icon-halo-blur"?: number,
        "icon-translate"?: [number, number],
        "icon-translate-anchor"?: "map" | "viewport",
        "text-opacity"?: number,
        "text-color"?: ColorSpecification,
        "text-halo-color"?: ColorSpecification,
        "text-halo-width"?: number,
        "text-halo-blur"?: number,
        "text-translate"?: [number, number],
        "text-translate-anchor"?: "map" | "viewport"
    |},
    "paint"?: {|
        "symbol-placement"?: "point" | "line",
        "symbol-spacing"?: number,
        "symbol-avoid-edges"?: boolean,
        "icon-allow-overlap"?: boolean,
        "icon-ignore-placement"?: boolean,
        "icon-optional"?: boolean,
        "icon-rotation-alignment"?: "map" | "viewport" | "auto",
        "icon-size"?: number,
        "icon-text-fit"?: "none" | "width" | "height" | "both",
        "icon-text-fit-padding"?: [number, number, number, number],
        "icon-image"?: string,
        "icon-rotate"?: number,
        "icon-padding"?: number,
        "icon-keep-upright"?: boolean,
        "icon-offset"?: [number, number],
        "icon-pitch-alignment"?: "map" | "viewport" | "auto",
        "text-pitch-alignment"?: "map" | "viewport" | "auto",
        "text-rotation-alignment"?: "map" | "viewport" | "auto",
        "text-field"?: string,
        "text-font"?: Array<string>,
        "text-size"?: number,
        "text-max-width"?: number,
        "text-line-height"?: number,
        "text-letter-spacing"?: number,
        "text-justify"?: "left" | "center" | "right",
        "text-anchor"?: "center" | "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right",
        "text-max-angle"?: number,
        "text-rotate"?: number,
        "text-padding"?: number,
        "text-keep-upright"?: boolean,
        "text-transform"?: "none" | "uppercase" | "lowercase",
        "text-offset"?: [number, number],
        "text-allow-overlap"?: boolean,
        "text-ignore-placement"?: boolean,
        "text-optional"?: boolean,
        "visibility"?: "visible" | "none"
    |}
|}

declare type CircleLayerSpecification = {|
    "id": string,
    "type": "circle",
    "metadata"?: mixed,
    "source": string,
    "source-layer"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: FilterSpecification,
    "layout"?: {|
        "circle-radius"?: number,
        "circle-color"?: ColorSpecification,
        "circle-blur"?: number,
        "circle-opacity"?: number,
        "circle-translate"?: [number, number],
        "circle-translate-anchor"?: "map" | "viewport",
        "circle-pitch-scale"?: "map" | "viewport",
        "circle-pitch-alignment"?: "map" | "viewport",
        "circle-stroke-width"?: number,
        "circle-stroke-color"?: ColorSpecification,
        "circle-stroke-opacity"?: number
    |},
    "paint"?: {|
        "visibility"?: "visible" | "none"
    |}
|}

declare type FillExtrusionLayerSpecification = {|
    "id": string,
    "type": "fill-extrusion",
    "metadata"?: mixed,
    "source": string,
    "source-layer"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: FilterSpecification,
    "layout"?: {|
        "fill-extrusion-opacity"?: number,
        "fill-extrusion-color"?: ColorSpecification,
        "fill-extrusion-translate"?: [number, number],
        "fill-extrusion-translate-anchor"?: "map" | "viewport",
        "fill-extrusion-pattern"?: string,
        "fill-extrusion-height"?: number,
        "fill-extrusion-base"?: number
    |},
    "paint"?: {|
        "visibility"?: "visible" | "none"
    |}
|}

declare type RasterLayerSpecification = {|
    "id": string,
    "type": "raster",
    "metadata"?: mixed,
    "source": string,
    "source-layer"?: string,
    "minzoom"?: number,
    "maxzoom"?: number,
    "filter"?: FilterSpecification,
    "layout"?: {|
        "raster-opacity"?: number,
        "raster-hue-rotate"?: number,
        "raster-brightness-min"?: number,
        "raster-brightness-max"?: number,
        "raster-saturation"?: number,
        "raster-contrast"?: number,
        "raster-fade-duration"?: number
    |},
    "paint"?: {|
        "visibility"?: "visible" | "none"
    |}
|}

declare type BackgroundLayerSpecification = {|
    "id": string,
    "type": "background",
    "metadata"?: mixed,
    "minzoom"?: number,
    "maxzoom"?: number,
    "layout"?: {|
        "background-color"?: ColorSpecification,
        "background-pattern"?: string,
        "background-opacity"?: number
    |},
    "paint"?: {|
        "visibility"?: "visible" | "none"
    |}
|}

declare type LayerSpecification =
    | FillLayerSpecification
    | LineLayerSpecification
    | SymbolLayerSpecification
    | CircleLayerSpecification
    | FillExtrusionLayerSpecification
    | RasterLayerSpecification
    | BackgroundLayerSpecification;

