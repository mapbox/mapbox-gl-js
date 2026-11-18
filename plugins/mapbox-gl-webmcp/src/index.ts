import {assertSupported, check} from './schema';

import type * as MapboxGL from 'mapbox-gl';
import type * as MapboxGLESM from 'mapbox-gl/esm';
import type {IControl, Map as MapboxMap} from 'mapbox-gl';
import type {Infer, ObjectSchema} from './schema';

export type {Infer} from './schema';

export type MapboxGLModule = typeof MapboxGL | typeof MapboxGL.default;
export type JsonValue =
    | null
    | boolean
    | number
    | string
    | JsonValue[]
    | {[key: string]: JsonValue};
export type MapboxWebMCPToolResult =
    | {type: 'success'; value: JsonValue; note?: string}
    | {type: 'error'; error: {message: string}};
export type MapboxWebMCPTool<Schema extends ObjectSchema> = {
    description: string;
    inputSchema: Schema;
    execute: (input: Infer<Schema>, map: MapboxMap, mapboxgl: MapboxGLModule) => unknown;
};

type ModelContext = {
    registerTool: (
        tool: {
            name: string;
            description: string;
            inputSchema: ObjectSchema;
            execute: (input?: unknown) => Promise<MapboxWebMCPToolResult>;
        },
        options: {signal: AbortSignal}
    ) => Promise<undefined> | undefined;
};

const toolNamesOnPage = new WeakMap<Document, Set<string>>();
const counter = Symbol.for('mapbox-webmcp.counter');
let warnedNoModelContext = false;

async function runTool<S extends ObjectSchema>(tool: MapboxWebMCPTool<S>, input: unknown, map: MapboxMap, mapboxgl: MapboxGLModule, counts: Map<string, number>): Promise<MapboxWebMCPToolResult> {
    try {
        const checked = check(tool.inputSchema, input ?? {}) as Infer<S>;
        const counterName = (tool as {[counter]?: string})[counter];
        if (counterName) counts.set(counterName, (counts.get(counterName) ?? 0) + 1);
        const result = await tool.execute(checked, map, mapboxgl);
        let lost = 0;
        const text = JSON.stringify(result ?? null, (_key, value: unknown) => {
            if (value === undefined || (typeof value === 'number' && !Number.isFinite(value))) lost++;
            return value;
        });
        const json = JSON.parse(text) as JsonValue;
        return {type: 'success', value: json, ...(lost && {note: `JSON can't hold ${lost} of the values, such as NaN, Infinity or undefined, so they came back as null or were left out.`})};
    } catch (error) {
        return {type: 'error', error: {message: error instanceof Error ? error.message : String(error)}};
    }
}

export class MapboxWebMCP<const T extends Record<string, ObjectSchema> = Record<string, ObjectSchema>> implements IControl {
    private _mapboxgl: MapboxGLModule;
    private _tools: [string, MapboxWebMCPTool<T[keyof T]>][];
    private _container?: HTMLElement;
    private _registrationAbort?: AbortController;
    private _counts = new Map<string, number>();

    // GL JS's ESM entry, mapbox-gl/esm, declares its own types for the same classes.
    constructor({mapboxgl, tools}: {mapboxgl: MapboxGLModule | typeof MapboxGLESM; tools: {[K in keyof T]: MapboxWebMCPTool<T[K]>}}) {
        this._mapboxgl = mapboxgl as MapboxGLModule;
        this._tools = Object.keys(tools).map((name) => [name, tools[name as keyof T]]);
        for (const [name, tool] of this._tools) {
            if (tool.inputSchema.type !== 'object') throw new Error(`${name}: expected type "object"`);
            assertSupported(tool.inputSchema, name);
        }
    }

    onAdd(map: MapboxMap | MapboxGLESM.Map): HTMLElement {
        const ownerDocument = map.getContainer().ownerDocument;
        const suffix = (n: number) => (n === 1 ? '' : `_${n}`);
        let containerNumber = 1;
        while (ownerDocument.getElementById(`mapbox-webmcp-control${suffix(containerNumber)}`)) containerNumber++;
        const container = ownerDocument.createElement('div');
        container.id = `mapbox-webmcp-control${suffix(containerNumber)}`;
        container.style.display = 'none';
        this._container = container;
        // Chrome 149 has the API only on navigator.
        const modelContext = (ownerDocument as {modelContext?: ModelContext}).modelContext ?? (ownerDocument.defaultView?.navigator as {modelContext?: ModelContext} | undefined)?.modelContext;
        if (!modelContext) {
            if (!warnedNoModelContext) console.warn('MapboxWebMCP registered no tools, because this browser has no WebMCP API. In Chrome, add a WebMCP origin trial token to the page, or turn on chrome://flags/#enable-webmcp-testing to test locally.');
            warnedNoModelContext = true;
            return container;
        }

        const registrationAbort = new AbortController();
        this._registrationAbort = registrationAbort;
        const taken = toolNamesOnPage.get(ownerDocument) ?? new Set<string>();
        toolNamesOnPage.set(ownerDocument, taken);
        const free = (n: number) => this._tools.every(([key]) => !taken.has(key + suffix(n)));
        let number = 1;
        while (!free(number)) number++;
        for (const [key, tool] of this._tools) {
            const name = key + suffix(number);
            taken.add(name);
            registrationAbort.signal.addEventListener('abort', () => taken.delete(name));
            (async () => modelContext.registerTool({
                ...tool,
                name,
                execute: (input) => runTool(tool, input, map as MapboxMap, this._mapboxgl, this._counts)
            }, {signal: registrationAbort.signal}))().catch((error) => {
                console.warn(`MapboxWebMCP could not register the tool "${name}".`, error);
            });
        }
        ownerDocument.defaultView?.addEventListener('pagehide', () => this._sendCounts(map as MapboxMap), {signal: registrationAbort.signal});
        ownerDocument.addEventListener('visibilitychange', () => {
            if (ownerDocument.visibilityState === 'hidden') this._sendCounts(map as MapboxMap);
        }, {signal: registrationAbort.signal});
        return container;
    }

    onRemove(map: MapboxMap | MapboxGLESM.Map): void {
        this._sendCounts(map as MapboxMap);
        this._registrationAbort?.abort();
        this._registrationAbort = undefined;
        this._container?.remove();
        this._container = undefined;
    }

    private _sendCounts(map: MapboxMap): void {
        if (this._counts.size === 0) return;
        const counters = Array.from(this._counts, ([name, value]) => ({name: `maps/js/webmcp/${name}` as const, value}));
        this._counts.clear();
        map.fire('telemetry', {eventType: 'metrics', counters});
    }
}
