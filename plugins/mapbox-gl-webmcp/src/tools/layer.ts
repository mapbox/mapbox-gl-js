import {applyEach, features, filterSchema, idle, importStyle, isToolFilter, ownId, OWN_PREFIX, pick, propertiesSchema, target, throwingGLErrors, TOOL_FILTER, watched} from './utils';

import type {FilterSpecification, LayerSpecification, Map as MapboxMap} from 'mapbox-gl';
import type {MapboxWebMCPTool} from '../index';
import type {Infer, ObjectSchema} from '../schema';

const inputSchema = {
    type: 'object',
    properties: {
        action: {type: 'string', enum: ['list', 'get', 'set', 'addLayer', 'removeLayer']},
        layerId: {type: 'string'},
        importId: {type: 'string'},
        properties: {...propertiesSchema, description: '"list" and "get": select layer fields such as ["id", "paint"]. Missing fields return null. "list" defaults to id, type, source and source-layer. "get" defaults to the whole layer.'},
        filter: {...filterSchema, type: ['array', 'null'], description: `${filterSchema.description} "set" combines this filter with the style's filter. Use null to remove the tool's filter. For a root style layer, matched counts source features that pass the resulting filter, or error explains why GL JS could not count them.`},
        layout: {type: 'object'},
        paint: {type: 'object'},
        layer: {type: 'object', description: 'A GL JS layer specification for "addLayer".'},
        beforeId: {type: 'string', description: '"addLayer": insert before this existing layer id in the same slot.'}
    },
    required: ['action'],
    additionalProperties: false
} as const satisfies ObjectSchema;
type Input = Infer<typeof inputSchema>;
type Group = 'filter' | 'layout' | 'paint';
type Layer = {id: string; filter?: FilterSpecification} & Partial<Record<'layout' | 'paint', Record<string, unknown>>>;

function styleIn(map: MapboxMap, importId: string | undefined) {
    const spec = importId ? importStyle(map, importId) : undefined;
    return {spec, layers: (spec?.data ?? map.getStyle()).layers};
}

function layerIn(map: MapboxMap, layerId: string | undefined, importId: string | undefined) {
    if (layerId === undefined) throw new Error('Give a layerId. List the layers to see them.');
    const {spec, layers} = styleIn(map, importId);
    const layer = layers.find(({id}) => id === layerId) as Layer | undefined;
    if (!layer) throw new Error(`No layer "${layerId}" ${importId ? `in import "${importId}"` : 'in the root style'}. List the layers to see them.`);
    return {spec, layer};
}

function setPart(map: MapboxMap, {layerId, importId}: Input, group: Group, name: string, value: unknown) {
    const {spec, layer} = layerIn(map, layerId, importId);
    const id = layer.id;
    if (group === 'filter') {
        const app = (isToolFilter(layer.filter) ? (layer.filter as unknown[])[3] as FilterSpecification | undefined : layer.filter) ?? null;
        value = value === null ? app : ['all', TOOL_FILTER, value, ...(app !== null ? [app] : [])];
    }
    if (!spec) {
        if (group === 'filter') map.setFilter(id, value as FilterSpecification | null);
        else if (group === 'layout') map.setLayoutProperty(id, name as never, value as never);
        else map.setPaintProperty(id, name as never, value as never);
        return;
    }
    const next = structuredClone(spec);
    const copy = next.data!.layers.find((l) => l.id === id) as Layer;
    const values = group === 'filter' ? copy as Record<string, unknown> : (copy[group] ??= {});
    if (value === null) delete values[name];
    else values[name] = value;
    map.updateImport(next.id, next);
}

async function setLayer(map: MapboxMap, input: Input) {
    const {layerId, importId, filter} = input;
    const [layout, paint] = [input.layout, input.paint] as (Record<string, unknown> | undefined)[];
    const parts = [
        ...(filter !== undefined ? [['filter', 'filter', filter]] : []),
        ...Object.entries(layout ?? {}).map(([name, value]) => ['layout', name, value]),
        ...Object.entries(paint ?? {}).map(([name, value]) => ['paint', name, value])
    ] as [Group, string, unknown][];
    if (!parts.length) throw new Error('Give filter, layout or paint.');
    applyEach(map, parts.map(([group, name, value]) => [name, () => setPart(map, input, group, name, value)]), 'The other parts changed. Get the layer to see it.');
    const rendered = await idle(map);
    const {layer} = layerIn(map, layerId, importId);
    const read = (group: 'layout' | 'paint', given?: object) => given && {[group]: Object.fromEntries(Object.keys(given).map((name) => [name, layer[group]?.[name] ?? null]))};
    let count = {};
    if (filter !== undefined && !importId) {
        try {
            count = {matched: features(map, target(map, {layerId})).length};
        } catch (e) {
            count = {error: e instanceof Error ? e.message : String(e)};
        }
    }
    return {
        layerId,
        ...(filter !== undefined && {filter: isToolFilter(layer.filter) ? (layer.filter as unknown[])[2] : null}),
        ...read('layout', layout),
        ...read('paint', paint),
        ...count,
        ...rendered
    };
}

function getLayer(map: MapboxMap, {layerId, importId, properties}: Input) {
    return pick(layerIn(map, layerId, importId).layer, properties);
}

function listLayers(map: MapboxMap, {importId, properties}: Input) {
    return styleIn(map, importId).layers.map((l) => pick(l, properties ?? ['id', 'type', 'source', 'source-layer']));
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
    title: 'Layers',
    description: `Read or edit style layers.
"list", "get" and "set" work on the root style by default. Pass importId for an imported style.
"get" and "set" require layerId.
"set" changes filter, layout or paint and reads back the changes. For layout and paint, map property names to values. Use null to reset a property.
"addLayer" requires layer.id. "removeLayer" requires layerId. Both work on the root style and require ids that start with "${OWN_PREFIX}".`,
    inputSchema,
    execute(input, map) {
        if (input.importId && (input.action === 'addLayer' || input.action === 'removeLayer')) throw new Error('You can add and remove layers only in the root style. Leave out importId.');
        const actions = {
            list: () => listLayers(map, input),
            get: () => getLayer(map, input),
            set: () => setLayer(map, input),
            addLayer: () => addLayer(map, input),
            removeLayer: () => removeLayer(map, input)
        };
        return actions[input.action]();
    }
};
