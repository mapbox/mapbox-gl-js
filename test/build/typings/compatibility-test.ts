/**
 * This file contains tests for the @types/mapbox-gl package with community typings for Mapbox GL JS.
 * https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/mapbox-gl/v2/mapbox-gl-tests.ts
*
* This is used to test the backwards compatibility of the community typings with the official typings.
* Tests that are incompatible with `mapbox-gl` typings are marked with: // @ts-expect-error - incompatible
*/

/* eslint-disable camelcase */
/* eslint-disable eqeqeq */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-var */
/* eslint-disable object-shorthand */
/* eslint-disable operator-linebreak */
/* eslint-disable prefer-arrow-callback */
/* eslint-disable prefer-const */
/* eslint-disable prefer-template */

import mapboxgl from "mapbox-gl";
import type {IControl} from "mapbox-gl";

// These examples adapted from Mapbox's examples (https://www.mapbox.com/mapbox-gl-js/examples)

/**
 * Set API Access Token
 */
mapboxgl.accessToken = "foo";

/**
 * Set Base API URL
 */
mapboxgl.baseApiUrl = "https://example.com";

/**
 * Set amount of workers
 */
mapboxgl.workerCount = 3;

/**
 * Set max amount of parallel images requests
 */
mapboxgl.maxParallelImageRequests = 10;

/**
 * Clears browser storage used by this library
 */
mapboxgl.clearStorage(() => {});

/**
 * Get RTL Text Plugin Status
 */
mapboxgl.getRTLTextPluginStatus() satisfies mapboxgl.PluginStatus;

/**
 * Set RTL Text Plugin
 */
mapboxgl.setRTLTextPlugin("https://github.com", e => {}, false) satisfies void;

mapboxgl.prewarm() satisfies void;

mapboxgl.clearPrewarmedResources() satisfies void;

/**
 * Display a Map
 */
let map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/streets-v8",
    center: [-50, 50],
    zoom: 10,
    minZoom: 1,
    maxZoom: 2,
    minPitch: 0,
    maxPitch: 60,
    interactive: true,
    attributionControl: true,
    customAttribution: "© YourCo",
    bearingSnap: 7,
    scrollZoom: true,
    maxBounds: [
        [-100, -90],
        [100, 90],
    ],
    boxZoom: true,
    dragRotate: false,
    dragPan: true,
    antialias: true,
    accessToken: "some-token",
    locale: {
        "FullscreenControl.Enter": "Розгорнути на весь екран",
        "FullscreenControl.Exit": "Вийти з повоноеранного режиму",
    },
    // @ts-expect-error - incompatible
    optimizeForTerrain: false,
});

/**
 * Initialize map with bounds
 */
expectType<mapboxgl.MapboxOptions>({
    container: "map",
    bounds: new mapboxgl.LngLatBounds([-100, -90, 100, 90]),
    fitBoundsOptions: {
        padding: 0,
        offset: new mapboxgl.Point(0, 0),
        linear: true,
        maxZoom: 22,
        easing: time => time,
    },
});
expectType<mapboxgl.MapboxOptions>({
    container: "map",
    bounds: [
        [-100, -90],
        [100, 90],
    ],
    fitBoundsOptions: {
        offset: [0, 0],
    },
});
expectType<mapboxgl.MapboxOptions>({
    container: "map",
    bounds: [-100, -90, 100, 90],
});

expectType<mapboxgl.MapboxOptions>({
    container: "map",
    touchPitch: true,
});

/**
 * Check `touchPitch`, `touchZoomRotate`, `scrollZoom` to accept Object
 */
expectType<mapboxgl.MapboxOptions>({
    container: "map",
    touchPitch: {around: "center"},
    touchZoomRotate: {around: "center"},
    scrollZoom: {around: "center"},
});

/**
 * Check `dragPan` to accept Object
 */
expectType<mapboxgl.MapboxOptions>({
    container: "map",
    dragPan: {
        linearity: 0.3,
        easing: t => t,
        maxSpeed: 1400,
        deceleration: 2500,
    },
});

/**
 * Check `cooperativeGestures`
 */
expectType<mapboxgl.MapboxOptions>({
    container: "map",
    cooperativeGestures: true,
});

/**
 * Create and style marker clusters
 */
map.on("load", function () {
    // Add a new source from our GeoJSON data and set the
    // 'cluster' option to true.
    map.addSource("data", {
        type: "geojson",
        data: "/data.geojson",
        cluster: true,
        clusterMaxZoom: 14, // Max zoom to cluster points on
        clusterMinPoints: 8,
        clusterRadius: 50, // Radius of each cluster when clustering points (defaults to 50)
        clusterProperties: {sum: ["+", ["get", "property"]]},
        filter: "something",
    });

    map.addLayer({
        id: "layer",
        type: "symbol",
        source: "data",
        layout: {
            "icon-image": "marker-15",
            "text-field": ["get", "property"],
            "text-max-width": {
                stops: [
                    [10, 2],
                    [12, 5],
                ],
            },
        },
    });

    var layers: Array<[number, string]> = [
        [150, "#f28cb1"],
        [20, "#f1f075"],
        [0, "#51bbd6"],
    ];

    layers.forEach(function (layer, i) {
        map.addLayer({
            id: "cluster-" + i,
            type: "circle",
            source: "data",
            paint: {
                "circle-color": layer[1],
                "circle-radius": 18,
            },
            filter: i == 0
                ? [">=", "point_count", layer[0]]
                : ["all", [">=", "point_count", layer[0]], ["<", "point_count", layers[i - 1][0]]],
        });
    });

    // Add a layer for the clusters' count labels
    map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "data",
        layout: {
            "text-field": "{point_count}",
            "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
            "text-size": 12,
        },
    });

    /**
     * Add a GeoJSON line
     */
    map.addSource("route", {
        type: "geojson",
        data: {
            type: "Feature",
            properties: {},
            geometry: {
                type: "LineString",
                coordinates: [
                    [-122.48369693756104, 37.83381888486939],
                    [-122.48348236083984, 37.83317489144141],
                    [-122.48339653015138, 37.83270036637107],
                    [-122.48356819152832, 37.832056363179625],
                    [-122.48404026031496, 37.83114119107971],
                    [-122.48404026031496, 37.83049717427869],
                    [-122.48348236083984, 37.829920943955045],
                    [-122.48356819152832, 37.82954808664175],
                    [-122.48507022857666, 37.82944639795659],
                    [-122.48610019683838, 37.82880236636284],
                    [-122.48695850372314, 37.82931081282506],
                    [-122.48700141906738, 37.83080223556934],
                    [-122.48751640319824, 37.83168351665737],
                    [-122.48803138732912, 37.832158048267786],
                    [-122.48888969421387, 37.83297152392784],
                    [-122.48987674713133, 37.83263257682617],
                    [-122.49043464660643, 37.832937629287755],
                    [-122.49125003814696, 37.832429207817725],
                    [-122.49163627624512, 37.832564787218985],
                    [-122.49223709106445, 37.83337825839438],
                    [-122.49378204345702, 37.83368330777276],
                ],
            },
        },
        promoteId: {original: "COUNTY"},
    });

    map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: {
            "line-join": "round",
            "line-cap": "round",
        },
        paint: {
            "line-color": "#888",
            "line-width": 8,
            "line-dasharray": ["step", ["zoom"], ["literal", [1, 0]], 15, ["literal", [1.75, 1]]],
        },
    });

    // Add a vector source
    map.addSource("vector-source", {
        type: "vector",
        promoteId: {original: "COUNTY"},
    });

    // Add a custom layer
    map.addLayer({
        id: "custom",
        type: "custom",
        renderingMode: "3d",
        onRemove: function (map, gl) {
            map satisfies mapboxgl.Map;
            gl satisfies WebGLRenderingContext;
        },
        render: function (gl, matrix) {
            gl satisfies WebGLRenderingContext;
            matrix satisfies number[];
        },
    });
});

//
// setTerrain
//

map.setTerrain() satisfies mapboxgl.Map;
map.setTerrain(null) satisfies mapboxgl.Map;
map.setTerrain(undefined) satisfies mapboxgl.Map;
map.setTerrain({
    source: "something",
    exaggeration: 10,
}) satisfies mapboxgl.Map;

//
// getFreeCameraOptions
//

// $ExpectType FreeCameraOptions
map.getFreeCameraOptions();

//
// setFreeCameraOptions
//

map.setFreeCameraOptions(new mapboxgl.FreeCameraOptions()) satisfies mapboxgl.Map;

// FlyTo
map.flyTo({
    center: [0, 0],
    zoom: 10,
    speed: 0.5,
    curve: 1,
    screenSpeed: 1,
    easing: function (t: number) {
        return t;
    },
    maxDuration: 1,
});

// RotateTo
map.rotateTo(45, {
    duration: 2000,
    animate: true,
    easing: (t) => t,
    center: [-122.3085, 47.5505],
    zoom: 10,
    pitch: 60,
});

// QueryRenderedFeatures
const features = map.queryRenderedFeatures([0, 0], {layers: ["custom"], validate: false}) satisfies mapboxgl.GeoJSONFeature[];

