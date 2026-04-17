import {Pane} from 'tweakpane';
import {bindAll} from '../../util/util';
import * as DOM from '../../util/dom';

import type {Map as MapboxMap, IControl, ControlPosition} from '../map';
import type {FolderApi, FolderParams, BindingApi, BindingParams, ButtonApi} from '@tweakpane/core';

interface FileSystemWritableFileStream {
    write: (data: string) => Promise<void>;
    close: () => Promise<void>;
}

interface FileSystemFileHandle {
    createWritable: () => Promise<FileSystemWritableFileStream>;
    getFile: () => Promise<File>;
}

interface FilePickerOptions {
    types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
    }>;
}

declare global {
    interface Window {
        showSaveFilePicker?: (options?: FilePickerOptions) => Promise<FileSystemFileHandle>;
        showOpenFilePicker?: (options?: FilePickerOptions) => Promise<FileSystemFileHandle[]>;
    }
}

type Callback = (value?: unknown) => void;

export type DevToolsFolder = {
    addBinding: <T extends object>(target: T, key: keyof T, params?: BindingParams, callback?: Callback) => void;
    addButton: (title: string, callback: () => void) => ButtonApi;
    addSubFolder: (name: string, options?: Partial<FolderParams>) => DevToolsFolder;
    addReadonly: <T extends object>(target: T, key: keyof T, params?: BindingParams) => BindingApi;
    folder: FolderApi;
};

type Metadata = {
    target: Record<string, unknown>;
    defaultValue?: unknown;
    label: string;
    binding: BindingApi;
    callback?: Callback;
};

type FolderEntry = {
    title: string;
    name?: string;
    bindings: Map<PropertyKey, Metadata>;
};

type SavedFolderState = {
    expanded: boolean;
    bindings: Record<string, unknown>;
};

type SavedState = {
    paneExpanded: boolean;
    folders: Record<string, SavedFolderState>;
};

const filePickerOpts = {
    types: [{
        description: 'Mapbox DevTools parameters file',
        accept: {'text/plain': ['.json']}
    }]
};

const CSS = `
    .mapboxgl-ctrl.mapbox-devtools {
        min-width: 385px;
        max-height: 75vh;
        overflow-y: auto;
    }

    .mapboxgl-ctrl.mapbox-devtools button.tp-btnv_b:hover {
        background-color: var(--btn-bg-h);
    }

    .mapboxgl-ctrl.mapbox-devtools button.tp-rotv_b:hover,
    .mapboxgl-ctrl.mapbox-devtools button.tp-fldv_b:hover {
        background-color: var(--cnt-bg-h);
    }

    .mapbox-devtools .tp-fldv.devtools-modified > .tp-fldv_b > .tp-fldv_t::before {
        content: "\\25CF  ";
    }

    .mapbox-devtools .tp-lblv.devtools-tracked.devtools-modified > .tp-lblv_l::before {
        content: "\\25CF  ";
    }

    .mapbox-devtools .tp-lblv.devtools-tracked:not(.devtools-modified) > .tp-lblv_l::before {
        content: "\\25CB  ";
    }
`;

/**
 * Control for tweaking Map parameters at runtime.
 * Uses title-keyed persistence: localStorage for auto-save, file system for shareable configs.
 *
 * @implements {IControl}
 */
export class DevTools implements IControl {
    _map: MapboxMap;
    _pane: Pane;

    _container: HTMLElement;
    _styleElement: HTMLStyleElement;

    _loaded: boolean;
    _folders: Map<FolderApi, FolderEntry>;
    _storageKey: string;
    _savedState: SavedState | null;
    _pendingScrollTop: number | null;

    constructor() {
        this._folders = new Map();
        this._loaded = false;
        this._savedState = null;
        this._pendingScrollTop = null;

        bindAll([
            '_onRender',
            '_onScrollEnd',
            '_onFold'
        ], this);
    }

