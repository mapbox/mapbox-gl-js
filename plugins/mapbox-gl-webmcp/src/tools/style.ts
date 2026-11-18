import {applyEach, idle, ownId, OWN_PREFIX, throwingGLErrors} from './utils';

import type {ExpressionSpecification, ImportSpecification, LightsSpecification, Map as MapboxMap} from 'mapbox-gl';
import type {MapboxWebMCPTool} from '../index';
import type {Infer, ObjectSchema} from '../schema';

const inputSchema = {
    type: 'object',
    properties: {
        action: {type: 'string', enum: ['get', 'set', 'addImport', 'removeImport']},
        config: {type: 'object', description: 'Configuration property values by import id and then by property name, as "get" returns them. The id "" is the root style. A configuration property left out stays as it is.'},
        projection: {type: 'string', description: 'A GL JS projection name, such as "globe".'},
        language: {type: 'string', description: 'A language code such as "fr". "get" leaves it out while labels show in the language the style picks.'},
        terrain: {
            type: ['object', 'null'],
            description: '3D terrain as GL JS setTerrain takes it, or null to turn it off. Without a source, terrain that is on keeps its raster-dem source. Terrain that is off needs a source. To add one, use the source tool, for example with a raster-dem source with the url "mapbox://mapbox.mapbox-terrain-dem-v1".',
            properties: {
                source: {type: 'string', description: 'A raster-dem source id, as "get" lists them in rasterDemSources.'},
                exaggeration: {type: ['number', 'array'], description: 'Relief height, 1 is natural, or a GL JS expression.'}
            },
            additionalProperties: false
        },
        fog: {type: ['object', 'null'], description: 'Fog as GL JS setFog takes it, or null to remove it.'},
        lights: {type: ['array', 'null'], description: 'Lights as GL JS setLights takes them, or null to remove the 3D lights.'},
        rain: {type: ['object', 'null'], description: 'Rain as GL JS setRain takes it, or null to remove it. Rain is experimental in GL JS.'},
        snow: {type: ['object', 'null'], description: 'Snow as GL JS setSnow takes it, or null to remove it. Snow is experimental in GL JS.'},
        worldview: {type: ['string', 'null'], description: 'A worldview as GL JS setWorldview takes it.'},
        import: {type: 'object', description: `An import as GL JS addImport takes it, such as {id, url}, with an id that starts with "${OWN_PREFIX}".`},
        importId: {type: 'string', description: `The id of an import to remove, one that starts with "${OWN_PREFIX}".`},
        beforeId: {type: 'string', description: 'The id of the import to put the new import before, as GL JS addImport takes it.'}
    },
    required: ['action'],
    additionalProperties: false
} as const satisfies ObjectSchema;
type Input = Infer<typeof inputSchema>;
type Terrain = {source?: string; exaggeration?: number | ExpressionSpecification};

function configIds(map: MapboxMap): string[] {
    return ['', ...(map.getStyle().imports ?? []).map(({id}) => id)].filter((id) => Object.keys(map.getSchema(id) ?? {}).length);
}

function rasterDemSources(map: MapboxMap): string[] {
    return Object.entries(map.getStyle().sources).filter(([, source]) => source.type === 'raster-dem').map(([id]) => id);
}

function getStyle(map: MapboxMap) {
    const ids = configIds(map);
    const [language] = [map.getLanguage()].flat();
    const [fog, rain, snow, worldview] = [map.getFog(), map.getRain(), map.getSnow(), map.getWorldview()];
    return {
        config: Object.fromEntries(ids.map((id) => [id, map.getConfig(id)])),
        schema: Object.fromEntries(ids.map((id) => [id, map.getSchema(id)])),
        projection: map.getProjection().name,
        ...(language !== undefined && {language}),
        terrain: map.getTerrain() ?? null,
        rasterDemSources: rasterDemSources(map),
        ...(fog && {fog}),
        lights: map.getLights(),
        ...(rain && {rain}),
        ...(snow && {snow}),
        ...(worldview != null && {worldview})
    };
}

