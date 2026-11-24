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
        bearing: {type: 'number'},
        pitch: {type: 'number'},
        around: lngLatSchema,
        padding: {
            type: ['number', 'object'],
            properties: {top: {type: 'number'}, bottom: {type: 'number'}, left: {type: 'number'}, right: {type: 'number'}},
            additionalProperties: false,
            description: 'Padding in pixels. A number applies to all four sides.'
        },
        retainPadding: {type: 'boolean', description: 'Set false to keep padding from carrying over to later moves.'},
        minZoom: {type: 'number', description: '"flyTo": requested zoom at the peak of the flight. This overrides curve.'},
        maxZoom: {type: 'number', description: '"fitBounds": highest zoom allowed when fitting the bounds.'},
        animate: {type: 'boolean'},
        duration: {type: 'number', description: 'Animation duration in milliseconds.'},
        essential: {type: 'boolean', description: 'Set true only when the user asks to see the motion. This animates even when the user prefers reduced motion.'},
        curve: {type: 'number'},
        speed: {type: 'number'},
        screenSpeed: {type: 'number'},
        maxDuration: {type: 'number'},
        linear: {type: 'boolean'},
        offset: {type: 'array', items: {type: 'number'}},
        preloadOnly: {type: 'boolean', description: 'Use true with "jumpTo" to preload tiles at the destination without moving the camera.'},
        features: {type: 'array', items: featureRefSchema, default: []},
        lngLats: {type: 'array', items: lngLatSchema, default: []}
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
    title: 'Camera',
    description: 'Read or move the camera. "get" returns center, zoom, bearing and pitch. Use "jumpTo" for an instant move before a query, "easeTo" to animate a camera change, or "flyTo" for a flight. "fitBounds" fits at least one feature or LngLat in the viewport. Pass both current values to preserve bearing and pitch. Moves return the camera after waiting for rendering.',
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