// querySourceFeatures
const features2 = map.querySourceFeatures("some_source", {
    sourceLayer: "source_layer",
    filter: ["all"],
    validate: false,
}) satisfies mapboxgl.GeoJSONFeature[];

/**
 * GeoJSONSource
 */
var geoJSONSource: mapboxgl.GeoJSONSourceSpecification = {
    type: "geojson",
    data: {
        type: "FeatureCollection",
        features: [
            {
                type: "Feature",
                properties: null,
                geometry: {
                    type: "Point",
                    coordinates: [-50, 0],
                },
            },
        ],
    },
};
map.addSource("some id", geoJSONSource); // add
map.removeSource("some id"); // remove

var geoJSONSourceObj: mapboxgl.GeoJSONSource | undefined = map.getSource("some id"); // get
if (geoJSONSourceObj) geoJSONSourceObj.setData(geoJSONSource["data"] || 'url');

/**
 * ImageSource
 */
var imageSource: mapboxgl.ImageSourceSpecification = {
    type: "image",
    url: "/foo.png",
    coordinates: [
        [-76.54335737228394, 39.18579907229748],
        [-76.52803659439087, 39.1838364847587],
        [-76.5295386314392, 39.17683392507606],
        [-76.54520273208618, 39.17876344106642],
    ],
};

map.addSource("some id", imageSource); // add
map.removeSource("some id"); // remove
var imageSourceObj: mapboxgl.ImageSource | undefined = map.getSource("some id"); // get

if (imageSourceObj) {
    imageSourceObj.updateImage({
        url: "/foo.png",
        coordinates: [
            [-76.54335737228394, 39.18579907229748],
            [-76.52803659439087, 39.1838364847587],
            [-76.5295386314392, 39.17683392507606],
            [-76.54520273208618, 39.17876344106642],
        ],
    });

    imageSourceObj.setCoordinates([
        [-76.54335737228394, 39.18579907229748],
        [-76.52803659439087, 39.1838364847587],
        [-76.5295386314392, 39.17683392507606],
        [-76.54520273208618, 39.17876344106642],
    ]);
}

/**
 * Video Source
 */
var videoSource: mapboxgl.VideoSourceSpecification = {
    type: "video",
    urls: ["/blah.mp4", "/blah.webm"],
    coordinates: [
        [-76.54335737228394, 39.18579907229748],
        [-76.52803659439087, 39.1838364847587],
        [-76.5295386314392, 39.17683392507606],
        [-76.54520273208618, 39.17876344106642],
    ],
};

map.addSource("some id", videoSource); // add
map.removeSource("some id"); // remove

var videoSourceObj: mapboxgl.VideoSource | undefined = map.getSource("some id"); // get
if (videoSourceObj) {
    videoSourceObj.pause();
    videoSourceObj.play();
}

/**
 * Raster Source
 */
const rasterSource: mapboxgl.RasterTileSource | undefined = map.getSource("tile-source");
if (rasterSource) {
    rasterSource.reload() satisfies void;
    rasterSource.setTiles(["a", "b"]) satisfies mapboxgl.RasterTileSource;
    rasterSource.setUrl("https://github.com") satisfies mapboxgl.RasterTileSource;
}

/**
 * Vector Source
 */
const vectorSource: mapboxgl.VectorTileSource | undefined = map.getSource("tile-source");
if (vectorSource) {
    vectorSource.reload() satisfies void;
    vectorSource.setTiles(["a", "b"]) satisfies mapboxgl.VectorTileSource;
    vectorSource.setUrl("https://github.com") satisfies mapboxgl.VectorTileSource;
}

/**
 * Add Raster Source /// made URL optional to allow only tiles.
 */
map.addSource("radar", {
    type: "raster",
    tiles: [
        "https://nowcoast.noaa.gov/arcgis/services/nowcoast/radar_meteo_imagery_nexrad_time/MapServer/WmsServer?bbox={bbox-epsg-3857}&service=WMS&request=GetMap&version=1.3.0&layers=1&styles=&format=image/png&transparent=true&height=256&width=256&crs=EPSG:3857",
    ],
    tileSize: 256,
});

map.addLayer({
    id: "radar",
    type: "raster",
    source: "radar",
    paint: {},
});

/**
 * Manipulate feature state
 */
let featureIdentifier = {
    id: 1337,
    source: "source-id",
    sourceLayer: "liam-was-here",
};
expectType<mapboxgl.FeatureIdentifier>(featureIdentifier);
map.setFeatureState(featureIdentifier, {someState: true, someOtherState: 123});
map.getFeatureState(featureIdentifier);
map.removeFeatureState(featureIdentifier, "someState");
map.removeFeatureState(featureIdentifier);

/**
 * Popup
 */
const popupOptions: mapboxgl.PopupOptions = {
    closeOnClick: false,
    closeOnMove: true,
    closeButton: true,
    focusAfterOpen: true,
    anchor: "top-right",
    offset: {
        top: [0, 0] as [number, number],
        bottom: [25, -50] as [number, number],
    },
    className: "custom-class",
    maxWidth: "400px",
};

const popup = new mapboxgl.Popup(popupOptions)
    .setLngLat([-50, 50])
    .trackPointer()
    .setHTML("<h1>Hello World!</h1>")
    .setMaxWidth("none")
    .addTo(map);
popup.getMaxWidth();
popup.getElement() satisfies HTMLElement | undefined;
popup.addClassName("class1");
popup.removeClassName("class2");
popup.toggleClassName("class3");
popup.setOffset([10, 20]) satisfies mapboxgl.Popup;

/**
 * Add terrain
 */
const terrainStyle: mapboxgl.Style = {
    version: 8,
    name: "terrain",
    sources: {
        dem: {
            type: "raster-dem",
            url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        },
    },
    layers: [],
    terrain: {
        source: "dem",
        exaggeration: 1.5,
    },
};

/**
 * Add an image
 */
var mapStyle: mapboxgl.Style = {
    version: 8,
    name: "Dark",
    sources: {
        mapbox: {
            type: "vector",
            url: "mapbox://mapbox.mapbox-streets-v6",
        },
        overlay: {
            type: "image",
            url: "/mapbox-gl-js/assets/radar.gif",
            coordinates: [
                [-50, 40],
                [0, 40],
                [0, 0],
                [-50, 0],
            ],
        },
    },
    sprite: "mapbox://sprites/mapbox/dark-v8",
    glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
    layers: [
        {
            id: "background",
            type: "background",
            paint: {"background-color": "#111"},
        },
        {
            id: "water",
            source: "mapbox",
            "source-layer": "water",
            type: "fill",
            paint: {"fill-color": "#2c2c2c"},
        },
        {
            id: "boundaries",
            source: "mapbox",
            "source-layer": "admin",
            type: "line",
            paint: {"line-color": "#797979", "line-dasharray": [2, 2, 6, 2]},
            filter: ["all", ["==", "maritime", 0]],
        },
        {
            id: "overlay",
            source: "overlay",
            type: "raster",
            paint: {"raster-opacity": 0.85},
        },
        {
            id: "cities",
            source: "mapbox",
            "source-layer": "place_label",
            type: "symbol",
            layout: {
                "text-field": "{name_en}",
                "text-font": ["DIN Offc Pro Bold", "Arial Unicode MS Bold"],
                "text-size": {
                    stops: [
                        [4, 9],
                        [6, 12],
                    ],
                },
            },
            paint: {
                "text-color": "#969696",
                "text-halo-width": 2,
                "text-halo-color": "rgba(0, 0, 0, 0.85)",
            },
        },
        {
            id: "states",
            source: "mapbox",
            "source-layer": "state_label",
            type: "symbol",
            layout: {
                "text-transform": "uppercase",
                "text-field": "{name_en}",
                "text-font": [
                    "step",
                    ["zoom"],
                    ["literal", ["DIN Offc Pro Regular", "Arial Unicode MS Regular"]],
                    8,
                    [
                        "step",
                        ["get", "symbolrank"],
                        ["literal", ["DIN Offc Pro Medium", "Arial Unicode MS Regular"]],
                        11,
                        ["literal", ["DIN Offc Pro Regular", "Arial Unicode MS Regular"]],
                    ],
                ],
                "text-justify": [
                    "step",
                    ["zoom"],
                    [
                        "match",
                        ["get", "text_anchor"],
                        ["bottom", "top"],
                        "center",
                        ["left", "bottom-left", "top-left"],
                        "left",
                        ["right", "bottom-right", "top-right"],
                        "right",
                        "center",
                    ],
                    8,
                    "center",
                ],
                "text-letter-spacing": 0.15,
                "text-max-width": 7,
                "text-size": {
                    stops: [
                        [4, 10],
                        [6, 14],
                    ],
                },
            },
            filter: [">=", "area", 80000],
            paint: {
                "text-color": "#969696",
                "text-halo-width": 2,
                "text-halo-color": "rgba(0, 0, 0, 0.85)",
            },
        },
    ],
};

/**
 * Add video
 */
