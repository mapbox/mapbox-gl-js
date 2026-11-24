import {each, lngLatSchema, pick, propertiesSchema} from './utils';

import type {Map as MapboxMap, Popup, PopupOptions} from 'mapbox-gl';
import type {MapboxGLModule, MapboxWebMCPTool} from '../index';
import type {Infer, ObjectSchema} from '../schema';

export const popupOptionsSchema = {
    type: 'object',
    properties: {
        text: {type: 'string', description: 'Plain text content.'},
        html: {type: 'string', description: 'HTML content. If you also pass text, html replaces it.'},
        closeButton: {type: 'boolean'},
        closeOnClick: {type: 'boolean'},
        closeOnMove: {type: 'boolean'},
        focusAfterOpen: {type: 'boolean'},
        anchor: {type: 'string'},
        offset: {type: ['number', 'array', 'object'], description: 'Offset in pixels. Pass a distance, an [x, y] pair, or an object mapping anchor names to [x, y] pairs.'},
        className: {type: 'string'},
        maxWidth: {type: 'string', description: 'CSS max-width, such as "300px". Use "none" to size to the content.'},
        altitude: {type: 'number'}
    },
    additionalProperties: false
} as const;

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
        lngLat: lngLatSchema,
        ...popupOptionsSchema.properties,
        ids: {type: 'array', items: {type: 'string'}},
        properties: {...propertiesSchema, description: '"list": select from id, lngLat and maxWidth. Missing fields return null.'}
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
        return {id, lngLat: {lng, lat}, maxWidth: popup.getMaxWidth()};
    });
}

function addPopup(map: MapboxMap, mapboxgl: MapboxGLModule, popups: Popups, {action, ids, lngLat, properties, ...options}: Input) {
    if (!lngLat) throw new Error('A popup needs a lngLat.');
    const id = `mapbox-webmcp-popup-${++popupsOnPage}`;
    const popup = newPopup(mapboxgl, id, options).setLngLat([lngLat.lng, lngLat.lat]).addTo(map);
    popups.set(id, popup);
    return listPopups(open(popups)).find((p) => p.id === id);
}

function updatePopups(map: MapboxMap, popups: Popups, {ids, lngLat, text, html}: Input) {
    const unique = each(map, open(popups), 'Popup', ids, 'update', (popup, id) => {
        const parts: [string, () => unknown][] = [];
        if (lngLat) parts.push([`Popup "${id}" lngLat`, () => popup.setLngLat([lngLat.lng, lngLat.lat])]);
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
    title: 'Popups',
    description: `Manage standalone popups. For a popup that opens on marker click, use the marker tool.
"add" opens one popup at lngLat and returns its id and position.
"list", "update" and "remove" cover open popups this tool added. "update" changes lngLat, text or html for the given ids. "remove" closes the given ids and returns the remaining open popups.`,
    inputSchema,
    execute(input, map, mapboxgl) {
        const popups: Popups = mapPopups.get(map) ?? new Map<string, Popup>();
        mapPopups.set(map, popups);
        const actions = {
            list: () => listPopups(open(popups)).map((p) => pick(p, input.properties)),
            add: () => addPopup(map, mapboxgl, popups, input),
            update: () => updatePopups(map, popups, input),
            remove: () => removePopups(map, popups, input)
        };
        return actions[input.action]();
    }
};
