import {all, applyEach, byId, featureByRef, featureIdSchema, featureRefSchema, features, featuresAt, filterSchema, hidingConfig, idle, isFeatureset, limitSchema, lngLatSchema, pick, propertiesSchema, queryType, stateKeys, target, targetInputs, targetName, targetSchema} from './utils';

import type {FilterSpecification, Map as MapboxMap} from 'mapbox-gl';
import type {MapboxWebMCPTool} from '../index';
import type {Found, Selector, Target} from './utils';
import type {Infer, ObjectSchema} from '../schema';

const inputSchema = {
    type: 'object',
    properties: {
        action: {type: 'string', enum: ['list', 'query', 'setFeatureState', 'removeFeatureState']},
        target: targetSchema,
        lngLat: {...lngLatSchema, description: '"query": find rendered features at this LngLat, also for a layer target.'},
        filter: filterSchema,
        distance: {
            type: 'object',
            properties: {lngLat: lngLatSchema, meters: {type: 'number'}},
            required: ['lngLat', 'meters'],
            additionalProperties: false,
            description: 'Only features within meters of this LngLat.'
        },
        within: {...featureRefSchema, description: 'Only features within this polygon feature.'},
        sort: {
            type: 'object',
            properties: {property: {type: 'string'}, order: {type: 'string', enum: ['asc', 'desc']}},
            required: ['property', 'order'],
            additionalProperties: false,
            description: '"query": sort matches by a feature property before applying limit.'
        },
        limit: {...limitSchema, description: '"query": maximum number of features to return. total counts all matches before limit.'},
        properties: {...propertiesSchema, description: '"list": select target and featureProperties. "query": select from id, geometry, properties and state. The default omits geometry. Missing keys return null. For a feature without a GL JS id, id and state are null.'},
        featureProperties: {...propertiesSchema, description: '"query": select names inside each feature\'s properties. Missing names return null.'},
        ids: {type: 'array', items: featureIdSchema, default: []},
        state: {type: 'object', description: '"setFeatureState": assign values to keys in featureStateKeys.'},
        key: {type: 'string', description: '"removeFeatureState": remove this key. Omit key to remove all keys the target reads.'}
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

function listTargets(map: MapboxMap, {properties: keys}: Input) {
    return targetInputs(map).map((descriptor) => {
        let t: Target;
        let found: Found[];
        try {
            t = target(map, descriptor);
            found = features(map, t);
        } catch (e) {
            return {target: descriptor, error: e instanceof Error ? e.message : String(e)};
        }
        return pick({target: t.target, featureProperties: [...new Set(found.flatMap((f) => Object.keys(f.properties)))]}, keys);
    });
}

function query(map: MapboxMap, {target: targetInput, lngLat, filter: base, distance, within, sort, limit, properties: keys, featureProperties}: Input) {
    const t = target(map, targetInput);
    const filter = all(
        base as FilterSpecification | undefined,
        distance && ['<=', ['distance', {type: 'Point', coordinates: [distance.lngLat.lng, distance.lngLat.lat]}], distance.meters],
        within && withinFilter(map, within)
    );
    const found = lngLat ? featuresAt(map, t, lngLat, filter) : features(map, t, filter);
    const described = found.map(({id, properties, geometry, selector}) => ({
        id,
        geometry,
        properties,
        state: selector ? map.getFeatureState(selector) ?? {} : null
    }));
    if (sort) {
        const sign = sort.order === 'desc' ? -1 : 1;
        described.sort((a, b) => {
            const [x, y] = [sortValue(a.properties[sort.property]), sortValue(b.properties[sort.property])];
            if (x === undefined || y === undefined) return Number(x === undefined) - Number(y === undefined);
            if (typeof x !== typeof y) return typeof x < typeof y ? -1 : 1;
            return sign * (typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y) : Number(x) - Number(y));
        });
    }
    const config = described.length ? {} : hidingConfig(map, t);
    return {
        total: described.length,
        query: lngLat ? 'rendered' : queryType(t),
        features: described.slice(0, limit).map((feature) => pick(featureProperties ? {...feature, properties: pick(feature.properties, featureProperties)} : feature, keys ?? ['id', 'properties', 'state'])),
        ...(Object.keys(config).length && {config})
    };
}

function checkRead(map: MapboxMap, t: Target, keys: string[]) {
    const read = stateKeys(map, t);
    const unread = keys.filter((key) => !read.includes(key));
    const quote = (list: string[]) => list.map((key) => `"${key}"`).join(', ');
    if (unread.length) throw new Error(`The feature state ${quote(unread)} isn't read by ${targetName(t)}, so it wouldn't show. ${read.length ? `It reads ${quote(read)}.` : 'It reads no feature state.'}`);
}

async function changeEach(map: MapboxMap, t: Target, ids: Input['ids'], change: (selector: Selector) => void) {
    if (!ids.length) throw new Error('Give the ids of the features to change. Query the target to see them.');
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
    if (!keys.length) throw new Error('Give state, an object of feature-state keys and values. The style read says which keys the target reads.');
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
    title: 'Features',
    description: `Query features or change feature state.
"list" finds root style layers and featuresets from the root style and its imports. Each item has target and featureProperties, the property names of available features, or target and error if GL JS cannot query it.
"query", "setFeatureState" and "removeFeatureState" require target.
"query" reads source features in loaded tiles for a layer by default, or rendered features for a featureset. Move the camera to the area of interest. Set featureProperties and limit to narrow the result. GL JS can return a feature once per tile. If no features match, config may identify configuration properties that the target's filters or visibility read.
"setFeatureState" and "removeFeatureState" require ids and return their feature state. Find ids with "query". For keys the target reads, call style "get" with properties ["targets"] and read featureStateKeys.`,
    inputSchema,
    execute(input, map) {
        const actions = {
            list: () => listTargets(map, input),
            query: () => query(map, input),
            setFeatureState: () => setFeatureState(map, input),
            removeFeatureState: () => removeFeatureState(map, input)
        };
        return actions[input.action]();
    }
};
