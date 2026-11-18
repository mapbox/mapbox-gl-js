import {ownId, OWN_PREFIX, throwingGLErrors, watched} from './utils';

import type {GeoJSON} from 'geojson';
import type {Map as MapboxMap, SourceSpecification} from 'mapbox-gl';
import type {MapboxWebMCPTool} from '../index';
import type {Infer, ObjectSchema} from '../schema';

const inputSchema = {
    type: 'object',
    properties: {
        action: {type: 'string', enum: ['list', 'add', 'remove', 'setData']},
        id: {type: 'string', description: `A source id. "add", "remove" and "setData" take only an id that starts with "${OWN_PREFIX}".`},
        source: {type: 'object', description: 'A source as GL JS addSource takes it, such as {type: "geojson", data}.'},
        data: {type: ['object', 'string'], description: 'GeoJSON, or the URL of GeoJSON, as GL JS GeoJSONSource setData takes it.'}
    },
    required: ['action'],
    additionalProperties: false
} as const satisfies ObjectSchema;
type Input = Infer<typeof inputSchema>;

function listSources(map: MapboxMap) {
    return Object.entries(map.getStyle().sources).map(([id, {type}]) => ({id, type}));
}

async function addSource(map: MapboxMap, {id, source}: Input) {
    const own = ownId('source', id);
    if (!source) throw new Error('Give the source, as GL JS addSource takes it.');
    const {failed, rendered} = await watched(map, own, () => map.addSource(own, source as SourceSpecification));
    if (failed) {
        map.removeSource(own);
        throw failed;
    }
    return {id: own, source: map.getStyle().sources[own], ...rendered};
}

function removeSource(map: MapboxMap, {id}: Input) {
    const own = ownId('source', id);
    throwingGLErrors(map, () => map.removeSource(own));
    return listSources(map).filter((s) => s.id.startsWith(OWN_PREFIX));
}

async function setData(map: MapboxMap, {id, data}: Input) {
    const own = ownId('source', id);
    if (data === undefined) throw new Error('Give data, as GL JS GeoJSONSource setData takes it.');
    const source = map.getSource(own);
    if (source?.type !== 'geojson') throw new Error(`No GeoJSON source "${own}". List the sources to see them.`);
    const {failed, rendered} = await watched(map, own, () => source.setData(data as GeoJSON | string));
    if (failed) throw failed;
    return {id: own, source: map.getStyle().sources[own], ...rendered};
}

export const source: MapboxWebMCPTool<typeof inputSchema> = {
    description: `The sources of the root style. "list" returns each source with its id and type, also the app's sources, which a layer that the layer tool adds can use. "add" adds a source as GL JS addSource takes it. "remove" removes a source and returns the sources that the tool added and that are left. GL JS refuses to remove a source that a layer or terrain uses. "setData" replaces the data of a GeoJSON source. When GL JS fails to load the new data, "setData" returns the GL JS error and does not put the data from before back, because GL JS has no undo. "add" and "setData" return the source as the style holds it. The tool adds, changes and removes only sources with an id that starts with "${OWN_PREFIX}", so give each new source such an id.`,
    inputSchema,
    execute(input, map) {
        const actions = {
            list: () => listSources(map),
            add: () => addSource(map, input),
            remove: () => removeSource(map, input),
            setData: () => setData(map, input)
        };
        return actions[input.action]();
    }
};