var videoStyle: mapboxgl.Style = {
    version: 8,
    sources: {
        satellite: {
            type: "raster",
            url: "mapbox://mapbox.satellite",
            tileSize: 256,
        },
        video: {
            type: "video",
            urls: ["drone.mp4", "drone.webm"],
            coordinates: [
                [-122.51596391201019, 37.56238816766053],
                [-122.51467645168304, 37.56410183312965],
                [-122.51309394836426, 37.563391708549425],
                [-122.51423120498657, 37.56161849366671],
            ],
        },
    },
    layers: [
        {
            id: "background",
            type: "background",
            paint: {
                "background-color": "rgb(4,7,14)",
            },
        },
        {
            id: "satellite",
            type: "raster",
            source: "satellite",
        },
        {
            id: "video",
            type: "raster",
            source: "video",
        },
    ],
};

map = new mapboxgl.Map({
    container: "map",
    minZoom: 14,
    zoom: 17,
    center: [-122.514426, 37.562984],
    bearing: -96,
    style: mapStyle,
    hash: false,
});

map = new mapboxgl.Map({
    container: "map",
    minZoom: 14,
    zoom: 17,
    center: [-122.514426, 37.562984],
    bearing: -96,
    style: videoStyle,
    hash: false,
});

map = new mapboxgl.Map({
    container: "map",
    hash: "customHash",
});

const syncOnce: mapboxgl.Map = map.once("load", () => {});
const asyncOnce: Promise<mapboxgl.MapboxEvent> = map.once("load");

/**
 * Marker
 */
let marker = new mapboxgl.Marker(undefined, {
    element: undefined,
    offset: [10, 0],
    anchor: "bottom-right",
    color: "green",
    draggable: false,
    clickTolerance: 10,
    rotation: 15,
    rotationAlignment: "map",
    pitchAlignment: "viewport",
    scale: 5.5,
    occludedOpacity: 0.5,
})
    .setLngLat([-50, 50])
    .setPitchAlignment("map")
    .setRotation(100)
    .setRotationAlignment("viewport")
    .addTo(map);

// $ExpectType Alignment
marker.getPitchAlignment();

marker.getRotation() satisfies number;

// $ExpectType Alignment
marker.getRotationAlignment();

marker.getOccludedOpacity() satisfies number;

marker.setOccludedOpacity(1) satisfies mapboxgl.Marker;

marker.remove();

/*
 * LngLatBounds
 */
let bool: boolean;
let bounds = new mapboxgl.LngLatBounds();
bool = bounds.isEmpty();
expectType<boolean>(bounds.contains([37, 50]));

bounds.extend(new mapboxgl.LngLat(45, 30)) satisfies mapboxgl.LngLatBounds;
bounds.extend({lng: 45, lat: 30}) satisfies mapboxgl.LngLatBounds;
bounds.extend({lon: 45, lat: 30}) satisfies mapboxgl.LngLatBounds;
bounds.extend([45, 30]) satisfies mapboxgl.LngLatBounds;
bounds.extend(new mapboxgl.LngLatBounds()) satisfies mapboxgl.LngLatBounds;
bounds.extend([
    [45, 30],
    [60, 60],
]) satisfies mapboxgl.LngLatBounds;
bounds.extend([45, 30, 60, 60]) satisfies mapboxgl.LngLatBounds;

// controls
// @ts-expect-error - incompatible mapbox.Control doesn't exist
new mapboxgl.Control() satisfies mapboxgl.IControl;
new mapboxgl.AttributionControl() satisfies mapboxgl.IControl;

/*
 * GeolocateControl
 */
const geolocateControl = new mapboxgl.GeolocateControl({showAccuracyCircle: true});

/*
 * AttributionControl
 */
let attributionControl = new mapboxgl.AttributionControl({compact: false, customAttribution: "© YourCo"});
// @ts-expect-error - incompatible: AttributionControl doesn't have click event listener
attributionControl.on("click", () => {});

/*
 * FullscreenControl
 */
new mapboxgl.FullscreenControl();
new mapboxgl.FullscreenControl(null);
new mapboxgl.FullscreenControl({});
new mapboxgl.FullscreenControl({container: document.querySelector("body")});

map.hasControl(attributionControl) satisfies boolean;

declare var lnglat: mapboxgl.LngLat;
declare var lnglatlike: mapboxgl.LngLatLike;
declare var lnglatboundslike: mapboxgl.LngLatBoundsLike;
declare var mercatorcoordinate: mapboxgl.MercatorCoordinate;
declare var pointlike: mapboxgl.PointLike;

function expectType<T>(value: T) {
    return value;
}

// prettier-ignore
interface EitherType {
    <A>(a: A): A;
    <A, B>(a: A, b: B): A | B;
    <A, B, C>(a: A, b: B, c: C): A | B | C;
    <A, B, C, D>(a: A, b: B, c: C, d: D): A | B | C | D;
    <A, B, C, D, E>(a: A, b: B, c: C, d: D, e: E): A | B | C | D | E;
    <A, B, C, D, E, F>(a: A, b: B, c: C, d: D, e: E, f: F): A | B | C | D | E | F;
    <A, B, C, D, E, F, G>(a: A, b: B, c: C, d: D, e: E, f: F, g: G): A | B | C | D | E | F | G;
    <A, B, C, D, E, F, G, H>(a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H): A | B | C | D | E | F | G | H;
    <A, B, C, D, E, F, G, H, I>(
        a: A,
        b: B,
        c: C,
        d: D,
        e: E,
        f: F,
        g: G,
        h: H,
        i: I,
    ): A | B | C | D | E | F | G | H | I;
    <A, B, C, D, E, F, G, H, I, J>(
        a: A,
        b: B,
        c: C,
        d: D,
        e: E,
        f: F,
        g: G,
        h: H,
        i: I,
        j: J,
    ): A | B | C | D | E | F | G | H | I | J;
    /* Add more as needed */
}

/**
 * Takes a variable amount of arguments and returns a new
 * type that is a union of all the provided argument types. Useful to test properties
 * that accept multiple types
 */
const eitherType: EitherType = () => {
    /* let the compiler handle things */
};

/*
 * LngLatLike
 */

expectType<mapboxgl.LngLatLike>(new mapboxgl.LngLat(0, 0));
expectType<mapboxgl.LngLatLike>([0, 0]);
expectType<mapboxgl.LngLatLike>({lng: 0, lat: 0});
expectType<mapboxgl.LngLatLike>({lon: 0, lat: 0});

/*
 * LngLat
 */

new mapboxgl.LngLat(0, 0);
expectType<mapboxgl.LngLat>(mapboxgl.LngLat.convert(lnglatlike));
expectType<number>(new mapboxgl.LngLat(0, 0).distanceTo(new mapboxgl.LngLat(0, 0)));

/*
 * LngLatBoundsLike
 */

expectType<mapboxgl.LngLatBoundsLike>([lnglatlike, lnglatlike]);
expectType<mapboxgl.LngLatBoundsLike>([0, 0, 1, 1]);
expectType<mapboxgl.LngLatBoundsLike>(new mapboxgl.LngLatBounds());

/*
 * LngLatBounds
 */

new mapboxgl.LngLatBounds();
new mapboxgl.LngLatBounds([0, 0, 1, 1]);
new mapboxgl.LngLatBounds([lnglatlike, lnglatlike]);
new mapboxgl.LngLatBounds(lnglat, lnglat);
new mapboxgl.LngLatBounds(lnglatlike, lnglatlike);
expectType<mapboxgl.LngLatBounds>(mapboxgl.LngLatBounds.convert(lnglatboundslike));

/*
 * PointLike
 */

expectType<mapboxgl.PointLike>(new mapboxgl.Point(0, 0));
expectType<mapboxgl.PointLike>([0, 0]);

/*
 * Point
 */

new mapboxgl.Point(0, 0);
expectType<mapboxgl.Point>(mapboxgl.Point.convert(pointlike));

/*
 * MercatorCoordinate
 */

new mapboxgl.MercatorCoordinate(0, 0);
new mapboxgl.MercatorCoordinate(0, 0, 0);
mercatorcoordinate.toAltitude() satisfies number;
mercatorcoordinate.toLngLat() satisfies mapboxgl.LngLat;
mapboxgl.MercatorCoordinate.fromLngLat(lnglatlike) satisfies mapboxgl.MercatorCoordinate;
mapboxgl.MercatorCoordinate.fromLngLat(lnglatlike, 0) satisfies mapboxgl.MercatorCoordinate;
mercatorcoordinate.meterInMercatorCoordinateUnits() satisfies number;

/*
 * TransformRequestFunction
 */

expectType<mapboxgl.TransformRequestFunction>((url: string) => ({url}));
expectType<mapboxgl.TransformRequestFunction>((url: string, resourceType: mapboxgl.ResourceType) => ({
    url,
    credentials: "same-origin",
    headers: {"Accept-Encoding": "compress"},
    method: "POST",
    collectResourceTiming: true,
}));

/*
 * Map
 */

