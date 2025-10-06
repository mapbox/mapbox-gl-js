/* eslint-disable */

import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken = 'accessToken';
localStorage.setItem('accessToken', mapboxgl.accessToken);

//
// Map constructor
//

const map = new mapboxgl.Map({
    container: 'map',
    center: [-96, 37.8],
    zoom: 2,
    hash: true,
    attributionControl: false,
});

const transformRequest: mapboxgl.RequestTransformFunction = (url: string, resourceType?: mapboxgl.ResourceType): mapboxgl.RequestParameters => {return {url}};

//
// Events
//

map.on('load', (event) => {
    event.type === 'load';
    event.target satisfies mapboxgl.Map;
});

map.on('style.load', (event) => {
    event.type === 'style.load';
    event.target satisfies mapboxgl.Map;
});

map.on('click', (event) => {
    event satisfies mapboxgl.MapMouseEvent;

    event.type === 'click';
    event.target satisfies mapboxgl.Map;

    event.point satisfies mapboxgl.Point;
    event.lngLat satisfies mapboxgl.LngLat;
    event.features satisfies mapboxgl.GeoJSONFeature[] | undefined;
    event.originalEvent satisfies MouseEvent;

    event.preventDefault();
});

map.on('touchstart', 'layerId', (event) => {
    event satisfies mapboxgl.MapTouchEvent;

    event.type === 'touchstart';
    event.target satisfies mapboxgl.Map;

    event.point satisfies mapboxgl.Point;
    event.lngLat satisfies mapboxgl.LngLat;
    event.features satisfies mapboxgl.GeoJSONFeature[] | undefined;
    event.originalEvent satisfies TouchEvent;

    event.preventDefault();
});

// Custom events
map.fire('flystart', {});
map.once('flystart', () => {});
map.on('flystart', () => {});
map.off('flystart', () => {});

await new Promise((resolve) => map.on('style.load', resolve));

//
// Interactions
//

map.addInteraction('click', {
    type: 'click',
    handler: (event) => {
        event satisfies mapboxgl.InteractionEvent;
        event.feature satisfies mapboxgl.TargetFeature | undefined;
    }
});

map.addInteraction('touchstart', {
    type: 'touchstart',
    target: {layerId: 'layer-id'},
    handler: (event) => {
        event satisfies mapboxgl.InteractionEvent;
        event.feature satisfies mapboxgl.TargetFeature | undefined;
    }
});

map.addInteraction('mouseenter', {
    type: 'mouseenter',
    target: {featuresetId: 'layer-id'},
    filter: ['>=', 'area', 80000],
    handler: (event) => {
        event satisfies mapboxgl.InteractionEvent;
        event.feature satisfies mapboxgl.TargetFeature | undefined;
    }
});

map.addInteraction('mouseleave', {
    type: 'mouseleave',
    target: {featuresetId: 'layer-id', importId: 'basemap'},
    filter: ['>=', 'area', 80000],
    handler: (event) => {
        event satisfies mapboxgl.InteractionEvent;
        event.feature satisfies mapboxgl.TargetFeature | undefined;
    }
});

//
// Controls
//

map.addControl(
    new mapboxgl.ScaleControl({unit: 'metric', maxWidth: 80}),
    'bottom-left' satisfies mapboxgl.ControlPosition
);

map.addControl(
    new mapboxgl.NavigationControl({
        showCompass: true,
        showZoom: true,
        visualizePitch: true
    })
);

map.addControl(
    new mapboxgl.FullscreenControl({
        container: document.querySelector('body')
    })
);

map.addControl(new mapboxgl.AttributionControl({
    compact: true,
    customAttribution: 'Custom attribution'
}));

//
// GeolocateControl
//

const geolocateControl = new mapboxgl.GeolocateControl();

geolocateControl.on('error', (error) => error satisfies GeolocationPositionError);
geolocateControl.on('geolocate', (position) => position satisfies GeolocationPosition);
geolocateControl.on('outofmaxbounds', (position) => position satisfies GeolocationPosition);
geolocateControl.on('trackuserlocationstart', () => {});
geolocateControl.on('trackuserlocationend', () => {});
map.addControl(geolocateControl);