    onAdd(map: MapboxMap): HTMLElement {
        this._map = map;
        this._loaded = false;
        this._storageKey = `mapbox.devtools:${location.pathname}:${this._map._getMapId()}`;
        this._savedState = this._loadSavedState();

        this._styleElement = document.createElement('style');
        this._styleElement.textContent = CSS;
        document.head.appendChild(this._styleElement);

        const container = this._container = DOM.create('div', 'mapboxgl-ctrl mapbox-devtools');

        const pane = this._pane = new Pane({
            title: 'devtools',
            container,
            expanded: this._savedState ? this._savedState.paneExpanded : false
        });

        pane.on('fold', this._onFold);

        pane.addButton({title: 'Reset'}).on('click', () => this._onReset());
        pane.addButton({title: 'Fold/Unfold'}).on('click', () => this._onToggleFold());
        pane.addButton({title: 'Save to file'}).on('click', () => this._saveToFile());
        pane.addButton({title: 'Load from file'}).on('click', () => this._loadFromFile());

        this._setupFPS();
        this._setupDebug();
        this._setupBuildings();
        this._setupOcclusion();

        map.painter._devtools = this;

        // Tweakpane normalizes values internally (e.g., colors through 0-255 round-trip).
        // Force normalization before capturing defaults so they match Tweakpane's representation.
        this._pane.importState(this._pane.exportState());
        this._captureDefaults();
        this._restoreBindingValues();
        this._updateAllBindingLabels();
        this._updateFolderLabels();

        this._loaded = true;

        // Refresh pane on map render to update dynamic values
        map.on('render', this._onRender);

        const scrollStorageKey = `${this._storageKey}:scroll`;
        const savedScroll = localStorage.getItem(scrollStorageKey);
        this._pendingScrollTop = savedScroll ? parseFloat(savedScroll) : null;
        container.addEventListener('scrollend', this._onScrollEnd);

        return this._container;
    }

    onRemove(): void {
        if (!this._map) return;

        this._map.painter._devtools = undefined;
        this._map.off('render', this._onRender);
        this._container.removeEventListener('scrollend', this._onScrollEnd);
        this._pane.dispose();
        this._container.remove();
        this._styleElement.remove();
        this._folders.clear();

        this._map = undefined;
        this._pane = undefined;
        this._container = undefined;
        this._styleElement = undefined;
        this._savedState = null;
        this._pendingScrollTop = null;
    }

    getDefaultPosition(): ControlPosition {
        return 'top-right';
    }

    addFolder(name: string, options?: Partial<FolderParams>): DevToolsFolder {
        // Return existing folder if one with this name already exists
        for (const [folder, entry] of this._folders) {
            if (entry.name === name) {
                return this._createFolderHandle(folder);
            }
        }

        const folder = this._addFolder(this._pane, Object.assign({title: name}, options));
        const entry = this._folders.get(folder);
        if (entry) entry.name = name;

        return this._createFolderHandle(folder);
    }

    removeFolder(name: string): void {
        for (const [folder, entry] of this._folders) {
            if (entry.name !== name) continue;

            // Recursively remove child folder entries from _folders
            const removeChildren = (f: FolderApi) => {
                for (const child of f.children) {
                    if ('expanded' in child) {
                        const childFolder = child as FolderApi;
                        removeChildren(childFolder);
                        this._folders.delete(childFolder);
                    }
                }
            };
            removeChildren(folder);
            this._folders.delete(folder);
            folder.dispose();
            return;
        }
    }

    _createFolderHandle(folder: FolderApi): DevToolsFolder {
        return {
            addBinding: <T extends object>(target: T, key: keyof T, params?: BindingParams, callback?: Callback) => {
                this._addParameter(folder, target, key, params, callback);
                // Capture default immediately — _captureDefaults() only runs once in onAdd
                const entry = this._folders.get(folder);
                if (entry) {
                    const meta = entry.bindings.get(key);
                    if (meta) {
                        meta.defaultValue = structuredClone(meta.target[key as string]);
                        this._restoreBinding(entry, key as string, meta);
                    }
                }
            },
            addButton: (title: string, callback: () => void): ButtonApi => {
                const btn = folder.addButton({title});
                btn.on('click', callback);
                return btn;
            },
            addSubFolder: (name: string, options?: Partial<FolderParams>): DevToolsFolder => {
                // Return existing sub-folder if one with this name already exists under this parent
                for (const child of folder.children) {
                    if ('expanded' in child) {
                        const entry = this._folders.get(child as FolderApi);
                        if (entry && entry.name === name) {
                            return this._createFolderHandle(child as FolderApi);
                        }
                    }
                }

                const sub = this._addFolder(folder, Object.assign({title: name}, options));
                const subEntry = this._folders.get(sub);
                if (subEntry) subEntry.name = name;
                return this._createFolderHandle(sub);
            },
            addReadonly: <T extends object>(target: T, key: keyof T, params?: BindingParams): BindingApi => {
                return folder.addBinding(target, key, Object.assign({}, params, {readonly: true}) as BindingParams);
            },
            folder
        };
    }

