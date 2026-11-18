import type {Feature, Geometry, Position} from 'geojson';
import type {Infer} from '../schema';
import type {FeatureSelector, FilterSpecification, GeoJSONFeature, Map as MapboxMap, StyleSpecification, TargetFeature} from 'mapbox-gl';

const IDLE_TIMEOUT_MS = 5000;
export const OWN_PREFIX = 'mapbox-webmcp-';

export function ownId(kind: 'source' | 'layer' | 'import', id: string | undefined): string {
    if (id === undefined) throw new Error(`Give the ${kind} id.`);
    if (!id.startsWith(OWN_PREFIX)) throw new Error(`The tools add, change and remove only their own ${kind}s, with an id that starts with "${OWN_PREFIX}", and "${id}" does not.`);
    return id;
}

export const targetSchema = {
    type: 'object',
    properties: {layerId: {type: 'string'}, featuresetId: {type: 'string'}, importId: {type: 'string'}},
    additionalProperties: false,
    description: 'A target as listTargets returns it: {layerId} for a layer, or {featuresetId, importId} for a featureset, without importId in the root style.'
} as const;
export const featureIdSchema = {type: ['string', 'number'], description: 'A feature id, as a feature query returns it, with its type. An id that several features share means all of them.'} as const;
export const featureRefSchema = {type: 'object', properties: {target: targetSchema, id: featureIdSchema}, required: ['target', 'id'], additionalProperties: false} as const;
export const lngLatSchema = {type: 'object', properties: {lng: {type: 'number'}, lat: {type: 'number'}}, required: ['lng', 'lat'], additionalProperties: false} as const;
export const filterSchema = {
    type: 'array',
    description: 'A GL JS filter expression that features must match, such as ["==", ["get", NAME], VALUE] or ["all", [">", ["get", NAME], VALUE], ["in", VALUE, ["get", NAME]]], with property names that listTargets gives.'
} as const;

type Coordinates = Position | Coordinates[];

function flatten(coordinates: Coordinates): Position[] {
    return typeof coordinates[0] === 'number' ? [coordinates as Position] : (coordinates as Coordinates[]).flatMap(flatten);
}

export function positions(geojson: Feature | Geometry | null): Position[] {
    if (!geojson) return [];
    if (geojson.type === 'Feature') return positions(geojson.geometry);
    if (geojson.type === 'GeometryCollection') return geojson.geometries.flatMap(positions);
    return flatten(geojson.coordinates);
}

// GL JS fires idle only after a camera transition ends, so the timeout starts after moveend.
// A removed map fires remove and never moveend.
export async function idle(map: MapboxMap): Promise<{note?: string}> {
    if (map.isMoving()) {
        await new Promise<void>((resolve) => {
            const onEnd = () => {
                map.off('moveend', onEnd);
                map.off('remove', onEnd);
                resolve();
            };
            map.on('moveend', onEnd);
            map.on('remove', onEnd);
        });
    }
    return new Promise((resolve) => {
        const onIdle = () => {
            clearTimeout(timer);
            resolve({});
        };
        const timer = setTimeout(() => {
            map.off('idle', onIdle);
            resolve({note: `The map did not finish rendering in ${IDLE_TIMEOUT_MS} ms, so it can still be loading tiles. Read the map again to see its state.`});
        }, IDLE_TIMEOUT_MS);
        map.once('idle', onIdle);
        map.triggerRepaint();
    });
}

type TargetInput = Infer<typeof targetSchema>;
type LayerTarget = {target: {layerId: string}; type: string; source: string; sourceLayer?: string};
type FeaturesetTarget = {target: {featuresetId: string; importId?: string}; type: 'featureset'; style: StyleSpecification};
export type Target = LayerTarget | FeaturesetTarget;

export function isFeatureset(t: Target): t is FeaturesetTarget {
    return 'featuresetId' in t.target;
}

export function featuresets(map: MapboxMap): FeaturesetTarget[] {
    const root = map.getStyle();
    const styles = [{importId: '', style: root}, ...(root.imports ?? []).flatMap(({id, data}) => data ? [{importId: id, style: data}] : [])];
    return styles.flatMap(({importId, style}) => Object.keys(style.featuresets ?? {}).map((featuresetId) => ({
        target: importId ? {featuresetId, importId} : {featuresetId}, type: 'featureset' as const, style
    })));
}

export function queryType(t: Target): 'rendered' | 'source' {
    return isFeatureset(t) ? 'rendered' : 'source';
}

export function targetName(t: Target): string {
    if (!isFeatureset(t)) return `layer "${t.target.layerId}"`;
    const {featuresetId, importId} = t.target;
    return `featureset "${featuresetId}" ${importId ? `of import "${importId}"` : 'of the root style'}`;
}

export function target(map: MapboxMap, input?: TargetInput): Target {
    if (input === undefined) throw new Error('Give a target. List the targets to see them.');
    const {layerId, featuresetId, importId} = input;
    if ((layerId === undefined) === (featuresetId === undefined) || (layerId !== undefined && importId !== undefined)) {
        throw new Error('A target is {layerId} or {featuresetId, importId}. List the targets to see them.');
    }
    if (layerId !== undefined) {
        const layer = map.getLayer(layerId);
        if (!layer) throw new Error(`No layer "${layerId}". List the targets to see them.`);
        const source = 'source' in layer && typeof layer.source === 'string' ? layer.source : '';
        return {target: {layerId}, type: layer.type, source, sourceLayer: (layer as {'source-layer'?: string})['source-layer']};
    }
    const found = featuresets(map).find((f) => f.target.featuresetId === featuresetId && (f.target.importId ?? '') === (importId ?? ''));
    if (!found) throw new Error(`No featureset "${featuresetId}" ${importId ? `in import "${importId}"` : 'in the root style'}. List the targets to see them.`);
    return found;
}