let padding: mapboxgl.PaddingOptions = {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
};
let animOpts: mapboxgl.AnimationOptions = {
    essential: true,
};
let cameraOpts: mapboxgl.CameraOptions = {
    around: lnglatlike,
    center: lnglatlike,
    bearing: 0,
    pitch: 0,
    zoom: 0,
    padding,
};
// @ts-expect-error - incompatible
let cameraForBoundsOpts: mapboxgl.CameraForBoundsOptions = {
    offset: pointlike,
    maxZoom: 10,
    ...cameraOpts,
};
// @ts-expect-error - incompatible
expectType<mapboxgl.CameraForBoundsResult | undefined>(map.cameraForBounds(lnglatboundslike));
// @ts-expect-error - incompatible
expectType<mapboxgl.CameraForBoundsResult | undefined>(map.cameraForBounds(lnglatboundslike, cameraForBoundsOpts));

expectType<mapboxgl.Map>(map.fitScreenCoordinates([0, 0], pointlike, 1));
expectType<mapboxgl.Map>(map.fitScreenCoordinates([0, 0], pointlike, 1, cameraOpts));
expectType<mapboxgl.Map>(map.fitScreenCoordinates([0, 0], pointlike, 1, cameraOpts, {key: "value"}));

map.triggerRepaint() satisfies void;

map.getPadding() satisfies mapboxgl.PaddingOptions;

map.setPadding({top: 10, bottom: 20, left: 30, right: 40}, {myData: "MY DATA"}) satisfies mapboxgl.Map;

map.setPaintProperty("layerId", "background-color", 'red', {validate: true});
map.setPaintProperty("layerId", "background-color", 'red', {validate: false});
map.setPaintProperty("layerId", "background-color", 'red', {});
// @ts-expect-error
map.setPaintProperty("layerId", "background-color", null, {some_option: "some_string"});

map.setLayoutProperty("layerId", "visibility", 'visible', {validate: true});
map.setLayoutProperty("layerId", "visibility", 'visible', {validate: false});
map.setLayoutProperty("layerId", "visibility", 'none', {});
// @ts-expect-error
map.setLayoutProperty("layerId", "visibility", null, {some_option: "some_string"});

map.setLight({anchor: "viewport", color: "blue", intensity: 0.5}, {validate: true});
map.setLight({anchor: "viewport", color: "blue", intensity: 0.5}, {validate: false});
map.setLight({anchor: "viewport", color: "blue", intensity: 0.5}, {});
// @ts-expect-error
map.setLight({anchor: "viewport", color: "blue", intensity: 0.5}, {some_option: "some_string"});

map.showPadding satisfies boolean;
map.showPadding = false;
// @ts-expect-error - incompatible
expectType<mapboxgl.Map>(map.setFilter("layerId", true));
// @ts-expect-error - incompatible
expectType<mapboxgl.Map>(map.setFilter("layerId", false));

// @ts-expect-error - incompatible
map.setFilter("layerId", true, {validate: true});
// @ts-expect-error - incompatible
map.setFilter("layerId", true, {validate: null});
// @ts-expect-error - incompatible
map.setFilter("layerId", true, {});
// @ts-expect-error
map.setFilter("layerId", true, {some_option: "some_string"});

map.setMinZoom(5) satisfies mapboxgl.Map;
map.setMaxZoom(10) satisfies mapboxgl.Map;
map.setMinZoom(null) satisfies mapboxgl.Map;
map.setMinZoom() satisfies mapboxgl.Map;
map.setMaxZoom(null) satisfies mapboxgl.Map;
map.setMaxZoom() satisfies mapboxgl.Map;

map.getMinZoom() satisfies number;
map.getMaxZoom() satisfies number;

map.setMinPitch(5) satisfies mapboxgl.Map;
map.setMaxPitch(10) satisfies mapboxgl.Map;
map.setMinPitch(null) satisfies mapboxgl.Map;
map.setMinPitch() satisfies mapboxgl.Map;
map.setMaxPitch(null) satisfies mapboxgl.Map;
map.setMaxPitch() satisfies mapboxgl.Map;
map.resetNorthPitch(animOpts) satisfies mapboxgl.Map;

map.getMinPitch() satisfies number;
map.getMaxPitch() satisfies number;

map.setFog({
    color: "blue",
    "horizon-blend": 0.5,
    range: [4, 15],
    "high-color": "red",
    "space-color": "black",
    "star-intensity": 0.5,
}) satisfies mapboxgl.Map;
map.setFog(null) satisfies mapboxgl.Map;
map.setFog(undefined) satisfies mapboxgl.Map;

map.getFog() satisfies mapboxgl.FogSpecification | null | undefined;

/*
 * Map Events
 */

// General events
expectType<mapboxgl.Map>(
    map.on("load", ev => {
        expectType<mapboxgl.MapboxEvent>(ev);
        expectType<mapboxgl.Map>(ev.target);
        // @ts-expect-error - incompatible originalEvent does not exist on 'load' event
        expectType<undefined>(ev.originalEvent);
    }),
);
map.on("idle", ev => {
    ev satisfies mapboxgl.MapEvent;
}) satisfies mapboxgl.Map;
expectType<mapboxgl.Map>(
    map.on("remove", ev => {
        expectType<mapboxgl.MapboxEvent>(ev);
        expectType<mapboxgl.Map>(ev.target);
        // @ts-expect-error - incompatible originalEvent does not exist on 'remove' event
        expectType<undefined>(ev.originalEvent);
    }),
);
expectType<mapboxgl.Map>(
    map.on("render", ev => {
        expectType<mapboxgl.MapboxEvent>(ev);
        expectType<mapboxgl.Map>(ev.target);
        // @ts-expect-error - incompatible originalEvent does not exist on 'render' event
        expectType<undefined>(ev.originalEvent);
    }),
);
expectType<mapboxgl.Map>(
    map.on("resize", ev => {
        expectType<mapboxgl.MapboxEvent>(ev);
        expectType<mapboxgl.Map>(ev.target);
        // @ts-expect-error - incompatible originalEvent does not exist on 'resize' event
        expectType<undefined>(ev.originalEvent);
    }),
);

// Error event
expectType<mapboxgl.Map>(
    map.on("error", ev => {
        expectType<mapboxgl.ErrorEvent>(ev);
        expectType<Error>(ev.error);
        // @ts-expect-error - incompatible originalEvent does not exist on 'error' event
        expectType<undefined>(ev.originalEvent);
    }),
);

// Mouse events
expectType<mapboxgl.Map>(
    map.on("mousedown", ev => {
        expectType<mapboxgl.MapMouseEvent>(ev);
        expectType<mapboxgl.Map>(ev.target);
        expectType<mapboxgl.LngLat>(ev.lngLat);
        expectType<mapboxgl.Point>(ev.point);
        ev.preventDefault() satisfies void;
        expectType<boolean>(ev.defaultPrevented);

        expectType<MouseEvent>(ev.originalEvent);
    }),
);
expectType<mapboxgl.Map>(
    map.on("mouseup", ev => {
        expectType<mapboxgl.MapMouseEvent>(ev);
        expectType<mapboxgl.Map>(ev.target);
        expectType<mapboxgl.LngLat>(ev.lngLat);
        expectType<mapboxgl.Point>(ev.point);

        ev.preventDefault() satisfies void;
        expectType<boolean>(ev.defaultPrevented);

        expectType<MouseEvent>(ev.originalEvent);
    }),
);
expectType<mapboxgl.Map>(
    map.on("click", ev => {
        expectType<mapboxgl.MapMouseEvent>(ev);
        expectType<mapboxgl.Map>(ev.target);
        expectType<mapboxgl.LngLat>(ev.lngLat);
        expectType<mapboxgl.Point>(ev.point);

        ev.preventDefault() satisfies void;
        expectType<boolean>(ev.defaultPrevented);

        expectType<MouseEvent>(ev.originalEvent);
    }),
);
expectType<mapboxgl.Map>(
    map.on("dblclick", ev => {
        expectType<mapboxgl.MapMouseEvent>(ev);
        expectType<mapboxgl.Map>(ev.target);
        expectType<mapboxgl.LngLat>(ev.lngLat);
        expectType<mapboxgl.Point>(ev.point);

        ev.preventDefault() satisfies void;
        expectType<boolean>(ev.defaultPrevented);

        expectType<MouseEvent>(ev.originalEvent);
    }),
);
expectType<mapboxgl.Map>(
    map.on("mousemove", ev => {
        expectType<mapboxgl.MapMouseEvent>(ev);
        expectType<mapboxgl.Map>(ev.target);
        expectType<mapboxgl.LngLat>(ev.lngLat);
        expectType<mapboxgl.Point>(ev.point);

        ev.preventDefault() satisfies void;
        expectType<boolean>(ev.defaultPrevented);

        expectType<MouseEvent>(ev.originalEvent);
    }),
);
expectType<mapboxgl.Map>(
    map.on("mouseover", ev => {
        expectType<mapboxgl.MapMouseEvent>(ev);
        expectType<mapboxgl.Map>(ev.target);
        expectType<mapboxgl.LngLat>(ev.lngLat);
        expectType<mapboxgl.Point>(ev.point);

        ev.preventDefault() satisfies void;
        expectType<boolean>(ev.defaultPrevented);

        expectType<MouseEvent>(ev.originalEvent);
    }),
);
expectType<mapboxgl.Map>(
    map.on("mouseout", ev => {
        expectType<mapboxgl.MapMouseEvent>(ev);
        expectType<mapboxgl.Map>(ev.target);
        expectType<mapboxgl.LngLat>(ev.lngLat);
        expectType<mapboxgl.Point>(ev.point);

        ev.preventDefault() satisfies void;
        expectType<boolean>(ev.defaultPrevented);

        expectType<MouseEvent>(ev.originalEvent);
    }),
);
expectType<mapboxgl.Map>(
    map.on("contextmenu", ev => {
        expectType<mapboxgl.MapMouseEvent>(ev);
        expectType<mapboxgl.Map>(ev.target);
        expectType<mapboxgl.LngLat>(ev.lngLat);
        expectType<mapboxgl.Point>(ev.point);

        ev.preventDefault() satisfies void;
        expectType<boolean>(ev.defaultPrevented);

        expectType<MouseEvent>(ev.originalEvent);
    }),
);

