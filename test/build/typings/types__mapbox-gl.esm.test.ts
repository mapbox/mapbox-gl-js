/* eslint-disable */

// Typing test for the ESM named-export entry point (mapbox-gl/esm).
// Tests that all public symbols are available as named exports and that
// the new setter functions have the correct signatures.

import {
    version,
    supported,
    Map,
    NavigationControl,
    GeolocateControl,
    AttributionControl,
    ScaleControl,
    FullscreenControl,
    IndoorControl,
    Popup,
    Marker,
    Style,
    LngLat,
    LngLatBounds,
    Point,
    MercatorCoordinate,
    FreeCameraOptions,
    Evented,
    setRTLTextPlugin,
    getRTLTextPluginStatus,
    addTileProvider,
    prewarm,
    clearPrewarmedResources,
    clearStorage,
    setNow,
    restoreNow,
    setAccessToken,
    setBaseApiUrl,
    getWorkerCount,
    setWorkerCount,
    setMaxParallelImageRequests,
    setDracoUrl,
    setMeshoptUrl,
    setBuildingGenUrl,
    getDracoUrl,
    getMeshoptUrl,
    getBuildingGenUrl,
} from 'mapbox-gl/esm';

import type {
    MapOptions,
    LngLatLike,
    RequestTransformFunction,
    ResourceType,
    RequestParameters,
    ControlPosition,
} from 'mapbox-gl/esm';

// version is a string constant
version satisfies string;

// supported() returns a boolean
supported() satisfies boolean;

// Global getters and setters
setAccessToken('pk.abc123') satisfies void;
setBaseApiUrl('https://api.mapbox.com') satisfies void;
getWorkerCount() satisfies number;
setWorkerCount(4) satisfies void;
setMaxParallelImageRequests(10) satisfies void;
setDracoUrl('https://example.com/draco.wasm') satisfies void;
setMeshoptUrl('https://example.com/meshopt.wasm') satisfies void;
setBuildingGenUrl('https://example.com/building_gen.wasm') satisfies void;

// Getter helpers return strings
getDracoUrl() satisfies string;
getMeshoptUrl() satisfies string;
getBuildingGenUrl() satisfies string;

// clearStorage accepts an optional callback
clearStorage() satisfies void;
clearStorage((err: Error | null | undefined) => { err satisfies Error | null | undefined; }) satisfies void;

// Map constructor and basic methods
const map = new Map({
    container: 'map',
    center: [-96, 37.8] satisfies LngLatLike,
    zoom: 2,
    hash: true,
    attributionControl: false,
} satisfies MapOptions);

map.on('load', () => {});
map.remove();

// Controls
map.addControl(new NavigationControl(), 'top-left' satisfies ControlPosition);
map.addControl(new GeolocateControl());
map.addControl(new AttributionControl({compact: true}));
map.addControl(new ScaleControl({unit: 'metric', maxWidth: 80}));
map.addControl(new FullscreenControl({container: document.querySelector('body')}));

// Geometry helpers
const lngLat = new LngLat(-122.4, 37.8);
lngLat.lng satisfies number;
lngLat.lat satisfies number;

const bounds = new LngLatBounds([-73.99, 40.70], [-73.94, 40.73]);
bounds.getNorth() satisfies number;

const coord = MercatorCoordinate.fromLngLat(lngLat);
coord.x satisfies number;

const point = new Point(0, 0);
point.x satisfies number;

// Popup and Marker
const popup = new Popup().setText('Hello');
const marker = new Marker().setLngLat(lngLat).setPopup(popup);

// Evented is a base class
new Evented();

// setNow / restoreNow
setNow(12345) satisfies void;
restoreNow() satisfies void;

// RTL plugin
getRTLTextPluginStatus() satisfies string;

// prewarm / clearPrewarmedResources
prewarm() satisfies void;
clearPrewarmedResources() satisfies void;

// import * as mapboxgl pattern that users are expected to adopt
import * as mapboxgl from 'mapbox-gl/esm';
mapboxgl.Map satisfies typeof Map;
mapboxgl.version satisfies string;
mapboxgl.setAccessToken satisfies typeof setAccessToken;