    _onRender(): void {
        if (this._pane) this._pane.refresh();
        this._applyPendingScroll();
    }

    _applyPendingScroll(): void {
        if (this._pendingScrollTop === null || !this._container) return;
        this._container.scrollTop = this._pendingScrollTop;
        if (Math.abs(this._container.scrollTop - this._pendingScrollTop) < 1) {
            this._pendingScrollTop = null;
        }
    }

    _onScrollEnd(): void {
        const scrollStorageKey = `${this._storageKey}:scroll`;
        localStorage.setItem(scrollStorageKey, String(this._container.scrollTop));
    }

    _onFold(): void {
        if (this._loaded) this._exportState();
    }

    _onReset(): void {
        this._loaded = false;
        this._folders.forEach((entry) => {
            entry.bindings.forEach((metadata, key: PropertyKey) => {
                metadata.target[key as string] = structuredClone(metadata.defaultValue);
            });
        });
        this._updateAllBindingLabels();
        this._updateFolderLabels();
        this._pane.refresh();
        this._map.triggerRepaint();
        this._loaded = true;
        this._exportState();
    }

    _onToggleFold(): void {
        this._loaded = false;
        const anyExpanded = this._pane.children.some((child) => 'expanded' in child && child.expanded);
        this._pane.children.forEach((child) => {
            if ('expanded' in child) child.expanded = !anyExpanded;
        });
        this._exportState();
        this._loaded = true;
    }

    _addParameter<T extends object>(folder: FolderApi, target: T, key: keyof T, params?: BindingParams, callback?: Callback): void {
        const binding = folder.addBinding(target, key, params);
        const label = binding.label || key.toString();

        binding.element.classList.add('devtools-tracked');

        binding.on('change', (event) => {
            this._updateBindingLabel(folder, key);
            if (callback) callback(event.value);
            if (this._loaded) {
                this._updateFolderLabels();
                this._exportState();
            }
        });

        if (!this._folders.has(folder)) {
            this._folders.set(folder, {title: folder.title, bindings: new Map()});
        }
        const entry = this._folders.get(folder);
        entry.bindings.set(key, {label, binding, target: target as Record<string, unknown>, callback});
    }

    _captureDefaults(): void {
        this._folders.forEach((entry) => {
            entry.bindings.forEach((meta, key) => {
                meta.defaultValue = structuredClone(meta.target[key as string]);
            });
        });
    }

    _updateBindingLabel(folder: FolderApi, key: PropertyKey): void {
        const entry = this._folders.get(folder);
        if (!entry) return;
        const meta = entry.bindings.get(key);
        if (!meta || meta.defaultValue === undefined) return;

        const isDefault = JSON.stringify(meta.target[key as string]) === JSON.stringify(meta.defaultValue);
        meta.binding.element.classList.toggle('devtools-modified', !isDefault);
    }

    _updateAllBindingLabels(): void {
        this._folders.forEach((entry, folder) => {
            entry.bindings.forEach((_meta, key) => {
                this._updateBindingLabel(folder, key);
            });
        });
    }

    _addFolder(parent: FolderApi | Pane, options: FolderParams): FolderApi {
        const folder = parent.addFolder(options);
        folder.on('fold', this._onFold);
        this._folders.set(folder, {title: options.title, bindings: new Map()});

        // Restore fold state from saved state by title
        if (this._savedState) {
            const saved = this._savedState.folders[options.title];
            if (saved) {
                folder.expanded = saved.expanded;
            }
        }

        return folder;
    }

