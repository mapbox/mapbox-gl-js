import {each} from './utils';

import type {Map as MapboxMap, Popup, PopupOptions} from 'mapbox-gl';
import type {MapboxGLModule, MapboxWebMCPTool} from '../index';
import type {Infer, ObjectSchema} from '../schema';

export const popupOptionsSchema = {
    type: 'object',
    properties: {
        text: {type: 'string'},
        html: {type: 'string'},
        closeButton: {type: 'boolean'},
        closeOnClick: {type: 'boolean'},
        closeOnMove: {type: 'boolean'},
        focusAfterOpen: {type: 'boolean'},
        anchor: {type: 'string', description: 'The part of the popup at its LngLat, such as "bottom".'},
        offset: {type: ['number', 'array', 'object'], description: 'Pixels, [x, y], or [x, y] by anchor.'},
        className: {type: 'string'},
        maxWidth: {type: 'string', description: 'A CSS max-width, such as "300px".'},
        altitude: {type: 'number', description: 'Meters above the map.'}
    },
    additionalProperties: false
} as const;
export const popupTextDescription = 'text goes to setText, which shows a newline as a space. html goes to setHTML as it is, so <br> starts a new line.';

export function newPopup(mapboxgl: MapboxGLModule, elementId: string, {text, html, ...options}: Infer<typeof popupOptionsSchema>): Popup {
    const popup = new mapboxgl.Popup(options as PopupOptions);
    if (text !== undefined) popup.setText(text);
    if (html !== undefined) popup.setHTML(html);
    // GL JS makes a new popup element each time the popup opens.
    popup.on('open', () => {
        popup.getElement()!.id = elementId;
    });
    return popup;
}

const inputSchema = {
    type: 'object',
    properties: {
        action: {type: 'string', enum: ['list', 'add', 'update', 'remove']},
        lng: {type: 'number'},
        lat: {type: 'number'},
        ...popupOptionsSchema.properties,
        ids: {type: 'array', items: {type: 'string'}, description: 'Popup ids, as adding or listing popups returns them.'}
    },
    required: ['action'],
    additionalProperties: false
} as const satisfies ObjectSchema;
type Input = Infer<typeof inputSchema>;
type Popups = Map<string, Popup>;

const mapPopups = new WeakMap<MapboxMap, Popups>();
let popupsOnPage = 0;

function open(popups: Popups): Popups {
    return new Map([...popups].filter(([, popup]) => popup.isOpen()));
}

function listPopups(popups: Popups) {
    return Array.from(popups, ([id, popup]) => {
        const {lng, lat} = popup.getLngLat();
        return {id, lng, lat, maxWidth: popup.getMaxWidth()};
    });
}

function addPopup(map: MapboxMap, mapboxgl: MapboxGLModule, popups: Popups, {action, ids, lng, lat, ...options}: Input) {
    if (typeof lng !== 'number' || typeof lat !== 'number') throw new Error('A popup needs lng and lat.');
    const id = `mapbox-webmcp-popup-${++popupsOnPage}`;
    const popup = newPopup(mapboxgl, id, options).setLngLat([lng, lat]).addTo(map);
    popups.set(id, popup);
    return listPopups(open(popups)).find((p) => p.id === id);
}

function updatePopups(map: MapboxMap, popups: Popups, {ids, lng, lat, text, html}: Input) {
    if ((lng === undefined) !== (lat === undefined)) throw new Error('Give lng and lat together.');
    const unique = each(map, open(popups), 'Popup', ids, 'update', (popup, id) => {
        const parts: [string, () => unknown][] = [];
        if (lng !== undefined && lat !== undefined) parts.push([`Popup "${id}" lng and lat`, () => popup.setLngLat([lng, lat])]);
        if (text !== undefined) parts.push([`Popup "${id}" text`, () => popup.setText(text)]);
        if (html !== undefined) parts.push([`Popup "${id}" html`, () => popup.setHTML(html)]);
        return parts;
    });
    return listPopups(open(popups)).filter((p) => unique.includes(p.id));
}

function removePopups(map: MapboxMap, popups: Popups, {ids}: Input) {
    each(map, open(popups), 'Popup', ids, 'remove', (popup, id) => [[`Popup "${id}"`, () => {
        popup.remove();
        popups.delete(id);
    }]]);
    return listPopups(open(popups));
}

export const popup: MapboxWebMCPTool<typeof inputSchema> = {
    description: `Popups this tool adds to the map at a LngLat, with the options of a GL JS Popup. ${popupTextDescription} "list", "update" and "remove" cover only these popups, never the app's own popups or the popups of markers, which the marker tool opens and closes. A popup that GL JS closes, such as on a map click or its close button, leaves the map and the list. "list" returns the open popups with their ids. "add" adds a popup and returns it with its id. "update" changes lng and lat, text and html of the popups with the given ids, and returns them. For any other option, remove the popup and add it again. "remove" removes the popups with the given ids and returns the popups that are left. "update" and "remove" apply each change to each popup on its own, so when an id names no popup or GL JS refuses a change, the other changes still apply and the error names each failed one. Each popup comes back with the LngLat and the maxWidth that GL JS reads back.`,
    inputSchema,
    execute(input, map, mapboxgl) {
        const popups: Popups = mapPopups.get(map) ?? new Map<string, Popup>();
        mapPopups.set(map, popups);
        const actions = {
            list: () => listPopups(open(popups)),
            add: () => addPopup(map, mapboxgl, popups, input),
            update: () => updatePopups(map, popups, input),
            remove: () => removePopups(map, popups, input)
        };
        return actions[input.action]();
    }
};