async function setStyle(map: MapboxMap, input: Input) {
    const config = Object.entries(input.config ?? {}).flatMap(([id, values]) => {
        if (typeof values !== 'object' || values === null || Array.isArray(values)) throw new Error(`The config of "${id}" must be an object of configuration property names and values.`);
        return Object.entries(values as Record<string, unknown>).map(([name, value]) => [id, name, value] as const);
    });
    const next = input.terrain as Terrain | null | undefined;
    const {projection, fog, rain, snow, lights, language, worldview} = input;
    const changes: [string, () => unknown][] = config.map(([id, name, value]) => ['config', () => map.setConfigProperty(id, name, value)]);
    if (projection) changes.push(['projection', () => map.setProjection(projection)]);
    if (fog !== undefined) changes.push(['fog', () => map.setFog(fog)]);
    if (rain !== undefined) changes.push(['rain', () => map.setRain(rain)]);
    if (snow !== undefined) changes.push(['snow', () => map.setSnow(snow)]);
    if (lights !== undefined) changes.push(['lights', () => map.setLights(lights as LightsSpecification[] | null)]);
    const emptyTerrainWhileOn = next && Object.keys(next).length === 0 && map.getTerrain();
    if (next !== undefined && !emptyTerrainWhileOn) changes.push(['terrain', () => map.setTerrain(next)]);
    if (language) changes.push(['language', () => map.setLanguage(language)]);
    if (worldview !== undefined) changes.push(['worldview', () => map.setWorldview(worldview)]);
    applyEach(map, changes, 'The other fields changed. Read the style with "get" to see it.');
    const rendered = await idle(map);
    return {...getStyle(map), ...rendered};
}

function importIds(map: MapboxMap): string[] {
    return (map.getStyle().imports ?? []).map(({id}) => id);
}

function listImports(map: MapboxMap) {
    return {imports: (map.getStyle().imports ?? []).map(({id, url}) => ({id, url}))};
}

// GL JS loads an import after addImport returns, and its error event does not name the import.
async function addImport(map: MapboxMap, {import: spec, beforeId}: Input) {
    if (!spec) throw new Error('Give the import, as GL JS addImport takes it.');
    const id = ownId('import', (spec as {id?: string}).id);
    const had = importIds(map).includes(id);
    let refused: Error | undefined;
    try {
        throwingGLErrors(map, () => map.addImport(spec as ImportSpecification, beforeId));
    } catch (e) {
        // GL JS adds the import also when it reports that beforeId is not one of its imports.
        if (had || !importIds(map).includes(id) || !(e instanceof Error)) throw e;
        refused = e;
    }
    let reported: Error | undefined;
    let loaded = false;
    const onError = ({error}: {error: Error}) => { reported ??= error; };
    const onLoad = () => { loaded = true; };
    map.on('error', onError);
    map.on('style.import.load', onLoad);
    let rendered: {note?: string};
    try {
        rendered = await idle(map);
    } finally {
        map.off('error', onError);
        map.off('style.import.load', onLoad);
    }
    if (reported && !loaded) {
        map.removeImport(id);
        throw new Error(`${refused ? `${refused.message}\n` : ''}The import "${id}" did not load, so the tool removed it. GL JS reported this error during the wait: ${reported.message}`);
    }
    if (refused) {
        const ids = importIds(map);
        const next = ids[ids.indexOf(id) + 1];
        throw new Error(`${refused.message} GL JS added the import "${id}" anyway${next ? `, before the import "${next}"` : ''}.`);
    }
    return {...listImports(map), ...rendered};
}

async function removeImport(map: MapboxMap, {importId}: Input) {
    const id = ownId('import', importId);
    throwingGLErrors(map, () => map.removeImport(id));
    const rendered = await idle(map);
    return {...listImports(map), ...rendered};
}

export const style: MapboxWebMCPTool<typeof inputSchema> = {
    description: `The style of the map. "get" returns its configuration, projection, language, terrain, raster-dem sources, fog, lights, rain, snow and worldview, with the fields "set" takes, and leaves out what the map does not have. It also returns the schema of the root style and of each import: its configuration properties with their type, default and allowed values. "set" changes them. A field left out stays as it is. When GL JS refuses a field, "set" still changes the other fields and returns the GL JS error of each refused field. "addImport" adds an import, before the import beforeId when given, and "removeImport" removes one. When GL JS reports an error and the new import has not loaded at the end of the wait, "addImport" removes the import and returns the GL JS error. Both return the imports of the style with their ids and URLs, and "get" returns the configuration properties of a new import that has a schema. The tool adds and removes only imports with an id that starts with "${OWN_PREFIX}", so give each new import such an id.`,
    inputSchema,
    execute(input, map) {
        const actions = {
            get: () => getStyle(map),
            set: () => setStyle(map, input),
            addImport: () => addImport(map, input),
            removeImport: () => removeImport(map, input)
        };
        return actions[input.action]();
    }
};