// Touch events
expectType<mapboxgl.Map>(
    map.on("touchcancel", ev => {
        expectType<mapboxgl.MapTouchEvent>(ev);
        expectType<mapboxgl.Map>(ev.target);
        expectType<mapboxgl.LngLat>(ev.lngLat);
        expectType<mapboxgl.LngLat[]>(ev.lngLats);
        expectType<mapboxgl.Point>(ev.point);
        expectType<mapboxgl.Point[]>(ev.points);

        ev.preventDefault() satisfies void;
        expectType<boolean>(ev.defaultPrevented);

        expectType<TouchEvent>(ev.originalEvent);
    }),
);
expectType<mapboxgl.Map>(
    map.on("touchmove", ev => {
        expectType<mapboxgl.MapTouchEvent>(ev);
        expectType<mapboxgl.Map>(ev.target);
        expectType<mapboxgl.LngLat>(ev.lngLat);
        expectType<mapboxgl.LngLat[]>(ev.lngLats);
        expectType<mapboxgl.Point>(ev.point);
        expectType<mapboxgl.Point[]>(ev.points);

        ev.preventDefault() satisfies void;
        expectType<boolean>(ev.defaultPrevented);

        expectType<TouchEvent>(ev.originalEvent);
    }),
);
expectType<mapboxgl.Map>(
    map.on("touchend", ev => {
        expectType<mapboxgl.MapTouchEvent>(ev);
        expectType<mapboxgl.Map>(ev.target);
        expectType<mapboxgl.LngLat>(ev.lngLat);
        expectType<mapboxgl.LngLat[]>(ev.lngLats);
        expectType<mapboxgl.Point>(ev.point);
        expectType<mapboxgl.Point[]>(ev.points);

        ev.preventDefault() satisfies void;
        expectType<boolean>(ev.defaultPrevented);

        expectType<TouchEvent>(ev.originalEvent);
    }),
);
expectType<mapboxgl.Map>(
    map.on("touchstart", ev => {
        expectType<mapboxgl.MapTouchEvent>(ev);
        expectType<mapboxgl.Map>(ev.target);
        expectType<mapboxgl.LngLat>(ev.lngLat);
        expectType<mapboxgl.LngLat[]>(ev.lngLats);
        expectType<mapboxgl.Point>(ev.point);
        expectType<mapboxgl.Point[]>(ev.points);

        ev.preventDefault() satisfies void;
        expectType<boolean>(ev.defaultPrevented);

        expectType<TouchEvent>(ev.originalEvent);
    }),
);

// Context events
expectType<mapboxgl.Map>(
    map.on("webglcontextlost", ev => {
        expectType<mapboxgl.MapContextEvent>(ev);
        expectType<mapboxgl.Map>(ev.target);
        expectType<WebGLContextEvent | undefined>(ev.originalEvent);
    }),
);
expectType<mapboxgl.Map>(
    map.on("webglcontextrestored", ev => {
        expectType<mapboxgl.MapContextEvent>(ev);
        expectType<mapboxgl.Map>(ev.target);
        expectType<WebGLContextEvent | undefined>(ev.originalEvent);
    }),
);

// Data events
expectType<mapboxgl.Map>(
    map.on("dataloading", ev => {
        expectType<mapboxgl.MapDataEvent>(ev);
        expectType<mapboxgl.Map>(ev.target);
        // @ts-expect-error - incompatible originalEvent does not exist on 'dataloading' event
        expectType<undefined>(ev.originalEvent);
    }),
);
expectType<mapboxgl.Map>(
    map.on("data", ev => {
        expectType<mapboxgl.MapDataEvent>(ev);
        expectType<mapboxgl.Map>(ev.target);
        // @ts-expect-error - incompatible originalEvent does not exist on 'data' event
        expectType<undefined>(ev.originalEvent);
    }),
);
expectType<mapboxgl.Map>(
    map.on("tiledataloading", ev => {
        expectType<mapboxgl.MapDataEvent>(ev);
        // @ts-expect-error - incompatible
        expectType<mapboxgl.Map>(ev.target);

        // @ts-expect-error - incompatible
        expectType<undefined>(ev.originalEvent);
    }),
);
expectType<mapboxgl.Map>(
    map.on("sourcedataloading", ev => {
        expectType<mapboxgl.MapSourceDataEvent>(ev);
        expectType<mapboxgl.Map>(ev.target);
        // @ts-expect-error - incompatible originalEvent does not exist on 'sourcedataloading' event
        expectType<undefined>(ev.originalEvent);
        expectType<"source">(ev.dataType);
    }),
);
expectType<mapboxgl.Map>(
    map.on("sourcedata", ev => {
        expectType<mapboxgl.MapSourceDataEvent>(ev);
        expectType<mapboxgl.Map>(ev.target);
        // @ts-expect-error - incompatible originalEvent does not exist on 'sourcedata' event
        expectType<undefined>(ev.originalEvent);
        expectType<"source">(ev.dataType);
    }),
);
expectType<mapboxgl.Map>(
    map.on("styledataloading", ev => {
        expectType<mapboxgl.MapStyleDataEvent>(ev);
        expectType<mapboxgl.Map>(ev.target);
        // @ts-expect-error - incompatible originalEvent does not exist on 'styledataloading' event
        expectType<undefined>(ev.originalEvent);
        expectType<"style">(ev.dataType);
    }),
);
expectType<mapboxgl.Map>(
    map.on("styledata", ev => {
        expectType<mapboxgl.MapStyleDataEvent>(ev);
        expectType<mapboxgl.Map>(ev.target);
        // @ts-expect-error - incompatible originalEvent does not exist on 'styledata' event
        expectType<undefined>(ev.originalEvent);
        expectType<"style">(ev.dataType);
    }),
);

// Layer events
expectType<mapboxgl.Map>(
    map.on("click", eitherType("text", ["text1", "text2"]), ev => {
        expectType<mapboxgl.MapLayerMouseEvent>(ev);
        expectType<mapboxgl.MapboxGeoJSONFeature[] | undefined>(ev.features);
    }),
);
expectType<mapboxgl.Map>(
    map.on("dblclick", eitherType("text", ["text1", "text2"]), ev => {
        expectType<mapboxgl.MapLayerMouseEvent>(ev);
        expectType<mapboxgl.MapboxGeoJSONFeature[] | undefined>(ev.features);
    }),
);
expectType<mapboxgl.Map>(
    map.on("mousedown", eitherType("text", ["text1", "text2"]), ev => {
        expectType<mapboxgl.MapLayerMouseEvent>(ev);
        expectType<mapboxgl.MapboxGeoJSONFeature[] | undefined>(ev.features);
    }),
);
expectType<mapboxgl.Map>(
    map.on("mouseup", eitherType("text", ["text1", "text2"]), ev => {
        expectType<mapboxgl.MapLayerMouseEvent>(ev);
        expectType<mapboxgl.MapboxGeoJSONFeature[] | undefined>(ev.features);
    }),
);
expectType<mapboxgl.Map>(
    map.on("mousemove", eitherType("text", ["text1", "text2"]), ev => {
        expectType<mapboxgl.MapLayerMouseEvent>(ev);
        expectType<mapboxgl.MapboxGeoJSONFeature[] | undefined>(ev.features);
    }),
);
expectType<mapboxgl.Map>(
    map.on("mouseenter", eitherType("text", ["text1", "text2"]), ev => {
        expectType<mapboxgl.MapLayerMouseEvent>(ev);
        expectType<mapboxgl.MapboxGeoJSONFeature[] | undefined>(ev.features);
    }),
);
expectType<mapboxgl.Map>(
    map.on("mouseleave", eitherType("text", ["text1", "text2"]), ev => {
        expectType<mapboxgl.MapLayerMouseEvent>(ev);
        expectType<mapboxgl.MapboxGeoJSONFeature[] | undefined>(ev.features);
    }),
);
expectType<mapboxgl.Map>(
    map.on("mouseover", eitherType("text", ["text1", "text2"]), ev => {
        expectType<mapboxgl.MapLayerMouseEvent>(ev);
        expectType<mapboxgl.MapboxGeoJSONFeature[] | undefined>(ev.features);
    }),
);
expectType<mapboxgl.Map>(
    map.on("mouseout", eitherType("text", ["text1", "text2"]), ev => {
        expectType<mapboxgl.MapLayerMouseEvent>(ev);
        expectType<mapboxgl.MapboxGeoJSONFeature[] | undefined>(ev.features);
    }),
);
expectType<mapboxgl.Map>(
    map.on("contextmenu", eitherType("text", ["text1", "text2"]), ev => {
        expectType<mapboxgl.MapLayerMouseEvent>(ev);
        expectType<mapboxgl.MapboxGeoJSONFeature[] | undefined>(ev.features);
    }),
);

