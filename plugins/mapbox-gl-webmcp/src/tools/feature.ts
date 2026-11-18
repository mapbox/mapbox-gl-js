import {all, applyEach, byId, featureByRef, featureIdSchema, featureRefSchema, features, featuresAt, filterSchema, idle, isFeatureset, lngLatSchema, queryType, stateKeys, target, targetName, targetSchema} from './utils';

import type {FilterSpecification, Map as MapboxMap} from 'mapbox-gl';
import type {MapboxWebMCPTool} from '../index';
import type {Selector, Target} from './utils';
import type {Infer, ObjectSchema} from '../schema';

const inputSchema = {
    type: 'object',
    properties: {
        action: {type: 'string', enum: ['query', 'setFeatureState', 'removeFeatureState']},
        target: targetSchema,
        at: {...lngLatSchema, description: 'Keep only the rendered features at this LngLat on the screen, as GL JS queryRenderedFeatures returns them.'},
        filter: filterSchema,
        distance: {
            type: 'object',
            properties: {lng: {type: 'number'}, lat: {type: 'number'}, meters: {type: 'number'}},
            required: ['lng', 'lat', 'meters'],
            additionalProperties: false,
            description: 'Keep features that come within this many meters of this LngLat.'
        },
        within: {...featureRefSchema, description: 'Keep features within this polygon or multipolygon feature. GL JS splits the polygon across tile boundaries, so a line or polygon that crosses from one tile into the next is left out, even when it lies within the polygon.'},
        sort: {
            type: 'object',
            properties: {property: {type: 'string', description: 'A feature property name.'}, order: {type: 'string', enum: ['asc', 'desc']}},
            required: ['property', 'order'],
            additionalProperties: false,
            description: 'Sort by this property.'
        },
        limit: {type: 'integer', minimum: 1, description: 'At most this many features.'},
        ids: {type: 'array', items: featureIdSchema, default: [], description: 'Feature ids, as a feature query returns them.'},
        state: {type: 'object', description: 'Feature-state keys and values to set, such as {KEY: true}. The keys must be ones that listTargets gives in featureStateKeys.'},
        key: {type: 'string', description: 'The feature-state key to remove, one that listTargets gives in featureStateKeys. Without key, "removeFeatureState" removes every key that listTargets gives in featureStateKeys.'}
    },
    required: ['action'],
    additionalProperties: false
} as const satisfies ObjectSchema;
type Input = Infer<typeof inputSchema>;

function withinFilter(map: MapboxMap, ref: Infer<typeof featureRefSchema>): FilterSpecification {
    const area = featureByRef(map, ref).map((f) => f.geometry);
    const coordinates = area.flatMap((g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []));
    if (!coordinates.length) throw new Error(`"within" needs a polygon feature, and feature ${JSON.stringify(ref.id)} of ${targetName(target(map, ref.target))} is a ${area[0].type}.`);
    return ['within', {type: 'MultiPolygon', coordinates}];
}

function sortValue(v: unknown) {
    return typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' ? v : undefined;
}

function query(map: MapboxMap, {target: targetInput, at, filter: base, distance, within, sort, limit}: Input) {
    const t = target(map, targetInput);
    const filter = all(
        base as FilterSpecification | undefined,
        distance && ['<=', ['distance', {type: 'Point', coordinates: [distance.lng, distance.lat]}], distance.meters],
        within && withinFilter(map, within)
    );
    const found = at ? featuresAt(map, t, at, filter) : features(map, t, filter);
    const described = found.map(({id, properties, geometry, selector}) => {
        const state = selector && map.getFeatureState(selector);
        return {
            target: t.target,
            ...(id !== undefined && {id}),
            geometry: geometry.type,
            ...(geometry.type === 'Point' && {lng: geometry.coordinates[0], lat: geometry.coordinates[1]}),
            properties,
            ...(state && Object.keys(state).length && {state})
        };
    });
    if (sort) {
        const sign = sort.order === 'desc' ? -1 : 1;
        described.sort((a, b) => {
            const [x, y] = [sortValue(a.properties[sort.property]), sortValue(b.properties[sort.property])];
            if (x === undefined || y === undefined) return Number(x === undefined) - Number(y === undefined);
            if (typeof x !== typeof y) return typeof x < typeof y ? -1 : 1;
            return sign * (typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y) : Number(x) - Number(y));
        });
    }
    return {
        total: described.length,
        query: at ? 'rendered' : queryType(t),
        features: described.slice(0, limit)
    };
}

