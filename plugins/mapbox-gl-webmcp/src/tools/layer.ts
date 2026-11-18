import {featuresets, features, filterSchema, idle, isFeatureset, ownId, OWN_PREFIX, queryType, stateKeys, target, throwingGLErrors, watched} from './utils';

import type {FilterSpecification, LayerSpecification, Map as MapboxMap} from 'mapbox-gl';
import type {MapboxWebMCPTool} from '../index';
import type {Infer, ObjectSchema} from '../schema';
import type {Found, Target} from './utils';

const inputSchema = {
    type: 'object',
    properties: {
        action: {type: 'string', enum: ['listTargets', 'setFilter', 'addLayer', 'removeLayer']},
        layerId: {type: 'string', description: 'A layer id, as listTargets returns it in target.layerId.'},
        filter: filterSchema,
        layer: {type: 'object', description: `A layer as GL JS addLayer takes it, with an id that starts with "${OWN_PREFIX}". The source can be any source that the source tool lists.`},
        beforeId: {type: 'string', description: 'The id of the layer to put the new layer under, as GL JS addLayer takes it.'}
    },
    required: ['action'],
    additionalProperties: false
} as const satisfies ObjectSchema;
type Input = Infer<typeof inputSchema>;
const TOOL_FILTER = ['to-boolean', 'mapbox-webmcp-filter'];

function isToolFilter(filter: FilterSpecification | null | undefined): boolean {
    return Array.isArray(filter) && filter[0] === 'all' && JSON.stringify(filter[1]) === JSON.stringify(TOOL_FILTER);
}

function listTargets(map: MapboxMap) {
    const descriptors = [...map.getStyle().layers.map((l) => ({layerId: l.id})), ...featuresets(map).map((f) => f.target)];
    return descriptors.map((descriptor) => {
        let t: Target;
        let found: Found[];
        try {
            t = target(map, descriptor);
            found = features(map, t);
        } catch (e) {
            return {target: descriptor, error: e instanceof Error ? e.message : String(e)};
        }
        return {
            target: t.target,
            type: t.type,
            featureCount: found.length,
            query: queryType(t),
            properties: [...new Set(found.flatMap((f) => Object.keys(f.properties)))],
            ...(!isFeatureset(t) && {filtered: isToolFilter(map.getFilter(t.target.layerId))}),
            featureStateKeys: stateKeys(map, t)
        };
    });
}

async function setFilter(map: MapboxMap, {layerId, filter}: Input) {
    if (layerId === undefined) throw new Error('Give a layerId. List the targets to see them.');
    const t = target(map, {layerId});
    const current = map.getFilter(layerId);
    const app = (isToolFilter(current) ? (current as unknown[])[3] as FilterSpecification | undefined : current) ?? null;
    const next = filter === undefined ? app : ['all', TOOL_FILTER, filter, ...(app !== null ? [app] : [])] as FilterSpecification;
    throwingGLErrors(map, () => map.setFilter(layerId, next));
    const rendered = await idle(map);
    let count: {matched: number} | {error: string};
    try {
        count = {matched: features(map, t).length};
    } catch (e) {
        count = {error: e instanceof Error ? e.message : String(e)};
    }
    return {layerId, ...count, query: queryType(t), ...rendered};
}

async function addLayer(map: MapboxMap, {layer: spec, beforeId}: Input) {
    if (!spec) throw new Error('Give the layer, as GL JS addLayer takes it.');
    const id = ownId('layer', (spec as {id?: string}).id);
    const hadLayer = Boolean(map.getLayer(id));
    const hadSource = Boolean(map.getSource(id));
    try {
        // GL JS adds an inline source under the layer id before it checks the layer, and loads it after addLayer returns.
        const {failed, rendered} = await watched(map, id, () => map.addLayer(spec as LayerSpecification, beforeId));
        if (failed) throw failed;
        return {layer: map.getStyle().layers.find((l) => l.id === id), ...rendered};
    } catch (e) {
        if (!hadLayer && map.getLayer(id)) map.removeLayer(id);
        if (!hadSource && map.getSource(id)) map.removeSource(id);
        throw e;
    }
}

async function removeLayer(map: MapboxMap, {layerId}: Input) {
    const id = ownId('layer', layerId);
    throwingGLErrors(map, () => map.removeLayer(id));
    const rendered = await idle(map);
    return {layers: map.getStyle().layers.filter((l) => l.id.startsWith(OWN_PREFIX)).map(({id: left, type}) => ({id: left, type})), ...rendered};
}

export const layer: MapboxWebMCPTool<typeof inputSchema> = {
    description: `The targets of the map, which the feature and camera tools take: the layers of the root style, and featuresets of the style and its imports. A layer whose source holds no features, such as a raster layer, has a feature count of 0. "listTargets" returns each target with its type, feature count, property names, whether "setFilter" is on for a layer, and under featureStateKeys the feature-state keys that its style reads. "setFilter" shows only the layer's features that match filter, on top of the app's own filter. Without filter it shows the features of the app's filter again. It returns how many features the layer shows after the change. When GL JS can't count them off screen, such as for a filter on ["pitch"], it returns the GL JS error in place of the count, and the filter stays on. "addLayer" adds a layer as GL JS addLayer takes it, under the layer beforeId when given, and returns the layer as the style holds it. "removeLayer" removes a layer and returns the layers that the tool added and that are left. The tool adds and removes only layers with an id that starts with "${OWN_PREFIX}", so give each new layer such an id. To change such a layer, remove it and add it again with the same beforeId. A target with features that the tool can't read comes back with the error. Counts and property names cover the source features in the loaded tiles that match the layer's filter, also off screen, and for featuresets the rendered features, as query says. GL JS can split or duplicate a feature across tile boundaries, and each copy counts as a feature.`,
    inputSchema,
    execute(input, map) {
        const actions = {
            listTargets: () => listTargets(map),
            setFilter: () => setFilter(map, input),
            addLayer: () => addLayer(map, input),
            removeLayer: () => removeLayer(map, input)
        };
        return actions[input.action]();
    }
};