expectType<mapboxgl.Map>(
    map.on("touchstart", eitherType("text", ["text1", "text2"]), ev => {
        expectType<mapboxgl.MapLayerTouchEvent>(ev);
        expectType<mapboxgl.MapboxGeoJSONFeature[] | undefined>(ev.features);
    }),
);
expectType<mapboxgl.Map>(
    map.on("touchend", eitherType("text", ["text1", "text2"]), ev => {
        expectType<mapboxgl.MapLayerTouchEvent>(ev);
        expectType<mapboxgl.MapboxGeoJSONFeature[] | undefined>(ev.features);
    }),
);
expectType<mapboxgl.Map>(
    map.on("touchcancel", eitherType("text", ["text1", "text2"]), ev => {
        expectType<mapboxgl.MapLayerTouchEvent>(ev);
        expectType<mapboxgl.MapboxGeoJSONFeature[] | undefined>(ev.features);
    }),
);

expectType<mapboxgl.Map>(
    map.once("click", eitherType("text", ["text1", "text2"]), ev => {
        expectType<mapboxgl.MapLayerMouseEvent>(ev);
        expectType<mapboxgl.MapboxGeoJSONFeature[] | undefined>(ev.features);
    }),
);
expectType<mapboxgl.Map>(
    map.once("dblclick", eitherType("text", ["text1", "text2"]), ev => {
        expectType<mapboxgl.MapLayerMouseEvent>(ev);
        expectType<mapboxgl.MapboxGeoJSONFeature[] | undefined>(ev.features);
    }),
);
expectType<mapboxgl.Map>(
    map.once("mousedown", eitherType("text", ["text1", "text2"]), ev => {
        expectType<mapboxgl.MapLayerMouseEvent>(ev);
        expectType<mapboxgl.MapboxGeoJSONFeature[] | undefined>(ev.features);
    }),
);
expectType<mapboxgl.Map>(
    map.once("mouseup", eitherType("text", ["text1", "text2"]), ev => {
        expectType<mapboxgl.MapLayerMouseEvent>(ev);
        expectType<mapboxgl.MapboxGeoJSONFeature[] | undefined>(ev.features);
    }),
);
expectType<mapboxgl.Map>(
    map.once("mousemove", eitherType("text", ["text1", "text2"]), ev => {
        expectType<mapboxgl.MapLayerMouseEvent>(ev);
        expectType<mapboxgl.MapboxGeoJSONFeature[] | undefined>(ev.features);
    }),
);
expectType<mapboxgl.Map>(
    map.once("mouseenter", eitherType("text", ["text1", "text2"]), ev => {
        expectType<mapboxgl.MapLayerMouseEvent>(ev);
        expectType<mapboxgl.MapboxGeoJSONFeature[] | undefined>(ev.features);
    }),
);
expectType<mapboxgl.Map>(
    map.once("mouseleave", eitherType("text", ["text1", "text2"]), ev => {
        expectType<mapboxgl.MapLayerMouseEvent>(ev);
        expectType<mapboxgl.MapboxGeoJSONFeature[] | undefined>(ev.features);
    }),
);
expectType<mapboxgl.Map>(
    map.once("mouseover", eitherType("text", ["text1", "text2"]), ev => {
        expectType<mapboxgl.MapLayerMouseEvent>(ev);
        expectType<mapboxgl.MapboxGeoJSONFeature[] | undefined>(ev.features);
    }),
);
expectType<mapboxgl.Map>(
    map.once("mouseout", eitherType("text", ["text1", "text2"]), ev => {
        expectType<mapboxgl.MapLayerMouseEvent>(ev);
        expectType<mapboxgl.MapboxGeoJSONFeature[] | undefined>(ev.features);
    }),
);
expectType<mapboxgl.Map>(
    map.once("contextmenu", eitherType("text", ["text1", "text2"]), ev => {
        expectType<mapboxgl.MapLayerMouseEvent>(ev);
        expectType<mapboxgl.MapboxGeoJSONFeature[] | undefined>(ev.features);
    }),
);

expectType<mapboxgl.Map>(
    map.once("touchstart", eitherType("text", ["text1", "text2"]), ev => {
        expectType<mapboxgl.MapLayerTouchEvent>(ev);
        expectType<mapboxgl.MapboxGeoJSONFeature[] | undefined>(ev.features);
    }),
);
expectType<mapboxgl.Map>(
    map.once("touchend", eitherType("text", ["text1", "text2"]), ev => {
        expectType<mapboxgl.MapLayerTouchEvent>(ev);
        expectType<mapboxgl.MapboxGeoJSONFeature[] | undefined>(ev.features);
    }),
);
expectType<mapboxgl.Map>(
    map.once("touchcancel", eitherType("text", ["text1", "text2"]), ev => {
        expectType<mapboxgl.MapLayerTouchEvent>(ev);
        expectType<mapboxgl.MapboxGeoJSONFeature[] | undefined>(ev.features);
    }),
);

expectType<mapboxgl.Map>(map.off("click", eitherType("text", ["text1", "text2"]), () => {}));
expectType<mapboxgl.Map>(map.off("dblclick", eitherType("text", ["text1", "text2"]), () => {}));
expectType<mapboxgl.Map>(map.off("mousedown", eitherType("text", ["text1", "text2"]), () => {}));
expectType<mapboxgl.Map>(map.off("mouseup", eitherType("text", ["text1", "text2"]), () => {}));
expectType<mapboxgl.Map>(map.off("mousemove", eitherType("text", ["text1", "text2"]), () => {}));
expectType<mapboxgl.Map>(map.off("mouseenter", eitherType("text", ["text1", "text2"]), () => {}));
expectType<mapboxgl.Map>(map.off("mouseleave", eitherType("text", ["text1", "text2"]), () => {}));
expectType<mapboxgl.Map>(map.off("mouseover", eitherType("text", ["text1", "text2"]), () => {}));
expectType<mapboxgl.Map>(map.off("mouseout", eitherType("text", ["text1", "text2"]), () => {}));
expectType<mapboxgl.Map>(map.off("contextmenu", eitherType("text", ["text1", "text2"]), () => {}));
expectType<mapboxgl.Map>(map.off("touchstart", eitherType("text", ["text1", "text2"]), () => {}));
expectType<mapboxgl.Map>(map.off("touchend", eitherType("text", ["text1", "text2"]), () => {}));
expectType<mapboxgl.Map>(map.off("touchcancel", eitherType("text", ["text1", "text2"]), () => {}));

/*
 * Expression
 */
expectType<mapboxgl.Expression>(["id"]);
expectType<mapboxgl.Expression>(["get", "property"]);
expectType<mapboxgl.Expression>([
    "format",
    ["concat", ["get", "name"], "\n"],
    {},
    ["concat", ["get", "area"], "foobar", {"font-scale": 0.8}],
]);
expectType<mapboxgl.Expression>([
    "number-format",
    ["get", "quantity"],
    {"min-fraction-digits": 1, "max-fraction-digits": 1},
]);
const expression = expectType<mapboxgl.Expression>(["coalesce", ["get", "property"], ["get", "property"]]);

/*
 *    ScrollZoomHandler
 */
new mapboxgl.Map({container: 'div'}).scrollZoom.setZoomRate(1) satisfies void;
new mapboxgl.Map({container: 'div'}).scrollZoom.setWheelZoomRate(1) satisfies void;
new mapboxgl.Map({container: 'div'}).scrollZoom.enable({around: "center"}) satisfies void;

// @ts-expect-error - incompatible
const touchPitchHandler = new mapboxgl.TouchPitchHandler(map);
touchPitchHandler.enable() satisfies void;
touchPitchHandler.enable({around: "center"}) satisfies void;
touchPitchHandler.isActive() satisfies void;
touchPitchHandler.isEnabled() satisfies void;
touchPitchHandler.disable() satisfies void;

new mapboxgl.Map({container: 'div'}).touchPitch = touchPitchHandler;

/**
 * `dragPan`
 */
new mapboxgl.Map({container: 'div'}).dragPan.enable({
    linearity: 0.3,
    easing: t => t,
    maxSpeed: 1400,
    deceleration: 2500,
}) satisfies void;

/**
 * `touchZoomRotate`
 */