function checkRead(map: MapboxMap, t: Target, keys: string[]) {
    const read = stateKeys(map, t);
    const unread = keys.filter((key) => !read.includes(key));
    const quote = (list: string[]) => list.map((key) => `"${key}"`).join(', ');
    if (unread.length) throw new Error(`The feature state ${quote(unread)} isn't read by ${targetName(t)}, so it wouldn't show. ${read.length ? `It reads ${quote(read)}.` : 'It reads no feature state.'}`);
}

async function changeEach(map: MapboxMap, t: Target, ids: Input['ids'], change: (selector: Selector) => void) {
    if (!ids.length) throw new Error('Give the ids of the features to change.');
    const found = isFeatureset(t) ? features(map, t) : [];
    const changed: {id: Input['ids'][number]; selector: Selector}[] = [];
    applyEach(map, ids.map((id) => [`id ${JSON.stringify(id)}`, () => {
        const selector = isFeatureset(t) ? byId(found, t, id)[0].selector! : {source: t.source, sourceLayer: t.sourceLayer, id};
        change(selector);
        changed.push({id, selector});
    }]), 'The other ids changed. Query the features to see their feature state.');
    const rendered = await idle(map);
    return {target: t.target, features: changed.map(({id, selector}) => ({id, state: map.getFeatureState(selector)})), ...rendered};
}

function setFeatureState(map: MapboxMap, {target: targetInput, ids, state}: Input) {
    const t = target(map, targetInput);
    const keys = Object.keys(state ?? {});
    if (!keys.length) throw new Error('Give state, an object of feature-state keys and values. listTargets says which keys the target reads.');
    checkRead(map, t, keys);
    return changeEach(map, t, ids, (selector) => map.setFeatureState(selector, state as Record<string, unknown>));
}

function removeFeatureState(map: MapboxMap, {target: targetInput, ids, key}: Input) {
    const t = target(map, targetInput);
    if (key !== undefined) checkRead(map, t, [key]);
    const keys = key !== undefined ? [key] : stateKeys(map, t);
    return changeEach(map, t, ids, (selector) => { for (const k of keys) map.removeFeatureState(selector, k); });
}

export const feature: MapboxWebMCPTool<typeof inputSchema> = {
    description: 'The features of a target, as GL JS returns them. For a layer: the source features that match the layer\'s filter, also off screen. For a featureset: only the rendered features, so a feature the map does not show now can\'t be queried or set, and of labels only those that GL JS placed, not those it hides where they overlap. The query field says which. With at, "query" reads only the rendered features at that LngLat, also for a layer. "query" returns each feature with its id, geometry type, the lng and lat of a Point geometry, its properties, and its feature state when it has one, also one the app set. It can keep only features that match a filter expression, lie within a distance of a LngLat, or lie within a polygon feature. GL JS can split or duplicate a feature across tile boundaries, so a feature can come back several times, and total counts each copy. An id names all copies and all features with it. A feature without an id can\'t be named in setFeatureState, within or a camera fitBounds. "setFeatureState" sets the given feature-state keys and values on only the given ids, and returns the feature state GL JS reports. It takes only the keys that listTargets gives in featureStateKeys. For a layer, GL JS takes any id of the layer\'s source, also one that no source feature has. "removeFeatureState" removes the given key, or without key every key that the target reads, from only the given ids, also feature state that the app set, and returns the feature state GL JS reports. Both actions change each id on its own, so when an id fails, the other ids still change and the error names each failed id. Feature state belongs to a feature id, so a feature that the map shows later, such as after a camera move, has none until you set it. After GL JS places labels again, a label from an earlier query can be gone, so query again. Setting id 1 also sets "1" of the same source and source layer, because GL JS gives them one feature state.',
    inputSchema,
    execute(input, map) {
        const actions = {
            query: () => query(map, input),
            setFeatureState: () => setFeatureState(map, input),
            removeFeatureState: () => removeFeatureState(map, input)
        };
        return actions[input.action]();
    }
};
