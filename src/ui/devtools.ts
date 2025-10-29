import {Pane} from 'tweakpane';
import * as DOM from '../util/dom';

import type {Map as MapboxMap} from '../ui/map';
import type {FolderApi, BindingApi, BindingParams, BladeState} from '@tweakpane/core';

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

type Metadata = {
    target: Record<string, unknown>;
    defaultValue: unknown;
    label: string;
    binding: BindingApi;
    callback?: Callback;
};

type Folder = {
    api: FolderApi;
    bindings: Map<PropertyKey, Metadata>;
};

/**
 * Runtime parameter tweaking UI built on Tweakpane.
 * Uses dual persistence: localStorage for auto-save, file system for shareable configs.
 */
export const DevTools = {
    pane: null as Pane | null,
    folders: new Map<string, Folder>(),
    storageName: null as string | null,

    filePickerOpts: {
        types: [{
            description: 'Parameters file',
            accept: {'text/plain': ['.json']}
        }]
    },

    addTo(map: MapboxMap): void {
        DevTools.storageName = `mapbox:devtools:${location.pathname}`;

        const positionContainer = map._controlPositions['top-right'];
        const container = DOM.create('div', 'mapboxgl-ctrl mapbox-devTools', positionContainer);
        container.style.maxHeight = '75vh';
        container.style.overflowY = 'auto';

        const pane = new Pane({
            title: 'devtools',
            container,
            expanded: false
        });

        const saved = localStorage.getItem(DevTools.storageName);
        if (saved) pane.importState(JSON.parse(saved) as BladeState);

        pane.on('fold', () => DevTools.saveState());
        pane.addButton({title: 'Reset'}).on('click', () => DevTools.reset());
        pane.addButton({title: 'Fold all'}).on('click', () => DevTools.setExpanded(false));
        pane.addButton({title: 'Unfold all'}).on('click', () => DevTools.setExpanded(true));
        pane.addButton({title: 'Save to file'}).on('click', () => DevTools.saveParameters());
        pane.addButton({title: 'Load from file'}).on('click', () => DevTools.loadParameters());

        DevTools.pane = pane;
    },

    saveState() {
        if (!DevTools.pane) return;
        const state = DevTools.pane.exportState();
        localStorage.setItem(DevTools.storageName, JSON.stringify(state));
    },

    setExpanded(expanded: boolean) {
        DevTools.folders.forEach((folder) => {
            folder.api.expanded = expanded;
            folder.api.refresh();
        });

        DevTools.saveState();
    },

    reset() {
        if (!DevTools.pane) return;

        DevTools.folders.forEach((folder) => {
            folder.bindings.forEach((metadata, key: string) => {
                metadata.target[key] = structuredClone(metadata.defaultValue);
            });
            folder.api.refresh();
        });
        DevTools.updateIndicators();
        DevTools.saveState();
    },

    updateIndicators() {
        DevTools.folders.forEach((folder, folderName) => {
            let isModified = false;
            folder.bindings.forEach((metadata, key: string) => {
                const currentValue = metadata.target[key];
                const isDefault = JSON.stringify(metadata.defaultValue) === JSON.stringify(currentValue);
                if (!isDefault) isModified = true;

                const prefix = isDefault ? '○ ' : '● ';
                metadata.binding.label = prefix + metadata.label;
            });

            folder.api.title = isModified ? `● ${folderName}` : folderName;
        });
    },

    saveParameters() {
        if (!DevTools.pane || !window.showSaveFilePicker) return;

        const state = DevTools.pane.exportState();
        const serialized = JSON.stringify(state, null, 2);

        window.showSaveFilePicker(DevTools.filePickerOpts)
            .then((fileHandle) => fileHandle.createWritable())
            .then((writable) => writable.write(serialized).then(() => writable))
            .then((writable) => writable.close().catch(() => {}))
            .catch((err: Error) => console.warn('Failed to save parameters:', err));
    },

    loadParameters() {
        if (!DevTools.pane || !window.showOpenFilePicker) return;

        window.showOpenFilePicker(DevTools.filePickerOpts)
            .then((fileHandles) => fileHandles[0].getFile())
            .then((file) => file.text())
            .then((fileData) => {
                const state = JSON.parse(fileData) as BladeState;
                DevTools.pane.importState(state);
                DevTools.updateIndicators();
                DevTools.folders.forEach((folder) => folder.api.refresh());
            })
            .catch((err: Error) => console.warn('Failed to load parameters:', err));
    },

    getOrCreateFolder(folderName: string): Folder {
        if (!DevTools.pane) return null;

        let folder = DevTools.folders.get(folderName);
        if (folder) return folder;

        const api = DevTools.pane.addFolder({title: folderName, expanded: true});
        folder = {api, bindings: new Map()};
        DevTools.folders.set(folderName, folder);
        api.on('fold', () => DevTools.saveState());

        return folder;
    },

    addParameter<T extends object>(target: T, key: keyof T, folderName: string, params?: BindingParams, callback?: Callback): void {
        if (!DevTools.pane) return;

        const folder = DevTools.getOrCreateFolder(folderName);
        if (folder.bindings.has(key)) console.warn(`Parameter "${folderName}/${String(key)}" already registered`);

        const defaultValue = structuredClone(target[key]);
        const binding = folder.api.addBinding(target, key, params);

        // Tweakpane can only restore values for bindings that exist, so we must re-import
        // state after each binding is added to restore its saved value
        const saved = localStorage.getItem(DevTools.storageName);
        if (saved) DevTools.pane.importState(JSON.parse(saved) as BladeState);

        binding.on('change', (ev) => {
            DevTools.saveState();
            DevTools.updateIndicators();
            if (callback) callback(ev.value);
        });

        folder.bindings.set(key, {
            defaultValue,
            binding,
            label: binding.label || key.toString(),
            callback,
            target: target as Record<string, unknown>
        });

        DevTools.updateIndicators();
    },

    addBinding<T extends object>(target: T, key: keyof T, folderName: string, params?: BindingParams): void {
        if (!DevTools.pane) return;
        const folder = DevTools.getOrCreateFolder(folderName);
        folder.api.addBinding(target, key, params);
    },

    addButton(folderName: string, buttonTitle: string, onClick: Callback): void {
        if (!DevTools.pane) return;
        const folder = DevTools.getOrCreateFolder(folderName);
        const button = folder.api.addButton({title: buttonTitle});
        button.on('click', () => onClick());
    },

    refresh(): void {
        DevTools.folders.forEach((folder) => folder.api.refresh());
    }
};