//
// Markers and Popups
//

const center = mapboxgl.LngLat.convert(map.getCenter());

const popup = new mapboxgl.Popup()
    .setText('Hello, World! 👋');

new mapboxgl.Marker()
    .setLngLat(center)
    .setPopup(popup)
    .addTo(map);

map.setConfigProperty('basemap', 'lightPreset', 'dawn');

//
// Loading images
//

const image = await new Promise<ImageBitmap | HTMLImageElement | ImageData | null | undefined>((resolve, reject) =>
    map.loadImage('https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png', (error?: Error | null, image?: ImageBitmap | HTMLImageElement | ImageData | null) => {
        if (error) reject(error);
        resolve(image);
    })
);

if (image) {
    map.addImage('custom-marker', image);
}

//
// Adding sources
//

map.addSource('urban-areas', {
    'type': 'geojson',
    'data': 'https://docs.mapbox.com/mapbox-gl-js/assets/ne_50m_urban_areas.geojson'
});

map.addSource('points', {
    'type': 'geojson',
    'data': {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'geometry': {
                    'type': 'Point',
                    'coordinates': [-77.03238901390978, 38.913188059745586]
                },
                'properties': {
                    'title': 'Mapbox DC'
                }
            },
            {
                'type': 'Feature',
                'geometry': {
                    'type': 'Point',
                    'coordinates': [-122.414, 37.776]
                },
                'properties': {
                    'title': 'Mapbox SF'
                }
            }
        ]
    }
});


//
// Source narrowing
//

const source = map.getSource('id');
const geojsonSource: mapboxgl.GeoJSONSource | undefined = map.getSource('id');

if (source) {
    switch (source.type) {
        case 'geojson':
            source satisfies mapboxgl.GeoJSONSource;
            break;
        case 'raster-array':
            source satisfies mapboxgl.RasterArrayTileSource;
            break;
        case 'raster-dem':
            source satisfies mapboxgl.RasterDemTileSource;
            break;
        case 'raster':
            source satisfies mapboxgl.RasterTileSource;
            break;
        case 'vector':
            source satisfies mapboxgl.VectorTileSource;
            break;
        case 'image':
            source satisfies mapboxgl.ImageSource;
            break;
        case 'video':
            source satisfies mapboxgl.VideoSource;
            break;
        case 'canvas':
            source satisfies mapboxgl.CanvasSource;
            break;
        case 'custom':
            source satisfies mapboxgl.CustomSource<ImageData | ImageBitmap | HTMLCanvasElement | HTMLImageElement>;
            break;
        case 'model':
            source satisfies mapboxgl.ModelSource;
            break;
    }
}

class CustomSource implements mapboxgl.CustomSourceInterface<ImageBitmap> {
    id: string;
    type: 'custom';

    constructor() {
        this.id = 'custom-source';
        this.type = 'custom';
    }

    async loadTile(tileID: {z: number; x: number; y: number}, options: {signal: AbortSignal}): Promise<ImageBitmap> {
        return Promise.resolve(new ImageBitmap());
    }
}

map.addSource('custom-source', new CustomSource());

//
// Adding layers
//

map.addLayer({
    id: 'background',
    type: 'background'
});

map.addLayer({
    'id': 'urban-areas-fill',
    'type': 'fill',
    'slot': 'middle',
    'source': 'urban-areas',
    'layout': {
        'visibility': 'visible'
    },
    'paint': {
        'fill-color': '#f08',
        'fill-opacity': 0.4,
        'fill-emissive-strength': 0.8,
    }
});

map.addLayer({
    'id': 'radar',
    'type': 'raster',
    'slot': 'middle',
    'source': {
        'type': 'image',
        'url': 'https://docs.mapbox.com/mapbox-gl-js/assets/radar.gif',
        'coordinates': [
            [-80.425, 46.437],
            [-71.516, 46.437],
            [-71.516, 37.936],
            [-80.425, 37.936]
        ]
    },
    'paint': {
        'raster-fade-duration': 0
    }
});

