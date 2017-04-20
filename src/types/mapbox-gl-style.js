// @Flow

/*::

type TileJSON = {|
    tilejson: '2.2.0' | '2.1.0' | '2.0.1' | '2.0.0' | '1.0.0',
    name?: string,
    description?: string,
    version?: string,
    attribution?: string,
    template?: string,
    tiles: Array<string>,
    grids?: Array<string>,
    data?: Array<string>,
    minzoom?: number,
    maxzoom?: number,
    bounds?: [number, number, number, number],
    center?: [number, number, number]
|};

type VectorSourceURL = {| type: 'vector', url: string |};
type VectorSourceTileJSON = {|type: 'vector'|} & TileJSON;

type RasterSource = {|
    type: 'raster',
    url?: string,
    tiles?: Array<string>,
    minzoom?: number,
    maxzoom?: number,
    tileSize?: number
|};

type GeoJsonSource = {|
    type: 'geojson',
    data?: string,
    maxzoom?: number,
    buffer?: number,
    tolerance?: number,
    cluster?: boolean,
    clusterRadius?: number,
    clusterMaxZoom?: number
|};

type ImageSource = {|
    type: 'image',
    url: string,
    coordinates: [[number, number], [number, number]]
|};

type VideoSource = {|
    type: 'video',
    urls: Array<string>,
    coordinates: [[number, number], [number, number]]
|};

type CanvasSource = {|
    type: 'canvas',
    canvas: string,
    coordinates: [[number, number], [number, number]],
    animate?: boolean
|};

type BackgroundLayer = {|
    type: 'background',
    layout: {|
        visibility?: 'visible' | 'none'
    |},
    paint: {|
        'background-color'?: string,
        'background-pattern'?: string,
        'background-opacity'?: number
    |}
|};

type FillLayer = {|
    type: 'fill',
    layout: {|
        visibility?: 'visible' | 'none'
    |},
    paint: {|
        'fill-antialias'?: boolean,
        'fill-opacity'?: number,
        'fill-color'?: string,
        'fill-outline-color'?: string,
        'fill-translate'?: [number, number],
        'fill-translate-anchor'?: 'map' | 'viewport',
        'fill-pattern'?: string
    |}
|};

type LineLayer = {|
    type: 'line',
    layout: {|
        visibility?: 'visible' | 'none',
        'line-cap'?: 'butt' | 'round' | 'square',
        'line-join'?: 'bevel' | 'round' | 'mitter',
        'line-miter-limit'?: number,
        'line-round-limit'?: number
    |},
    paint: {|
        'line-opacity'?: number,
        'line-color'?: string,
        'line-translate'?: [number, number],
        'line-translate-anchor'?: 'map' | 'viewport',
        'line-width'?: number,
        'line-gap-width'?: number,
        'line-offset'?: number,
        'line-blur'?: number,
        'line-dasharray'?: [number, number],
        'line-pattern'?: string
    |}
|};

type SymbolLayer = {|
    type: 'symbol',
    layout: {|
        visibility?: 'visible' | 'none',
        'symbol-placement'?: 'point' | 'line',
        'symbol-spacing'?: number,
        'symbol-avoid-edges'?: boolean,
        'icon-allow-overlap'?: boolean,
        'icon-ignore-placement'?: boolean,
        'icon-optional'?: boolean,
        'icon-rotation-alignment'?: 'map' | 'viewport' | 'auto',
        'icon-size '?: number,
        'icon-text-fit'?: 'none' | 'width' | 'height' | 'both',
        'icon-text-fit-padding'?: [number, number, number, number],
        'icon-image'?: string,
        'icon-rotate'?: number,
        'icon-padding'?: number,
        'icon-keep-upright'?: number,
        'icon-offset'?: [number, number],
        'text-pitch-alignment'?: 'map' | 'viewport' | 'auto',
        'text-rotation-alignment'?: 'map' | 'viewport' | 'auto',
        'text-field'?: string,
        'text-font'?: Array<string>,
        'text-size'?: number,
        'text-max-width'?: number,
        'text-line-height'?: number,
        'text-letter-spacing'?: number,
        'text-justify'?: 'left' | 'center' | 'right',
        'text-anchor'?: 'center' | 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
        'text-max-angle'?: number,
        'text-rotate'?: number,
        'text-padding'?: number,
        'text-keep-upright'?: boolean,
        'text-transform'?: 'none' | 'uppercase' | 'lowercase',
        'text-offset'?: [number, number],
        'text-allow-overlap'?: boolean,
        'text-ignore-placement'?: boolean,
        'text-optional'?: boolean
    |},
    paint: {|
        'icon-opacity'?: number,
        'icon-color'?: string,
        'icon-halo-color'?: string,
        'icon-halo-width'?: number,
        'icon-halo-blur'?: number,
        'icon-translate'?: [number, number],
        'icon-translate-anchor'?: 'map' | 'viewport',
        'text-opacity'?: number,
        'text-color'?: string,
        'text-halo-color'?: string,
        'text-halo-width'?: number,
        'text-halo-blur'?: number,
        'text-translate'?: [number, number],
        'text-translate-anchor'?: 'map' | 'viewport'
    |}
|};

type RasterLayer = {|
    type: 'raster',
    layout: {|
        visibility?: 'visible' | 'none'
    |},
    paint: {|
        'raster-opacity'?: number,
        'raster-hue-rotate'?: number,
        'raster-brightness-min'?: number,
        'raster-brightness-max'?: number,
        'raster-saturation'?: number,
        'raster-contrast'?: number,
        'raster-fade-duration'?: number
    |}
|};

type CircleLayer = {|
    type: 'circle',
    layout: {|
        visibility?: 'visible' | 'none'
    |},
    paint: {|
        'circle-radius'?: number,
        'circle-color'?: string,
        'circle-blur'?: number,
        'circle-opacity'?: number,
        'circle-translate'?: [number, number],
        'circle-translate-anchor'?: 'map' | 'viewport',
        'circle-pitch-scale'?: 'map' | 'viewport',
        'circle-stroke-width'?: number,
        'circle-stroke-color'?: string,
        'circle-stroke-color'?: number
    |}
|};

type FillExtrusionLayer = {|
  type: 'fill-extrusion',
  layout: {
    visibility?: 'visible' | 'none'
  },
  paint: {
    'fill-extrusion-opacity'?: number,
    'fill-extrusion-color'?: string,
    'fill-extrusion-translate'?: [number, number],
    'fill-extrusion-translate-anchor'?: 'map' | 'viewport',
    'fill-extrusion-pattern'?: string,
    'fill-extrusion-height'?: number,
    'fill-extrusion-base'?: number
  }
|};

type Layer = BackgroundLayer | FillLayer | LineLayer | SymbolLayer | RasterLayer | CircleLayer | FillExtrusionLayer;

export type MapboxGLStyle = {|
    version: number,
    name?: string,
    metadata?: {[key: string]: mixed},
    center?: [number, number],
    zoom?: number,
    bearing?: number,
    pitch?: number,
    light?: {
      anchor?: string,
      color?: string,
      intensity?: number,
      position?: [number, number, number]
    },
    sources:
        | VectorSourceURL
        | VectorSourceTileJSON
        | RasterSource
        | GeoJsonSource
        | ImageSource
        | VideoSource
        | CanvasSource,
    sprite?: string,
    glyphs?: string,
    transition?: {duration: number, delay: number},
    layers: Array<Layer>
|};

*/
