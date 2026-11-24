import {newPopup, popupOptionsSchema} from './popup';
import {applyEach, each, lngLatSchema, pick, propertiesSchema} from './utils';

import type {Map as MapboxMap, Marker, MarkerOptions} from 'mapbox-gl';
import type {MapboxGLModule, MapboxWebMCPTool} from '../index';
import type {Infer, ObjectSchema} from '../schema';

const markerSchema = {
    type: 'object',
    properties: {
        id: {type: 'string', description: '"update": a marker id from "add" or "list".'},
        lngLat: lngLatSchema,
        html: {type: 'string', description: 'An element in place of the default marker.'},
        color: {type: 'string'},
        scale: {type: 'number'},
        anchor: {type: 'string'},
        offset: {type: 'array', items: {type: 'number'}, description: '[x, y] in pixels. Negative x moves left and negative y moves up.'},
        rotation: {type: 'number'},
        rotationAlignment: {type: 'string'},
        pitchAlignment: {type: 'string'},
        occludedOpacity: {type: 'number'},
        className: {type: 'string'},
        altitude: {type: 'number'},
        draggable: {type: 'boolean'},
        clickTolerance: {type: 'number'},
        popup: {...popupOptionsSchema, description: 'The popup that a click on the marker opens.'},
        popupOpen: {type: 'boolean', description: 'Open or close the marker popup. The marker needs a popup.'}
    },
    additionalProperties: false
} as const;
const inputSchema = {
    type: 'object',
    properties: {
        action: {type: 'string', enum: ['list', 'add', 'update', 'remove']},
        markers: {type: 'array', items: markerSchema, default: []},
        ids: {type: 'array', items: {type: 'string'}},
        properties: {...propertiesSchema, description: '"list": select marker fields such as ["id", "lngLat"]. Missing fields return null.'}
    },
    required: ['action'],
    additionalProperties: false
} as const satisfies ObjectSchema;
type Input = Infer<typeof inputSchema>;
type MarkerInput = Infer<typeof markerSchema>;
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
            id, lngLat: {lng, lat},
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

function addMarker(map: MapboxMap, mapboxgl: MapboxGLModule, markers: Markers, {id: _, lngLat, html, popup: popupInput, popupOpen: __, ...options}: MarkerInput): string {
    if (!lngLat) throw new Error('A marker needs a lngLat.');
    const id = `mapbox-webmcp-marker-${++markersOnPage}`;
    let element: HTMLElement | undefined;
    if (html !== undefined) {
        element = map.getContainer().ownerDocument.createElement('div');
        element.innerHTML = html;
    }
    const marker = new mapboxgl.Marker({...options, element} as MarkerOptions).setLngLat([lngLat.lng, lngLat.lat]);
    marker.getElement().id = id;
    if (popupInput) marker.setPopup(newPopup(mapboxgl, `${id}-popup`, popupInput));
    markers.set(id, marker);
    marker.addTo(map);
    return id;
}

function addMarkers(map: MapboxMap, mapboxgl: MapboxGLModule, markers: Markers, {markers: given}: Input) {
    if (!given.length) throw new Error('Give the markers to add.');
    const added: string[] = [];
    applyEach(map, given.flatMap((input, i): [string, () => unknown][] => {
        const add: [string, () => unknown] = [`markers[${i}]`, () => { added[i] = addMarker(map, mapboxgl, markers, input); }];
        const {popupOpen} = input;
        return popupOpen === undefined ? [add] : [add, [`markers[${i}] popupOpen`, () => added[i] && setPopupOpen(markers.get(added[i])!, popupOpen)]];
    }), 'The other changes applied. List the markers to see them.');
    return listMarkers(shown(map, markers)).filter((m) => added.includes(m.id));
}

function updateMarkers(map: MapboxMap, mapboxgl: MapboxGLModule, markers: Markers, {markers: given}: Input) {
    if (!given.length) throw new Error('Give the markers to update, each with its id.');
    const unique = each(map, shown(map, markers), 'Marker', given.map(({id}) => id ?? ''), 'update', (marker, id) => given.filter((input) => input.id === id).flatMap(({lngLat, rotation, draggable, popup, popupOpen}) => {
        const parts: [string, () => unknown][] = [];
        if (lngLat) parts.push([`Marker "${id}" lngLat`, () => marker.setLngLat([lngLat.lng, lngLat.lat])]);
        if (rotation !== undefined) parts.push([`Marker "${id}" rotation`, () => marker.setRotation(rotation)]);
        if (draggable !== undefined) parts.push([`Marker "${id}" draggable`, () => marker.setDraggable(draggable)]);
        if (popup) parts.push([`Marker "${id}" popup`, () => marker.setPopup(newPopup(mapboxgl, `${id}-popup`, popup))]);
        if (popupOpen !== undefined) parts.push([`Marker "${id}" popupOpen`, () => setPopupOpen(marker, popupOpen)]);
        return parts;
    }));
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
    title: 'Markers',
    description: `Manage markers this tool adds. For a popup that opens on marker click, set the marker's popup.
"add" requires lngLat for each marker and returns each marker with its id.
"update" needs an id for each marker and can change lngLat, rotation, draggable, popup and popupOpen.
"list" finds markers still on the map. "remove" removes the given ids and returns the remaining markers.`,
    inputSchema,
    execute(input, map, mapboxgl) {
        const markers: Markers = mapMarkers.get(map) ?? new Map<string, Marker>();
        mapMarkers.set(map, markers);
        const actions = {
            list: () => listMarkers(shown(map, markers)).map((m) => pick(m, input.properties)),
            add: () => addMarkers(map, mapboxgl, markers, input),
            update: () => updateMarkers(map, mapboxgl, markers, input),
            remove: () => removeMarkers(map, markers, input)
        };
        return actions[input.action]();
    }
};