map.addLayer({
    'id': 'points',
    'type': 'symbol',
    'source': 'points',
    'layout': {
        'icon-image': 'custom-marker',
        'text-field': ['get', 'title'],
        'text-font': [
            'Open Sans Semibold',
            'Arial Unicode MS Bold'
        ],
        'text-offset': [0, 1.25],
        'text-anchor': 'top',
    }
});


const layer = map.getLayer('id');
if (layer) {
    layer.id satisfies string;
    layer.slot satisfies string | undefined;
    layer.paint satisfies mapboxgl.LayerSpecification['paint'];
    layer.layout satisfies mapboxgl.LayerSpecification['layout'];

    switch (layer.type) {
        case 'background':
            layer satisfies mapboxgl.BackgroundLayerSpecification;
            break;
        case 'circle':
            layer satisfies mapboxgl.CircleLayerSpecification;
            break;
        case 'fill':
            layer satisfies mapboxgl.FillLayerSpecification;
            break;
        case 'fill-extrusion':
            layer satisfies mapboxgl.FillExtrusionLayerSpecification;
            break;
        case 'heatmap':
            layer satisfies mapboxgl.HeatmapLayerSpecification;
            break;
        case 'hillshade':
            layer satisfies mapboxgl.HillshadeLayerSpecification;
            break;
        case 'line':
            layer satisfies mapboxgl.LineLayerSpecification;
            break;
        case 'raster':
            layer satisfies mapboxgl.RasterLayerSpecification;
            break;
        case 'symbol':
            layer satisfies mapboxgl.SymbolLayerSpecification;
            break;
        case 'custom':
            layer satisfies mapboxgl.CustomLayerInterface;
            break;
    }
}

const backgroundLayer: mapboxgl.BackgroundLayerSpecification | undefined = map.getLayer('background');

const customLayer: mapboxgl.CustomLayerInterface | undefined = map.getLayer<mapboxgl.CustomLayerInterface>('custom');
if (customLayer) {
    customLayer.render satisfies mapboxgl.CustomLayerInterface['render'];
}

//
// Layout Properties
//

map.setLayoutProperty('id', 'text-offset', [0, 0]);
map.setLayoutProperty('id', 'visibility', 'visible');
// @ts-expect-error
map.setLayoutProperty('id', 'visebility', 'visible');
// @ts-expect-error
map.setLayoutProperty('id', 'visibility', 'viseble');

map.getLayoutProperty('id', 'text-offset') satisfies NonNullable<mapboxgl.SymbolLayerSpecification['layout']>['text-offset'] | undefined;
map.getLayoutProperty('id', 'visibility') satisfies NonNullable<mapboxgl.SymbolLayerSpecification['layout']>['visibility'] | undefined;

//
// Paint Properties
//

map.setPaintProperty('id', 'background-color', '#f08');
// @ts-expect-error
map.setPaintProperty('id', 'background-kolor', '#f08');
map.setPaintProperty('id', 'background-opacity', 0.4);
map.setPaintProperty('id', 'background-color-transition', {duration: 300, delay: 0});

map.getPaintProperty('id', 'background-color') satisfies NonNullable<mapboxgl.BackgroundLayerSpecification['paint']>['background-color'] | undefined;
map.getPaintProperty('id', 'background-opacity') satisfies NonNullable<mapboxgl.BackgroundLayerSpecification['paint']>['background-opacity'] | undefined;
map.getPaintProperty('id', 'background-color-transition') satisfies mapboxgl.TransitionSpecification | undefined;

//
// Add Custom Layer
//

const highlightLayer: mapboxgl.CustomLayerInterface = {
    id: 'highlight',
    type: 'custom',
    render: (gl: WebGLRenderingContext, matrix: number[]): void => {}
}

map.addLayer(highlightLayer);

//
// Add model layer
//

map.addLayer({
    'id': 'model',
    'type': 'model',
    'source': 'model',
    'layout': {
        'model-id': ['get', 'model-uri']
    },
    'paint': {
        'model-cast-shadows': false,
        'model-receive-shadows': false
    }
});

//
// Add 3D terrain
//

map.addSource('mapbox-dem', {
    'type': 'raster-dem',
    'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
    'tileSize': 512,
    'maxzoom': 14
});