export type Selector = FeatureSelector | TargetFeature;
type FeatureId = string | number;
export type Found = {id?: FeatureId; properties: Record<string, unknown>; geometry: Geometry; selector?: Selector};

function toFound(list: (GeoJSONFeature | TargetFeature)[], t: Target): Found[] {
    return list.map((feature) => {
        const id = feature.id ?? undefined;
        const selector = id === undefined ? undefined : isFeatureset(t) ? feature as TargetFeature : {source: t.source, sourceLayer: t.sourceLayer, id};
        return {id, properties: feature.properties ?? {}, geometry: feature.geometry, selector};
    });
}

// GL JS reports an invalid filter as an error event, not by throwing.
export function throwingGLErrors<T>(map: MapboxMap, call: () => T): T {
    let reported: Error | undefined;
    const onError = ({error}: {error: Error}) => { reported ??= error; };
    map.on('error', onError);
    try {
        const result = call();
        if (reported) throw reported;
        return result;
    } catch (e) {
        throw reported ?? e;
    } finally {
        map.off('error', onError);
    }
}

export function applyEach(map: MapboxMap, parts: [string, () => unknown][], rest: string): void {
    const failed = parts.flatMap(([name, apply]) => {
        try {
            throwingGLErrors(map, apply);
            return [];
        } catch (e) {
            return [`${name}: ${e instanceof Error ? e.message : String(e)}`];
        }
    });
    if (failed.length) throw new Error(failed.length === parts.length ? failed.join('\n') : `${failed.join('\n')}\n${rest}`);
}

export function each<T>(map: MapboxMap, on: Map<string, T>, noun: 'Marker' | 'Popup', ids: string[] | undefined, verb: string, change: (thing: T, id: string) => [string, () => unknown][]): string[] {
    const things = `${noun.toLowerCase()}s`;
    if (!ids?.length) throw new Error(`Give the ids of the ${things} to ${verb}. List the ${things} to see them.`);
    const unique = [...new Set(ids)];
    const parts: [string, () => unknown][] = [];
    for (const id of unique) {
        const thing = on.get(id);
        if (thing) parts.push(...change(thing, id));
        else parts.push([`${noun} "${id}"`, () => { throw new Error(`No ${noun.toLowerCase()} with this id.`); }]);
    }
    applyEach(map, parts, `The other changes applied. List the ${things} to see them.`);
    return unique;
}

// GL JS loads a source in a worker and reports a failure as an error event of the source.
export async function watched(map: MapboxMap, id: string, change: () => void) {
    let failed: Error | undefined;
    const onError = ({error}: {error: Error}) => { failed ??= error; };
    throwingGLErrors(map, change);
    const source = map.getSource(id);
    source?.on('error', onError);
    try {
        const rendered = await idle(map);
        return {failed, rendered};
    } finally {
        source?.off('error', onError);
    }
}

export function all(...filters: (FilterSpecification | null | undefined)[]): FilterSpecification | undefined {
    const given = filters.filter((f): f is FilterSpecification => f != null);
    return given.length > 1 ? ['all', ...given] as FilterSpecification : given[0];
}

export function features(map: MapboxMap, t: Target, filter?: FilterSpecification): Found[] {
    if (isFeatureset(t)) return toFound(throwingGLErrors(map, () => map.queryRenderedFeatures({target: t.target, filter})), t);
    return toFound(throwingGLErrors(map, () => map.querySourceFeatures(t.source, {sourceLayer: t.sourceLayer, filter: all(map.getFilter(t.target.layerId), filter)})), t);
}

export function featuresAt(map: MapboxMap, t: Target, at: Infer<typeof lngLatSchema>, filter?: FilterSpecification): Found[] {
    const point = map.project(at);
    if (isFeatureset(t)) return toFound(throwingGLErrors(map, () => map.queryRenderedFeatures(point, {target: t.target, filter})), t);
    return toFound(throwingGLErrors(map, () => map.queryRenderedFeatures(point, {layers: [t.target.layerId], filter})), t);
}

export function byId(found: Found[], t: Target, id: FeatureId): Found[] {
    const named = found.filter((candidate) => candidate.id === id);
    if (named.length) return named;
    const idless = found.some((candidate) => candidate.id === undefined) ? ' GL JS has no id for some of its features, so they can\'t be named. Their data needs ids, generateId or promoteId.' : '';
    throw new Error(`No feature with id ${JSON.stringify(id)} in ${targetName(t)}.${idless}`);
}

export function featureByRef(map: MapboxMap, ref: Infer<typeof featureRefSchema>): Found[] {
    const t = target(map, ref.target);
    return byId(features(map, t), t, ref.id);
}

export function stateKeys(map: MapboxMap, t: Target): string[] {
    const keys = new Set<string>();
    const walk = (value: unknown): void => {
        if (Array.isArray(value)) {
            if (value[0] === 'literal') return;
            if (value[0] === 'feature-state' && typeof value[1] === 'string') keys.add(value[1]);
            value.forEach(walk);
        } else if (typeof value === 'object' && value !== null) {
            Object.values(value).forEach(walk);
        }
    };
    if (!isFeatureset(t)) {
        walk(map.getLayer(t.target.layerId));
    } else {
        for (const {layer} of t.style.featuresets?.[t.target.featuresetId]?.selectors ?? []) walk(t.style.layers.find((l) => l.id === layer));
    }
    return [...keys];
}
