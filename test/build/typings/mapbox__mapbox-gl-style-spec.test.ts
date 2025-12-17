/* eslint-disable */

import type {
    StyleSpecification,
    SourceSpecification,
    LayerSpecification,
    FilterSpecification,
    ExpressionSpecification,
    TransitionSpecification,
    VectorSourceSpecification,
    RasterSourceSpecification,
    GeoJSONSourceSpecification,
    FillLayerSpecification,
    LineLayerSpecification,
    SymbolLayerSpecification,
    CircleLayerSpecification,
    BackgroundLayerSpecification,
    DataDrivenPropertyValueSpecification,
    PropertyValueSpecification,
} from '@mapbox/mapbox-gl-style-spec';

//
// StyleSpecification
//

const style: StyleSpecification = {
    version: 8,
    sources: {
        'vector-source': {
            type: 'vector',
            url: 'mapbox://mapbox.mapbox-streets-v8'
        }
    },
    layers: [
        {
            id: 'background',
            type: 'background',
            paint: {
                'background-color': '#000'
            }
        }
    ]
};

style.version satisfies 8;
style.sources satisfies Record<string, SourceSpecification> | undefined;
style.layers satisfies LayerSpecification[];

//
// SourceSpecification
//

const vectorSource: VectorSourceSpecification = {
    type: 'vector',
    url: 'mapbox://mapbox.mapbox-streets-v8'
};
vectorSource satisfies SourceSpecification;

const rasterSource: RasterSourceSpecification = {
    type: 'raster',
    url: 'mapbox://mapbox.satellite',
    tileSize: 256
};
rasterSource satisfies SourceSpecification;

const geojsonSource: GeoJSONSourceSpecification = {
    type: 'geojson',
    data: {
        type: 'FeatureCollection',
        features: []
    }
};
geojsonSource satisfies SourceSpecification;

//
// LayerSpecification
//

const fillLayer: FillLayerSpecification = {
    id: 'fill-layer',
    type: 'fill',
    source: 'vector-source',
    paint: {
        'fill-color': '#ff0000',
        'fill-opacity': 0.5
    }
};
fillLayer satisfies LayerSpecification;

const lineLayer: LineLayerSpecification = {
    id: 'line-layer',
    type: 'line',
    source: 'vector-source',
    paint: {
        'line-color': '#0000ff',
        'line-width': 2
    }
};
lineLayer satisfies LayerSpecification;

const symbolLayer: SymbolLayerSpecification = {
    id: 'symbol-layer',
    type: 'symbol',
    source: 'vector-source',
    layout: {
        'text-field': ['get', 'name'],
        'text-size': 12
    }
};
symbolLayer satisfies LayerSpecification;

const circleLayer: CircleLayerSpecification = {
    id: 'circle-layer',
    type: 'circle',
    source: 'vector-source',
    paint: {
        'circle-radius': 5,
        'circle-color': '#00ff00'
    }
};
circleLayer satisfies LayerSpecification;

const backgroundLayer: BackgroundLayerSpecification = {
    id: 'background',
    type: 'background',
    paint: {
        'background-color': '#ffffff'
    }
};
backgroundLayer satisfies LayerSpecification;

//
// FilterSpecification
//

const legacyFilter: FilterSpecification = ['==', 'type', 'residential'];
const expressionFilter: FilterSpecification = ['all', ['==', ['get', 'type'], 'residential'], ['>', ['get', 'area'], 1000]];

//
// ExpressionSpecification
//

const getExpr: ExpressionSpecification = ['get', 'name'];
const interpolateExpr: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 10, 1, 15, 5];
const caseExpr: ExpressionSpecification = ['case', ['has', 'name'], ['get', 'name'], 'unnamed'];

//
// TransitionSpecification
//

const transition: TransitionSpecification = {
    duration: 300,
    delay: 0
};

//
// DataDrivenPropertyValueSpecification
//

const dataDrivenColor: DataDrivenPropertyValueSpecification<string> = ['get', 'color'];
const staticColor: DataDrivenPropertyValueSpecification<string> = '#ff0000';

//
// PropertyValueSpecification
//

const zoomBasedOpacity: PropertyValueSpecification<number> = ['interpolate', ['linear'], ['zoom'], 10, 0, 15, 1];
const staticOpacity: PropertyValueSpecification<number> = 0.8;
