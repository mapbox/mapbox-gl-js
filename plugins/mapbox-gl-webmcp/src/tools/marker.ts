import {newPopup, popupOptionsSchema, popupTextDescription} from './popup';
import {applyEach, each} from './utils';

import type {Map as MapboxMap, Marker, MarkerOptions} from 'mapbox-gl';
import type {MapboxGLModule, MapboxWebMCPTool} from '../index';
import type {Infer, ObjectSchema} from '../schema';

const inputSchema = {
    type: 'object',
    properties: {
        action: {type: 'string', enum: ['list', 'add', 'update', 'remove']},
        lng: {type: 'number'},
        lat: {type: 'number'},
        html: {type: 'string', description: 'HTML of the marker element, which GL JS shows as it is in place of the default marker.'},
        color: {type: 'string', description: 'A CSS color of the default marker.'},
        scale: {type: 'number', description: 'The size of the default marker, 1 is its natural size.'},
        anchor: {type: 'string', description: 'The part of the marker at its LngLat, such as "bottom".'},
        offset: {type: 'array', items: {type: 'number'}, description: '[x, y] in pixels.'},
        rotation: {type: 'number', description: 'Degrees clockwise.'},
        rotationAlignment: {type: 'string'},
        pitchAlignment: {type: 'string'},
        occludedOpacity: {type: 'number', description: 'The opacity of the marker behind 3D terrain.'},
        className: {type: 'string'},
        altitude: {type: 'number', description: 'Meters above the map.'},
        draggable: {type: 'boolean'},
        clickTolerance: {type: 'number', description: 'Pixels that the pointer can move in a click.'},
        popup: {...popupOptionsSchema, description: `The popup that the marker opens on click, with the options of a GL JS Popup. ${popupTextDescription}`},
        popupOpen: {type: 'boolean', description: 'Opens or closes the popup of the marker, as a click on the marker does.'},
        ids: {type: 'array', items: {type: 'string'}, description: 'Marker ids, as adding or listing markers returns them.'}
    },
    required: ['action'],
    additionalProperties: false
} as const satisfies ObjectSchema;
type Input = Infer<typeof inputSchema>;
type Markers = Map<string, Marker>;

const mapMarkers = new WeakMap<MapboxMap, Markers>();
let markersOnPage = 0;

function shown(map: MapboxMap, markers: Markers): Markers {
    return new Map([...markers].filter(([, marker]) => map.getContainer().contains(marker.getElement())));
}

function listMarkers(markers: Markers) {
    return Array.from(markers, ([id, marker]) => {
        const {lng, lat} = marker.getLngLat();
        const {x, y} = marker.getOffset();
        const popup = marker.getPopup();
        return {
            id, lng, lat,
            offset: [x, y],
            rotation: marker.getRotation(),
            rotationAlignment: marker.getRotationAlignment(),
            pitchAlignment: marker.getPitchAlignment(),
            occludedOpacity: marker.getOccludedOpacity(),
            altitude: marker.getAltitude(),
            draggable: marker.isDraggable(),
            ...(popup && {popup: {isOpen: popup.isOpen()}})
        };
    });
}

function setPopupOpen(marker: Marker, open: boolean): void {
    const popup = marker.getPopup();
    if (!popup) throw new Error('The marker has no popup.');
    if (popup.isOpen() !== open) marker.togglePopup();
}

function addMarker(map: MapboxMap, mapboxgl: MapboxGLModule, markers: Markers, {action, ids, lng, lat, html, popup: popupInput, popupOpen, ...options}: Input) {
    if (typeof lng !== 'number' || typeof lat !== 'number') throw new Error('A marker needs lng and lat.');
    const id = `mapbox-webmcp-marker-${++markersOnPage}`;
    let element: HTMLElement | undefined;
    if (html !== undefined) {
        element = map.getContainer().ownerDocument.createElement('div');
        element.innerHTML = html;
    }
    const marker = new mapboxgl.Marker({...options, element} as MarkerOptions).setLngLat([lng, lat]);
    marker.getElement().id = id;
    if (popupInput) marker.setPopup(newPopup(mapboxgl, `${id}-popup`, popupInput));
    markers.set(id, marker);
    const parts: [string, () => unknown][] = [[`Marker "${id}"`, () => marker.addTo(map)]];
    if (popupOpen !== undefined) parts.push([`Marker "${id}" popupOpen`, () => setPopupOpen(marker, popupOpen)]);
    applyEach(map, parts, 'The other changes applied. List the markers to see them.');
    return listMarkers(shown(map, markers)).find((m) => m.id === id);
}

function updateMarkers(map: MapboxMap, mapboxgl: MapboxGLModule, markers: Markers, {ids, lng, lat, rotation, draggable, popup, popupOpen}: Input) {
    if ((lng === undefined) !== (lat === undefined)) throw new Error('Give lng and lat together.');
    const unique = each(map, shown(map, markers), 'Marker', ids, 'update', (marker, id) => {
        const parts: [string, () => unknown][] = [];
        if (lng !== undefined && lat !== undefined) parts.push([`Marker "${id}" lng and lat`, () => marker.setLngLat([lng, lat])]);
        if (rotation !== undefined) parts.push([`Marker "${id}" rotation`, () => marker.setRotation(rotation)]);
        if (draggable !== undefined) parts.push([`Marker "${id}" draggable`, () => marker.setDraggable(draggable)]);
        if (popup) parts.push([`Marker "${id}" popup`, () => marker.setPopup(newPopup(mapboxgl, `${id}-popup`, popup))]);
        if (popupOpen !== undefined) parts.push([`Marker "${id}" popupOpen`, () => setPopupOpen(marker, popupOpen)]);
        return parts;
    });
    return listMarkers(shown(map, markers)).filter((m) => unique.includes(m.id));
}

function removeMarkers(map: MapboxMap, markers: Markers, {ids}: Input) {
    each(map, shown(map, markers), 'Marker', ids, 'remove', (marker, id) => [[`Marker "${id}"`, () => {
        marker.remove();
        markers.delete(id);
    }]]);
    return listMarkers(shown(map, markers));
}

export const marker: MapboxWebMCPTool<typeof inputSchema> = {
    description: 'Markers this tool adds to the map, with the options of a GL JS Marker and an optional popup. "list" and "remove" cover only these markers, never the app\'s own markers. GL JS has no list of the markers of a map, so the tool keeps the markers it added and covers those whose element the map container still holds. A marker that the app removed from the map is not listed. "list" returns the markers with their ids. "add" adds a marker and returns it with its id. "update" changes lng and lat, rotation, draggable, popup and popupOpen of the markers with the given ids, and returns them. For any other option, remove the marker and add it again. "remove" removes the markers with the given ids and returns the markers that are left. "update" and "remove" apply each change to each marker on its own, so when an id names no marker or GL JS refuses a change, the other changes still apply and the error names each failed one. Each marker comes back with the LngLat and the options that GL JS reads back.',
    inputSchema,
    execute(input, map, mapboxgl) {
        const markers: Markers = mapMarkers.get(map) ?? new Map<string, Marker>();
        mapMarkers.set(map, markers);
        const actions = {
            list: () => listMarkers(shown(map, markers)),
            add: () => addMarker(map, mapboxgl, markers, input),
            update: () => updateMarkers(map, mapboxgl, markers, input),
            remove: () => removeMarkers(map, markers, input)
        };
        return actions[input.action]();
    }
};
