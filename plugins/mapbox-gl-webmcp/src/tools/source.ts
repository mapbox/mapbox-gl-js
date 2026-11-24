import {ownId, OWN_PREFIX, pick, propertiesSchema, throwingGLErrors, watched} from './utils';

import type {GeoJSON} from 'geojson';
import type {Map as MapboxMap, SourceSpecification} from 'mapbox-gl';
import type {MapboxWebMCPTool} from '../index';
import type {Infer, ObjectSchema} from '../schema';

const inputSchema = {
    type: 'object',
    properties: {
        action: {type: 'string', enum: ['list', 'get', 'addSource', 'removeSource', 'setData']},
        id: {type: 'string'},
        source: {type: 'object', description: 'A GL JS source specification for "addSource".'},
        data: {type: ['object', 'string'], description: 'GeoJSON or its URL.'},
        properties: {...propertiesSchema, description: 'Select source fields for "list", "get", "addSource" or "setData". "list" defaults to id and type. "get" defaults to the whole source with id. "addSource" and "setData" return id separately and default to the whole source specification. Missing fields return null.'}
    },
    required: ['action'],
    additionalProperties: false
} as const satisfies ObjectSchema;
type Input = Infer<typeof inputSchema>;

function listSources(map: MapboxMap) {
    return Object.entries(map.getStyle().sources).map(([id, spec]) => ({...spec, id}));
}

function getSource(map: MapboxMap, {id, properties}: Input) {
    if (id === undefined) throw new Error('Give an id. List the sources to see them.');
    const spec = map.getStyle().sources[id];
    if (!spec) throw new Error(`No source "${id}" in the root style. List the sources to see them.`);
    return pick({...spec, id}, properties);
}

async function addSource(map: MapboxMap, {id, source, properties}: Input) {
    const own = ownId('source', id);
    if (!source) throw new Error('Give the source, as GL JS addSource takes it.');
    const {failed, rendered} = await watched(map, own, () => map.addSource(own, source as SourceSpecification));
    if (failed) {
        map.removeSource(own);
        throw failed;
    }
    return {id: own, source: pick(map.getStyle().sources[own], properties), ...rendered};
}

function removeSource(map: MapboxMap, {id}: Input) {
    const own = ownId('source', id);
    throwingGLErrors(map, () => map.removeSource(own));
    return listSources(map).filter((s) => s.id.startsWith(OWN_PREFIX)).map(({id: left, type}) => ({id: left, type}));
}

async function setData(map: MapboxMap, {id, data, properties}: Input) {
    const own = ownId('source', id);
    if (data === undefined) throw new Error('Give data, as GL JS GeoJSONSource setData takes it.');
    const source = map.getSource(own);
    if (source?.type !== 'geojson') throw new Error(`No GeoJSON source "${own}". List the sources to see them.`);
    const {failed, rendered} = await watched(map, own, () => source.setData(data as GeoJSON | string));
    if (failed) throw failed;
    return {id: own, source: pick(map.getStyle().sources[own], properties), ...rendered};
}

export const source: MapboxWebMCPTool<typeof inputSchema> = {
    title: 'Sources',
    description: `Read or edit root style sources. "list" discovers source ids for layers or terrain, and "get" reads a source by id. "addSource", "setData" and "removeSource" require an id that starts with "${OWN_PREFIX}". "setData" replaces a GeoJSON source's data.`,
    inputSchema,
    execute(input, map) {
        const actions = {
            list: () => listSources(map).map((s) => pick(s, input.properties ?? ['id', 'type'])),
            get: () => getSource(map, input),
            addSource: () => addSource(map, input),
            removeSource: () => removeSource(map, input),
            setData: () => setData(map, input)
        };
        return actions[input.action]();
    }
};