    _updateFolderLabels(): void {
        const checkFolder = (folder: FolderApi): boolean => {
            let hasChanges = false;

            const entry = this._folders.get(folder);
            if (entry) {
                for (const [key, meta] of entry.bindings) {
                    if (JSON.stringify(meta.target[key as string]) !== JSON.stringify(meta.defaultValue)) {
                        hasChanges = true;
                        break;
                    }
                }
            }

            for (const child of folder.children) {
                if ('expanded' in child && checkFolder(child as FolderApi)) {
                    hasChanges = true;
                }
            }

            if (entry) {
                folder.element.classList.toggle('devtools-modified', hasChanges);
            }

            return hasChanges;
        };

        for (const child of this._pane.children) {
            if ('expanded' in child) {
                checkFolder(child as FolderApi);
            }
        }
    }

    _stateKey(entry: FolderEntry): string {
        return entry.name || entry.title;
    }

    _restoreBinding(entry: FolderEntry, key: string, meta: Metadata): void {
        if (!this._savedState) return;
        const saved = this._savedState.folders[this._stateKey(entry)];
        if (!saved) return;
        const savedValue = saved.bindings[key];
        if (savedValue !== undefined) {
            meta.target[key] = structuredClone(savedValue);
        }
    }

    _restoreBindingValues(): void {
        if (!this._savedState) return;
        for (const [, entry] of this._folders) {
            const saved = this._savedState.folders[this._stateKey(entry)];
            if (!saved) continue;
            for (const [key, meta] of entry.bindings) {
                const savedValue = saved.bindings[key as string];
                if (savedValue !== undefined) {
                    meta.target[key as string] = structuredClone(savedValue);
                }
            }
        }
    }

    _loadSavedState(): SavedState | null {
        try {
            const saved = localStorage.getItem(this._storageKey);
            if (!saved) return null;
            const parsed = JSON.parse(saved) as Record<string, unknown>;

            // New title-keyed format
            if ('folders' in parsed) return parsed as unknown as SavedState;

            // Ignore legacy Tweakpane BladeState format — incompatible
            return null;
        } catch {
            return null;
        }
    }

    _exportState(): void {
        if (!this._pane) return;
        const state: SavedState = {
            paneExpanded: this._pane.expanded,
            folders: {}
        };

        for (const [folder, entry] of this._folders) {
            const bindings: Record<string, unknown> = {};
            for (const [key, meta] of entry.bindings) {
                bindings[key as string] = structuredClone(meta.target[key as string]);
            }
            state.folders[this._stateKey(entry)] = {
                expanded: folder.expanded,
                bindings
            };
        }

        try {
            localStorage.setItem(this._storageKey, JSON.stringify(state));
        } catch {
            // Private browsing or quota exceeded — silently skip
        }
    }

    _applyState(state: SavedState): void {
        this._loaded = false;

        if (state.paneExpanded !== undefined) {
            this._pane.expanded = state.paneExpanded;
        }

        for (const [folder, entry] of this._folders) {
            const saved = state.folders[this._stateKey(entry)];
            if (!saved) continue;
            if (saved.expanded !== undefined) folder.expanded = saved.expanded;
            for (const [key, meta] of entry.bindings) {
                const savedValue = saved.bindings[key as string];
                if (savedValue !== undefined) {
                    meta.target[key as string] = structuredClone(savedValue);
                }
            }
        }

        this._pane.refresh();
        this._updateAllBindingLabels();
        this._updateFolderLabels();
        this._loaded = true;
        this._exportState();
    }

    _saveToFile(): void {
        if (!this._pane || !window.showSaveFilePicker) return;

        this._exportState();
        const state = localStorage.getItem(this._storageKey);

        window.showSaveFilePicker(filePickerOpts)
            .then((fileHandle) => fileHandle.createWritable())
            .then((writable) => writable.write(state || '{}').then(() => writable))
            .then((writable) => writable.close())
            .catch((err: Error) => console.error(err));
    }

