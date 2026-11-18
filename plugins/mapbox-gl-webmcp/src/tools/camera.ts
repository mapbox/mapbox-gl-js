import {featureByRef, featureRefSchema, idle, lngLatSchema, positions, queryType, target} from './utils';

import type {Position} from 'geojson';
import type {EasingOptions, Map as MapboxMap} from 'mapbox-gl';
import type {MapboxGLModule, MapboxWebMCPTool} from '../index';
import type {Infer, ObjectSchema} from '../schema';

const inputSchema = {
    type: 'object',
    properties: {
        action: {type: 'string', enum: ['get', 'jumpTo', 'easeTo', 'flyTo', 'fitBounds']},
        center: lngLatSchema,
        zoom: {type: 'number'},
        bearing: {type: 'number', description: 'Degrees clockwise from north.'},
        pitch: {type: 'number', description: 'Degrees away from straight down, 0 looks straight down.'},
        around: {...lngLatSchema, description: 'The LngLat that stays in place while the zoom changes.'},
        padding: {
            type: ['number', 'object'],
            properties: {top: {type: 'number'}, bottom: {type: 'number'}, left: {type: 'number'}, right: {type: 'number'}},
            additionalProperties: false,
            description: 'Pixels on each side, or {top, bottom, left, right}.'
        },
        retainPadding: {type: 'boolean'},
        minZoom: {type: 'number', description: 'flyTo: the zoom at the top of the flight.'},
        maxZoom: {type: 'number', description: 'fitBounds: the highest zoom.'},
        animate: {type: 'boolean'},
        duration: {type: 'number', description: 'Milliseconds.'},
        essential: {type: 'boolean', description: 'When the user prefers reduced motion, a move does not animate. true animates it anyway, against the user\'s choice. Set it only when the user asks to see the motion.'},
        curve: {type: 'number'},
        speed: {type: 'number'},
        screenSpeed: {type: 'number'},
        maxDuration: {type: 'number', description: 'Milliseconds.'},
        linear: {type: 'boolean', description: 'fitBounds: ease instead of fly.'},
        offset: {type: 'array', items: {type: 'number'}, description: '[x, y] pixels of the new center from the map center.'},
        preloadOnly: {type: 'boolean', description: 'Load the tiles on the way without moving. The call returns before the tiles load.'},
        features: {type: 'array', items: featureRefSchema, default: [], description: 'Features to fit on screen, by target and id.'},
        lngLats: {type: 'array', items: lngLatSchema, default: [], description: 'Locations to fit on screen.'}
    },
    required: ['action'],
    additionalProperties: false
} as const satisfies ObjectSchema;
type Input = Infer<typeof inputSchema>;

function getCamera(map: MapboxMap) {
    const {lng, lat} = map.getCenter();
    return {center: {lng, lat}, zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch()};
}

async function move(map: MapboxMap, mapboxgl: MapboxGLModule, {action, features, lngLats, ...options}: Input & {action: 'jumpTo' | 'easeTo' | 'flyTo'}) {
    // GL JS jumpTo sets the zoom before it reads the center, so a bad LngLat must throw before the call.
    for (const lngLat of [options.center, options.around]) if (lngLat) mapboxgl.LngLat.convert(lngLat);
    map[action](options as EasingOptions);
    const rendered = await idle(map);
    return {...getCamera(map), ...rendered};
}

async function fitBounds(map: MapboxMap, mapboxgl: MapboxGLModule, {action, features, lngLats, ...options}: Input) {
    const all: Position[] = [
        ...features.flatMap((ref) => featureByRef(map, ref).flatMap((f) => positions(f.geometry))),
        ...lngLats.map((l) => mapboxgl.LngLat.convert(l).toArray())
    ];
    if (all.length === 0) throw new Error('Give at least one feature or LngLat to fit.');
    const queried = [...new Set(features.map((ref) => queryType(target(map, ref.target))))];
    const box = all.reduce((b, [lng, lat]) => b.extend([lng, lat]), new mapboxgl.LngLatBounds());
    if (!map.cameraForBounds(box, options as EasingOptions)) throw new Error('The features do not fit on screen.');
    map.fitBounds(box, options as EasingOptions);
    const rendered = await idle(map);
    return {...getCamera(map), ...(queried.length && {query: queried.join(' and ')}), ...rendered};
}

export const camera: MapboxWebMCPTool<typeof inputSchema> = {
    description: 'Read or move the camera, with the options of GL JS. "get" returns center, zoom, bearing and pitch. "jumpTo" moves the camera at once, "easeTo" animates the move, and "flyTo" animates it along a flight that zooms out and in. Use "easeTo" or "flyTo" when the user follows the move, such as from one place to the next, and "jumpTo" when the move only prepares a query. A field left out keeps its current value. "fitBounds" moves the camera so the given features and LngLats fit on screen. It flies as "flyTo" does, eases with linear, and moves at once with animate false. It sets bearing and pitch to 0 unless given, so pass the bearing and pitch from "get" to keep them. It frames only the source features or the rendered features, as query says. Each move returns when the camera stops and the map finishes rendering.',
    inputSchema,
    execute(input, map, mapboxgl) {
        const actions = {
            get: () => getCamera(map),
            jumpTo: () => move(map, mapboxgl, {...input, action: 'jumpTo'}),
            easeTo: () => move(map, mapboxgl, {...input, action: 'easeTo'}),
            flyTo: () => move(map, mapboxgl, {...input, action: 'flyTo'}),
            fitBounds: () => fitBounds(map, mapboxgl, input)
        };
        return actions[input.action]();
    }
};
