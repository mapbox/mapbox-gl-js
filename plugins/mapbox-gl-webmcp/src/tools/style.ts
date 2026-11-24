import {applyEach, featuresets, idle, importStyle, isFeatureset, layers, ownId, OWN_PREFIX, pick, propertiesSchema, stateKeys, target, targetInputs, throwingGLErrors} from './utils';

import type {ExpressionSpecification, ImportSpecification, LightsSpecification, Map as MapboxMap} from 'mapbox-gl';
import type {MapboxWebMCPTool} from '../index';
import type {Infer, ObjectSchema} from '../schema';

const LEFT_OUT = ['layers', 'sources', 'color-theme', 'metadata'];

const inputSchema = {
    type: 'object',
    properties: {
        action: {type: 'string', enum: ['get', 'set', 'addImport', 'removeImport']},
        properties: {...propertiesSchema, description: `"get": select root level properties or derived fields. Request ${LEFT_OUT.join(', ')} explicitly. Missing fields return null.`},
        config: {type: 'object', description: '"set": configuration property values by import id, then property name. Use "" for the root style.'},
        projection: {type: 'string', description: 'Such as "globe".'},
        language: {type: 'string', description: 'Such as "fr".'},
        terrain: {
            type: ['object', 'null'],
            description: 'To enable terrain, supply the id of a raster-dem source. Use the source tool to find or add one, for example with url "mapbox://mapbox.mapbox-terrain-dem-v1". Omit source to adjust exaggeration on active terrain. Use null to turn off terrain.',
            properties: {source: {type: 'string'}, exaggeration: {type: ['number', 'array']}},
            additionalProperties: false
        },
        fog: {type: ['object', 'null']},
        lights: {type: ['array', 'null']},
        rain: {type: ['object', 'null']},
        snow: {type: ['object', 'null']},
        worldview: {type: ['string', 'null']},
        import: {type: 'object', description: 'A GL JS import specification for "addImport".'},
        importId: {type: 'string', description: '"get": read the imported style. Omit importId to read the root style. "removeImport": the id to remove.'},
        beforeId: {type: 'string', description: '"addImport": insert before this existing import id. With an unknown id, the call can add the import and still return an error.'}
    },
    required: ['action'],
    additionalProperties: false
} as const satisfies ObjectSchema;
type Input = Infer<typeof inputSchema>;
type Terrain = {source?: string; exaggeration?: number | ExpressionSpecification};

function configOf(map: MapboxMap, ids: string[]) {
    const config: Record<string, Record<string, unknown>> = {};
    const schema: Record<string, object> = {};
    for (const id of ids) {
        const options = map.getSchema(id) ?? {};
        if (!Object.keys(options).length) continue;
        const values = map.getConfig(id) ?? {};
        config[id] = Object.fromEntries(Object.keys(options).map((name) => [name, values[name]]));
        schema[id] = options;
    }
    return {config, schema};
}

function targets(map: MapboxMap, descriptors: ReturnType<typeof targetInputs>) {
    return descriptors.map((descriptor) => {
        const t = target(map, descriptor);
        const keys = stateKeys(map, t);
        return {target: t.target, ...(isFeatureset(t) ? {layers: layers(map, t).flatMap((l) => (l ? [l.id] : []))} : {type: t.type}), ...(keys.length && {featureStateKeys: keys})};
    });
}

function getStyle(map: MapboxMap, {properties, importId}: Pick<Input, 'properties' | 'importId'>) {
    const spec = importId ? importStyle(map, importId) : undefined;
    const style = (spec?.data ?? map.getStyle()) as Record<string, unknown> & {imports?: {id: string; url?: string}[]};
    const [language] = [map.getLanguage()].flat();
    const worldview = map.getWorldview();
    const wanted = (key: string) => !properties || properties.includes(key);
    const fromGetters = {terrain: map.getTerrain(), fog: map.getFog(), lights: map.getLights(), rain: map.getRain(), snow: map.getSnow()};
    const result = {
        ...style,
        ...((wanted('config') || wanted('schema')) && configOf(map, spec ? [spec.id] : ['', ...(style.imports ?? []).map(({id}) => id)])),
        ...(wanted('targets') && {targets: targets(map, spec ? featuresets(map).filter(({target: t}) => t.importId === spec.id).map(({target: t}) => t) : targetInputs(map))}),
        ...(style.imports && {imports: style.imports.map(({id, url}) => ({id, url}))}),
        ...(!spec && {...Object.fromEntries(Object.entries(fromGetters).filter(([, value]) => value != null)), projection: map.getProjection().name, ...(language !== undefined && {language}), ...(worldview != null && {worldview})})
    };
    return properties ? pick(result, properties) : Object.fromEntries(Object.entries(result).filter(([key]) => !LEFT_OUT.includes(key)));
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
    const read = Object.fromEntries(Array.from(new Set(config.map(([id]) => id)), (id) => [id, Object.fromEntries(config.filter(([of]) => of === id).map(([, name]) => [name, map.getConfigProperty(id, name) as unknown]))]));
    const readBack: Record<string, () => unknown> = {
        projection: () => map.getProjection().name,
        language: () => map.getLanguage(),
        terrain: () => map.getTerrain(),
        fog: () => map.getFog(),
        lights: () => map.getLights(),
        rain: () => map.getRain(),
        snow: () => map.getSnow(),
        worldview: () => map.getWorldview()
    };
    const given = Object.keys(input).filter((key) => key in readBack);
    return {...(config.length && {config: read}), ...Object.fromEntries(given.map((key) => [key, readBack[key]() ?? null])), ...rendered};
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
    title: 'Style',
    description: `Read or change the map style and its imports.
"get" can select fields with properties. For configuration, request ["config", "schema"] for values and allowed inputs by import id. For feature queries or feature state, request ["targets"] for layers, featuresets and the feature-state keys they read. For author metadata, request ["metadata", "featuresets"]. For an imported featureset, also pass its importId.
"set" applies each change separately. It returns the changed fields on success, or GL JS errors for failed changes.
"addImport" requires import.id. "removeImport" requires importId. Both require ids that start with "${OWN_PREFIX}" and return the imports.`,
    inputSchema,
    execute(input, map) {
        const actions = {
            get: () => getStyle(map, input),
            set: () => setStyle(map, input),
            addImport: () => addImport(map, input),
            removeImport: () => removeImport(map, input)
        };
        return actions[input.action]();
    }
};