new mapboxgl.Map({container: 'div'}).touchZoomRotate.enable({
    around: "center",
}) satisfies void;
new mapboxgl.Map({container: 'div'}).touchZoomRotate.enable() satisfies void;
new mapboxgl.Map({container: 'div'}).touchZoomRotate.enable({}) satisfies void;

/*
 * Visibility
 */
// @ts-expect-error - incompatible
expectType<mapboxgl.Visibility>("visible");
// @ts-expect-error - incompatible
expectType<mapboxgl.Visibility>("none");

/*
 * Transition
 */

expectType<mapboxgl.Transition>({duration: 0});
expectType<mapboxgl.Transition>({delay: 0});
const transition = expectType<mapboxgl.Transition>({duration: 0, delay: 0});

/*
 * StyleFunction
 */
// @ts-expect-error - incompatible
expectType<mapboxgl.StyleFunction>({base: 1, type: "categorical"});
// @ts-expect-error - incompatible
const styleFunction = expectType<mapboxgl.StyleFunction>({
    base: 1,
    type: "exponential",
    default: 0,
    stops: [
        [1, 2],
        [3, 4],
    ],
});

/*
 * Anchor
 */

expectType<mapboxgl.Anchor>(
    eitherType("center", "left", "right", "top", "bottom", "top-left", "top-right", "bottom-left", "bottom-right"),
);
const anchor: mapboxgl.Anchor = "center";

/*
 * Layouts and Paint options
 */

const backgroundLayout: mapboxgl.BackgroundLayout = {
    visibility: eitherType("visible", "none"),
};

const backgroundPaint: NonNullable<mapboxgl.BackgroundPaint> = {
    "background-color": eitherType("#000", expression),
    "background-color-transition": transition,
    "background-pattern": "pattern",
    // @ts-expect-error - incompatible
    "background-pattern-transition": transition,
    "background-opacity": eitherType(0, expression),
    "background-opacity-transition": transition,
};

const fillLayout: mapboxgl.FillLayout = {
    "fill-sort-key": eitherType(0, expression),
};

const fillPaint: NonNullable<mapboxgl.FillPaint> = {
    "fill-antialias": eitherType(false, expression),
    "fill-opacity": eitherType(0, styleFunction, expression),
    "fill-opacity-transition": transition,
    "fill-color": eitherType("#000", styleFunction, expression),
    "fill-color-transition": transition,
    "fill-outline-color": eitherType("#000", styleFunction, expression),
    "fill-outline-color-transition": transition,
    // @ts-expect-error - incompatible
    "fill-translate": [1],
    "fill-translate-transition": transition,
    "fill-translate-anchor": eitherType("map", "viewport"),
    "fill-pattern": eitherType("#000", expression),
    "fill-pattern-transition": transition,
};

const fillExtrusionLayout: mapboxgl.FillExtrusionLayout = {
    visibility: eitherType("visible", "none"),
};

const fillExtrusionPaint: NonNullable<mapboxgl.FillExtrusionPaint> = {
    "fill-extrusion-opacity": eitherType(0, expression),
    "fill-extrusion-opacity-transition": transition,
    "fill-extrusion-color": eitherType("#000", styleFunction, expression),
    "fill-extrusion-color-transition": transition,
    // @ts-expect-error - incompatible
    "fill-extrusion-translate": eitherType([0], expression),
    "fill-extrusion-translate-transition": transition,
    "fill-extrusion-translate-anchor": eitherType("map", "viewport"),
    "fill-extrusion-pattern": eitherType("#000", expression),
    "fill-extrusion-pattern-transition": transition,
    "fill-extrusion-height": eitherType(0, styleFunction, expression),
    "fill-extrusion-height-transition": transition,
    "fill-extrusion-base": eitherType(0, styleFunction, expression),
    "fill-extrusion-base-transition": transition,
    "fill-extrusion-vertical-gradient": false,
};

const lineLayout: mapboxgl.LineLayout = {
    "line-cap": eitherType("butt", "round", "square"),
    "line-join": eitherType("bevel", "round", "miter", expression),
    "line-miter-limit": eitherType(0, expression),
    "line-round-limit": eitherType(0, expression),
    "line-sort-key": eitherType(0, expression),
};

const linePaint: NonNullable<mapboxgl.LinePaint> = {
    "line-opacity": eitherType(0, styleFunction, expression),
    "line-opacity-transition": transition,
    "line-color": eitherType("#000", styleFunction, expression),
    "line-color-transition": transition,
    // @ts-expect-error - incompatible
    "line-translate": eitherType([0], expression),
    "line-translate-transition": transition,
    "line-translate-anchor": eitherType("map", "viewport"),
    "line-width": eitherType(0, styleFunction, expression),
    "line-width-transition": transition,
    "line-gap-width": eitherType(0, styleFunction, expression),
    "line-gap-width-transition": transition,
    "line-offset": eitherType(0, styleFunction, expression),
    "line-offset-transition": transition,
    "line-blur": eitherType(0, styleFunction, expression),
    "line-blur-transition": transition,
    "line-dasharray": eitherType([0], expression),
    "line-dasharray-transition": transition,
    "line-pattern": eitherType("#000", expression),
    "line-pattern-transition": transition,
    "line-gradient": expression,
};

const symbolLayout: mapboxgl.SymbolLayout = {
    "symbol-placement": eitherType("point", "line", "line-center"),
    "symbol-spacing": eitherType(0, expression),
    "symbol-avoid-edges": false,
    "symbol-z-order": eitherType("viewport-y", "source"),
    "icon-allow-overlap": eitherType(false, styleFunction, expression),
    "icon-ignore-placement": eitherType(false, expression),
    "icon-optional": false,
    "icon-rotation-alignment": eitherType("map", "viewport", "auto"),
    "icon-size": eitherType(0, styleFunction, expression),
    "icon-text-fit": eitherType("none", "both", "width", "height"),
    "icon-text-fit-padding": eitherType([0], expression),
    "icon-image": eitherType("#000", styleFunction, expression),
    "icon-rotate": eitherType(0, styleFunction, expression),
    "icon-padding": eitherType(0, expression),
    "icon-keep-upright": false,
    "icon-offset": eitherType([0], styleFunction, expression),
    "icon-anchor": eitherType("center", styleFunction, expression),
    "icon-pitch-alignment": eitherType("map", "viewport", "auto"),
    "text-pitch-alignment": eitherType("map", "viewport", "auto"),
    "text-rotation-alignment": eitherType("map", "viewport", "auto"),
    "text-field": eitherType("#000", styleFunction, expression),
    "text-font": eitherType(["arial"], expression),
    "text-size": eitherType(0, styleFunction, expression),
    "text-max-width": eitherType(0, styleFunction, expression),
    "text-line-height": eitherType(0, expression),
    "text-letter-spacing": eitherType(0, expression),
    "text-justify": eitherType("auto", "left", "center", "right", expression),
    "text-anchor": eitherType("center", styleFunction, expression),
    "text-max-angle": eitherType(0, expression),
    "text-rotate": eitherType(0, styleFunction, expression),
    "text-padding": eitherType(0, expression),
    "text-keep-upright": false,
    "text-transform": eitherType("none", "uppercase", "lowercase", styleFunction, expression),
    "text-offset": eitherType([0], expression),
    "text-allow-overlap": false,
    "text-ignore-placement": false,
    "text-optional": false,
    "text-radial-offset": eitherType(0, expression),
    "text-variable-anchor": [anchor],
    "text-writing-mode": eitherType<
        Array<"horizontal" | "vertical">,
        Array<"horizontal" | "vertical">,
        Array<"horizontal" | "vertical">
    >(["horizontal"], ["vertical"], ["horizontal", "vertical"]),
    "symbol-sort-key": eitherType(0, expression),
};

const symbolPaint: NonNullable<mapboxgl.SymbolPaint> = {
    "icon-opacity": eitherType(0, styleFunction, expression),
    "icon-opacity-transition": transition,
    "icon-color": eitherType("#000", styleFunction, expression),
    "icon-color-transition": transition,
    "icon-halo-color": eitherType("#000", styleFunction, expression),
    "icon-halo-color-transition": transition,
    "icon-halo-width": eitherType(0, styleFunction, expression),
    "icon-halo-width-transition": transition,
    "icon-halo-blur": eitherType(0, styleFunction, expression),
    "icon-halo-blur-transition": transition,
    // @ts-expect-error - incompatible
    "icon-translate": eitherType([0], expression),
    "icon-translate-transition": transition,
    "icon-translate-anchor": eitherType("map", "viewport"),
    "text-opacity": eitherType(0, styleFunction, expression),
    "text-opacity-transition": transition,
    "text-color": eitherType("#000", styleFunction, expression),
    "text-color-transition": transition,
    "text-halo-color": eitherType("#000", styleFunction, expression),
    "text-halo-color-transition": transition,
    "text-halo-width": eitherType(0, styleFunction, expression),
    "text-halo-width-transition": transition,
    "text-halo-blur": eitherType(0, styleFunction, expression),
    "text-halo-blur-transition": transition,
    // @ts-expect-error - incompatible
    "text-translate": eitherType([0], expression),
    "text-translate-transition": transition,
    "text-translate-anchor": eitherType("map", "viewport"),
};