    _loadFromFile(): void {
        if (!this._pane || !window.showOpenFilePicker) return;

        window.showOpenFilePicker(filePickerOpts)
            .then((fileHandles) => fileHandles[0].getFile())
            .then((file) => file.text())
            .then((fileData) => {
                const parsed = JSON.parse(fileData) as Record<string, unknown>;
                if (!('folders' in parsed)) return;
                this._applyState(parsed as unknown as SavedState);
            })
            .catch((err: Error) => console.error(err));
    }

    // Simple toggles on painter._debugParams with no owning class are registered here
    // (FPS, debug flags, buildings, occlusion). Features backed by classes with lifecycle
    // (Rain, Snow, Terrain, Shadows, Atmosphere) register via painter._devtools.addFolder()
    // in their own modules. Buildings stays here because draw_building.ts is a stateless
    // function module — no class instance to anchor registration or cleanup to.
    _setupFPS(): void {
        const map = this._map;
        const folder = this._addFolder(this._pane, {title: 'FPS'});

        this._addParameter(folder, map.painter._debugParams, 'fpsWindow', {min: 1, max: 100, step: 1});
        folder.addBinding(map.painter._debugParams, 'continousRedraw', {label: 'Continuous redraw', readonly: true});
        folder.addBinding(map.painter._debugParams, 'averageFPS', {label: 'Value', readonly: true});
        folder.addBinding(map.painter._debugParams, 'averageFPS', {label: 'Graph', view: 'graph', readonly: true, min: 0, max: 200});
    }

    _setupDebug(): void {
        const map = this._map;
        const folder = this._addFolder(this._pane, {title: 'Debug'});

        this._addParameter(folder, map, 'showOverdrawInspector');
        this._addParameter(folder, map, 'showTileBoundaries');
        this._addParameter(folder, map, 'showParseStatus');
        this._addParameter(folder, map, 'repaint');
        this._addParameter(folder, map, 'showTileAABBs');
        this._addParameter(folder, map, 'showPadding');
        this._addParameter(folder, map, 'showCollisionBoxes', null, () => map._update());
        this._addParameter(folder, map.transform, 'freezeTileCoverage', null, () => map._update());
        this._addParameter(folder, map, 'showTerrainWireframe');
        this._addParameter(folder, map, 'showLayers2DWireframe');
        this._addParameter(folder, map, 'showLayers3DWireframe');
        this._addParameter(folder, map, '_scaleFactor', {label: 'scaleFactor', min: 0.1, max: 10.0, step: 0.1}, () => map.setScaleFactor(map._scaleFactor));

        const layersFolder = this._addFolder(folder, {title: 'Enabled Layers'});

        for (const layerType of Object.keys(map.painter._debugParams.enabledLayers)) {
            this._addParameter(layersFolder, map.painter._debugParams.enabledLayers, layerType, {}, () => map.triggerRepaint());
        }
    }

    _setupOcclusion(): void {
        const map = this._map;
        const folder = this._addFolder(this._pane, {title: 'Occlusion'});

        this._addParameter(folder, map.painter.occlusionParams, 'occluderSize', {min: 1, max: 100, step: 1});
        this._addParameter(folder, map.painter.occlusionParams, 'depthOffset', {min: -0.05, max: 0, step: 0.00001});
    }

    _setupBuildings(): void {
        const map = this._map;
        const folder = this._addFolder(this._pane, {title: 'Buildings'});

        this._addParameter(folder, map.painter._debugParams, 'buildingsDrawTranslucentPass', {label: 'Draw Translucent Pass'}, () => map.triggerRepaint());
        this._addParameter(folder, map.painter._debugParams, 'buildingsDrawShadowPass', {label: 'Draw Shadow Pass'}, () => map.triggerRepaint());
        this._addParameter(folder, map.painter._debugParams, 'buildingsShowNormals', {label: 'Show normals'}, () => map.triggerRepaint());
        this._addParameter(folder, map.painter._debugParams, 'buildingsDrawGroundAO', {label: 'Ground AO'}, () => map.triggerRepaint());
    }
}