map.setTerrain({'source': 'mapbox-dem', 'exaggeration': 1.5});
map.setTerrain(undefined);
map.setTerrain(null);

//
// 3D Lights
//

map.setLights([
    {
        "id": "directional",
        "type": "directional",
        "properties": {
            "cast-shadows": true,
        }
    }
]);

//
// Query features
//
map.queryRenderedFeatures([0, 0]) satisfies mapboxgl.GeoJSONFeature[] | mapboxgl.TargetFeature[];
map.queryRenderedFeatures({layers: ['layer-id']}) satisfies mapboxgl.GeoJSONFeature[];
map.queryRenderedFeatures({target: {layerId: 'layer-id'}}) satisfies mapboxgl.TargetFeature[];

// @ts-expect-error can't mix featureset and layers in the same query
map.queryRenderedFeatures({layers: ['layer-id'], target: {layerId: 'layer-id'}});
// @ts-expect-error can't mix featureset and layers in the same query
map.queryRenderedFeatures([0, 0], {layers: ['layer-id'], target: {layerId: 'layer-id'}});

const features1 = map.queryRenderedFeatures([0, 0], {layers: ['layer-id'], filter: ['>=', 'area', 80000], validate: true}) satisfies mapboxgl.GeoJSONFeature[];
const features2 = map.queryRenderedFeatures({validate: false});
const features3 = map.querySourceFeatures('sourceId', {sourceLayer: 'sourceLayer', filter: ['>=', 'area', 80000], validate: true}) satisfies mapboxgl.GeoJSONFeature[];

const features4 = map.queryRenderedFeatures([0, 0], {target: {layerId: 'layer-id'}, filter: ['>=', 'area', 80000]}) satisfies mapboxgl.TargetFeature[];
const features5 = map.queryRenderedFeatures([0, 0], {target: {featuresetId: 'featureset-id'}, filter: ['>=', 'area', 80000]});
const features6 = map.queryRenderedFeatures([0, 0], {target: {featuresetId: 'featureset-id', importId: 'basemap'}, filter: ['>=', 'area', 80000]}) satisfies mapboxgl.TargetFeature[];

//
// Set state
//

const feature1: mapboxgl.GeoJSONFeature = features1[0];
if (feature1.id) {
    map.setFeatureState(feature1, {hide: true});
}

const feature2 = features2[0];
if (feature2.id) {
    map.setFeatureState(feature2, {hide: true});
}

const feature3 = features3[0];
map.removeFeatureState(feature3, 'hide');

map.removeFeatureState({
    id: 'featureId',
    source: 'sourceId',
    sourceLayer: 'sourceLayer',
});

map.removeFeatureState({
    source: 'sourceId'
});

const feature4: mapboxgl.TargetFeature = features4[0];
if (feature4.id) {
    map.setFeatureState(feature4, {hide: true});
}

const feature5 = features5[0];
if (feature5.id) {
    map.setFeatureState(feature5, {hide: true});
}

const feature6 = features6[0];
map.removeFeatureState(feature6);

//
// EasingOptions, CameraOptions, AnimationOptions
//

const cameraOptions: mapboxgl.CameraOptions = {
    center: [0, 0],
    zoom: 10,
    padding: {top: 10, bottom: 10, left: 10, right: 10},
};

const animationOptions: mapboxgl.AnimationOptions = {
    speed: 0.5,
    curve: 1,
    screenSpeed: 1,
    easing: function (t: number): number { return t; },
    maxDuration: 1,
};

const easingOptions: mapboxgl.EasingOptions = Object.assign({}, cameraOptions, animationOptions);

//
// FlyTo
//

map.flyTo(easingOptions);

//
// FitBounds
//

map.fitBounds([[-73.9876, 40.7661], [-73.9397, 40.8002]], {
    padding: 20,
    maxZoom: 12,
});

//
// Set Language
//

map.setLanguage('auto');
map.setLanguage('es');
map.setLanguage(['en-GB', 'en-US']);

//
// Set Worldview
//

map.setWorldview();
map.setWorldview('JP');