const rasterLayout: mapboxgl.RasterLayout = {
    visibility: eitherType("visible", "none"),
};

const rasterPaint: NonNullable<mapboxgl.RasterPaint> = {
    "raster-opacity": eitherType(0, expression),
    "raster-opacity-transition": transition,
    "raster-hue-rotate": eitherType(0, expression),
    "raster-hue-rotate-transition": transition,
    "raster-brightness-min": eitherType(0, expression),
    "raster-brightness-min-transition": transition,
    "raster-brightness-max": eitherType(0, expression),
    "raster-brightness-max-transition": transition,
    "raster-saturation": eitherType(0, expression),
    "raster-saturation-transition": transition,
    "raster-contrast": eitherType(0, expression),
    "raster-contrast-transition": transition,
    "raster-fade-duration": eitherType(0, expression),
    "raster-resampling": eitherType("linear", "nearest"),
};

const circleLayout: mapboxgl.CircleLayout = {
    visibility: eitherType("visible", "none"),
    "circle-sort-key": eitherType(0, expression),
};

const circlePaint: NonNullable<mapboxgl.CirclePaint> = {
    "circle-radius": eitherType(0, styleFunction, expression),
    "circle-radius-transition": transition,
    "circle-color": eitherType("#000", styleFunction, expression),
    "circle-color-transition": transition,
    "circle-blur": eitherType(0, styleFunction, expression),
    "circle-blur-transition": transition,
    "circle-opacity": eitherType(0, styleFunction, expression),
    "circle-opacity-transition": transition,
    // @ts-expect-error - incompatible
    "circle-translate": eitherType([0], expression),
    "circle-translate-transition": transition,
    "circle-translate-anchor": eitherType("map", "viewport"),
    "circle-pitch-scale": eitherType("map", "viewport"),
    "circle-pitch-alignment": eitherType("map", "viewport"),
    "circle-stroke-width": eitherType(0, styleFunction, expression),
    "circle-stroke-width-transition": transition,
    "circle-stroke-color": eitherType("#000", styleFunction, expression),
    "circle-stroke-color-transition": transition,
    "circle-stroke-opacity": eitherType(0, styleFunction, expression),
    "circle-stroke-opacity-transition": transition,
};

const heatmapLayout: mapboxgl.HeatmapLayout = {
    visibility: eitherType("visible", "none"),
};

const heatmapPaint: NonNullable<mapboxgl.HeatmapPaint> = {
    "heatmap-radius": eitherType(0, styleFunction, expression),
    "heatmap-radius-transition": transition,
    "heatmap-weight": eitherType(0, styleFunction, expression),
    "heatmap-intensity": eitherType(0, styleFunction, expression),
    "heatmap-intensity-transition": transition,
    "heatmap-color": eitherType("#000", styleFunction, expression),
    "heatmap-opacity": eitherType(0, styleFunction, expression),
    "heatmap-opacity-transition": transition,
};

const hillshadeLayout: mapboxgl.HillshadeLayout = {
    visibility: eitherType("visible", "none"),
};

const hillshadePaint: NonNullable<mapboxgl.HillshadePaint> = {
    "hillshade-illumination-direction": eitherType(0, expression),
    "hillshade-illumination-anchor": eitherType("map", "viewport"),
    "hillshade-exaggeration": eitherType(0, expression),
    "hillshade-exaggeration-transition": transition,
    "hillshade-shadow-color": eitherType("#000", expression),
    "hillshade-shadow-color-transition": transition,
    "hillshade-highlight-color": eitherType("#000", expression),
    "hillshade-highlight-color-transition": transition,
    "hillshade-accent-color": eitherType("#000", expression),
    "hillshade-accent-color-transition": transition,
};

const skyLayout: mapboxgl.SkyLayout = {
    visibility: eitherType("visible", "none"),
};

const skyPaint: NonNullable<mapboxgl.SkyPaint> = {
    // @ts-expect-error - incompatible
    "sky-atmosphere-color": eitherType("white", expression),
    // @ts-expect-error - incompatible
    "sky-atmosphere-halo-color": eitherType("white", expression),
    // @ts-expect-error - incompatible
    "sky-atmosphere-sun": eitherType([0], expression),
    // @ts-expect-error - incompatible
    "sky-atmosphere-sun-intensity": eitherType(0, expression),
    // @ts-expect-error - incompatible
    "sky-gradient": eitherType("#000", expression),
    // @ts-expect-error - incompatible
    "sky-gradient-center": eitherType([0], expression),
    "sky-gradient-radius": eitherType(0, expression),
    "sky-opacity": eitherType(0, expression),
    "sky-type": eitherType("gradient", "atmosphere"),
};

/* Make sure every layout has all properties optional */
eitherType<
    mapboxgl.BackgroundLayout,
    mapboxgl.FillLayout,
    mapboxgl.FillExtrusionLayout,
    mapboxgl.LineLayout,
    mapboxgl.SymbolLayout,
    mapboxgl.RasterLayout,
    mapboxgl.CircleLayout,
    mapboxgl.HeatmapLayout,
    mapboxgl.HillshadeLayout,
    mapboxgl.SkyLayout
>({}, {}, {}, {}, {}, {}, {}, {}, {}, {});

/* Make sure every paint has all properties optional */
eitherType<
    mapboxgl.BackgroundPaint,
    mapboxgl.FillPaint,
    mapboxgl.FillExtrusionPaint,
    mapboxgl.LinePaint,
    mapboxgl.SymbolPaint,
    mapboxgl.RasterPaint,
    mapboxgl.CirclePaint,
    mapboxgl.HeatmapPaint,
    mapboxgl.HillshadePaint,
    mapboxgl.SkyPaint
>({}, {}, {}, {}, {}, {}, {}, {}, {}, {});

/*
 * AnyLayout
 */
expectType<mapboxgl.AnyLayout>(
    eitherType(
        backgroundLayout,
        fillLayout,
        fillExtrusionLayout,
        lineLayout,
        symbolLayout,
        rasterLayout,
        circleLayout,
        heatmapLayout,
        hillshadeLayout,
        skyLayout,
    ),
);

/*
 * AnyPaint
 */
expectType<mapboxgl.AnyPaint>(
    eitherType(
        backgroundPaint,
        fillPaint,
        fillExtrusionPaint,
        linePaint,
        symbolPaint,
        rasterPaint,
        circlePaint,
        heatmapPaint,
        hillshadePaint,
        skyPaint,
    ),
);

/*
 * Make sure layer gets proper Paint, corresponding to layer's type
 */

expectType<mapboxgl.AnyLayer>({id: "unique", type: "background", paint: {"background-opacity": 1}});
// @ts-expect-error
expectType<mapboxgl.AnyLayer>({id: "unique", type: "background", paint: {"line-opacity": 1}});

// @ts-expect-error - incompatible
expectType<mapboxgl.AnyLayer>({id: "unique", type: "fill", paint: {"fill-opacity": 1}});
// @ts-expect-error
expectType<mapboxgl.AnyLayer>({id: "unique", type: "fill", paint: {"line-opacity": 1}});

// @ts-expect-error - incompatible
expectType<mapboxgl.AnyLayer>({id: "unique", type: "line", paint: {"line-opacity": 1}});
// @ts-expect-error
expectType<mapboxgl.AnyLayer>({id: "unique", type: "line", paint: {"fill-opacity": 1}});

/**
 * Test map.addImage()
 */

// HTMLImageElement
const fooHTMLImageElement = document.createElement("img");
map.addImage("foo", fooHTMLImageElement);

// ImageData
const fooImageData = new ImageData(8, 8);
map.addImage("foo", fooImageData);

// ImageData like
const fooImageDataLike1 = {
    width: 10,
    height: 10,
    data: new Uint8ClampedArray(8),
};
map.addImage("foo", fooImageDataLike1);

const fooImageDataLike2 = {
    width: 10,
    height: 10,
    data: new Uint8Array(8),
};
map.addImage("foo", fooImageDataLike2);

// ArrayBufferView
const fooArrayBufferView: ArrayBufferView = new Uint8Array(8);
// @ts-expect-error - incompatible
map.addImage("foo", fooArrayBufferView);

// ImageBitmap
createImageBitmap(fooHTMLImageElement).then(fooImageBitmap => {
    map.addImage("foo", fooImageBitmap);
});

map.loadImage("foo", (error, result) => {}) satisfies void;

// KeyboardHandler
// @ts-expect-error - incompatible
var keyboardHandler = new mapboxgl.KeyboardHandler(map);
keyboardHandler.enableRotation() satisfies void;
keyboardHandler.disableRotation() satisfies void;

/**
 * Test projections
 */

// projection config: name only
expectType<mapboxgl.Projection>({name: "mercator"});

// projection config: with center and parallels
expectType<mapboxgl.Projection>({name: "lambertConformalConic", center: [0, 0], parallels: [30, 60]});

// set projection with string
map.setProjection("mercator");

// set projection with config
map.setProjection({name: "globe"});

// get projections
expectType<mapboxgl.Projection>(map.getProjection());
