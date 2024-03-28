// @flow

import {Pane} from 'tweakpane';
import cloneDeep from 'lodash.clonedeep';
import serialize from 'serialize-to-js';
import assert from 'assert';
import {isWorker} from '../../../src/util/util.js';
import type {default as MapboxMap} from '../../../src/ui/map.js';
import type {Description} from './tracked_parameters_mock.js';

if (!isWorker()) {
    const style = document.createElement('style');
    style.innerHTML = `
        .tp-fldv_t {
            white-space: pre;
        }
        .tp-lblv_l {
            white-space: pre;
        }
        .mapbox-devtools::-webkit-scrollbar {
            width: 10px;
            height: 10px;
        }
        .mapbox-devtools::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.2);
            border-radius: 10px;
        }
        .mapbox-devtools::-webkit-scrollbar-thumb {
            background: rgba(110, 110, 110);
            border-radius: 10px;
        }
        .mapbox-devtools::-webkit-scrollbar-thumb:hover {
            background-color: rgba(90, 90, 90);
        }
        .mapboxgl-ctrl.mapbox-devtools {
            max-height: 75vh;
            overflow-y: auto;
        }
        .mapboxgl-ctrl.mapbox-devtools button.tp-btnv_b:hover {
            background-color: var(--btn-bg-h);
        }
    `;

    if (document.head) {
        document.head.appendChild(style);
    }
}

function deserialize(serialized: string): Object {
    return [eval][0](`(${serialized})`);
}

// Serializable folder state
class FolderState {
    isFolded: boolean;
    current: Object;

    constructor() {
        this.isFolded = false;
        this.current = {};
    }
}

// Serializable whole debug pane state
class PaneState {
    isMainPaneShown: boolean;
    folders: Map<string, FolderState>;
    scrollTopRatio: number;

    constructor() {
        this.scrollTopRatio = 0;
        this.isMainPaneShown = false;
        this.folders = new Map <string, FolderState>();
    }
}

function mergePaneParams(dest: PaneState, src: PaneState) {
    if (src.isMainPaneShown !== undefined) {
        dest.isMainPaneShown = src.isMainPaneShown;
    }

    const mergedFolderKeys = [...new Set([...src.folders.keys(), ...dest.folders.keys()])];

    for (const key of mergedFolderKeys) {
        const srcFolder = src.folders.get(key);
        const destFolder = dest.folders.get(key);
        if (srcFolder && destFolder) {
            for (const parameterKey of Object.keys(srcFolder.current)) {
                destFolder.current[parameterKey] = cloneDeep(srcFolder.current[parameterKey]);
            }
        } else if (srcFolder) {
            dest.folders.set(key, srcFolder);
        }
    }
}

function deSerializePaneParams(input: ?string): PaneState {
    let obj = {};
    if (input) {
        try {
            obj = deserialize(input);
        } catch (err) {
            console.log(`Tracked parameters deserialization error: ${err}`);
        }
    }

    const p = new PaneState();

    // Replace properties if present
    if ('isMainPaneShown' in obj) {
        p.isMainPaneShown = obj.isMainPaneShown;
    }

    if ('scrollTopRatio' in obj) {
        p.scrollTopRatio = obj.scrollTopRatio;
    }

    if ('folders' in obj) {
        if (obj.folders instanceof Map) {
            obj.folders.forEach((it, key) => {
                const f = new FolderState();
                if (`isFolded` in it) {
                    f.isFolded = it.isFolded;
                }
                if (`current` in it && it.current instanceof Object) {
                    f.current = cloneDeep(it.current);
                }
                p.folders.set(key, f);
            });
        }
    }
    return p;
}

// For fast prototyping in case of only one map present
let global: ?TrackedParameters;

export function registerParameter(object: Object, scope: Array<string>, name: string, description: ?Description, onChange: Function) {
    if (global) {
        global.registerParameter(object, scope, name, description, onChange);

        console.warn(`Dev only "registerParameter" call. For production consider replacing with tracked parameters container method.`);
    }
}

export function registerButton(scope: Array<string>, buttonTitle: string, onClick: Function) {
    if (global) {
        global.registerButton(scope, buttonTitle, onClick);

        console.warn(`Dev only "registerButton" call. For production consider replacing with tracked parameters container method.`);
    }
}

// Reference to actual object and default values
class ParameterInfo {
    containerObject: Object;
    parameterName: string;
    defaultValue: any;
    noSave: boolean;
    tpBinding: any;

    constructor(object: Object, parameterName: string, defaultValue: any, noSave: boolean, tpBinding: any) {
        this.containerObject = object;
        this.parameterName = parameterName;
        this.defaultValue = defaultValue;
        this.noSave = noSave;
        this.tpBinding = tpBinding;
    }
}

// Tracked parameters container
export class TrackedParameters {
    _map: MapboxMap;
    _container: HTMLElement;

    // All TweakPane scopes
    _folders: Map<string, any>;

    // For (de)serialization
    _paneState: PaneState;

    // Store container object reference for each parameter
    // Key = Scopes + parameter name
    _parametersInfo: Map<string, ParameterInfo>;

    _storageName: string;

    _scrollUnblocked: boolean;

    constructor(map: MapboxMap) {
        this._map = map;
        this._folders = new Map <string, any>();

        const id = map._getMapId();
        const url = new URL(window.location.pathname, window.location.href).toString();
        this._storageName = `TP_${id}_${url}`;

        this._parametersInfo = new Map<string, ParameterInfo>();

        this._scrollUnblocked = false;

        this.initPane();

        // Keep global reference, making it possible to register parameters
        // without passing reference to TrackedParameters class
        // Needed purely for dev purposes where only one map is present
        global = this;
    }

    // Serialize pane state and write it to local storage
    dump() {
        if (this._scrollUnblocked) {
            const scrollTop = this._container.scrollTop;
            this._paneState.scrollTopRatio = scrollTop / this._container.scrollHeight;
        }

        const serialized = serialize(this._paneState);
        localStorage.setItem(this._storageName, serialized);
    }

    unfold() {
        this._paneState.folders.forEach((folderState) => {
            folderState.isFolded = false;
        });

        this._folders.forEach((folder) => {
            folder.expanded = true;
            folder.refresh();
        });

        this.dump();
    }

    resetToDefaults() {
        const doReset = () => {
            this._parametersInfo.forEach((elem, key) => {
                elem.containerObject[elem.parameterName] = cloneDeep(elem.defaultValue);

                // Update serializable state as well
                const folderName = key.slice(0, key.lastIndexOf("|"));
                const folder = this._paneState.folders.get(folderName);
                if (folder) {
                    folder.current[elem.parameterName] = cloneDeep(elem.defaultValue);
                }
            });
            this.checkDefaults();
            this._folders.forEach((folder) => {
                folder.refresh();
            });
        };

        // Workaround for tweakpane bug (int vs float color storage)
        doReset();
        doReset();

        this.dump();
    }

    checkDefaults() {
        const folderModCount = new Map<string, number>();

        for (const key of this._folders.keys()) {
            folderModCount.set(key, 0);
        }

        this._parametersInfo.forEach((parameterInfo, key) => {
            const isDefault = JSON.stringify(parameterInfo.defaultValue) === JSON.stringify(parameterInfo.containerObject[parameterInfo.parameterName]);

            const noSaveIndicator = parameterInfo.noSave ? "❗💾 " : "";
            parameterInfo.tpBinding.label = (isDefault ? "  " : "* ") + noSaveIndicator + parameterInfo.parameterName;

            const folderName = key.slice(0, key.lastIndexOf("|"));

            let scopes = folderName.split("_");
            scopes = scopes.slice(1, scopes.length);

            let folderIterName = "";
            for (const scope of scopes) {
                folderIterName += `_${scope}`;
                if (!isDefault) {
                    const prevCount = folderModCount.get(folderIterName);
                    if (prevCount !== undefined) {
                        folderModCount.set(folderIterName, prevCount + 1);
                    }
                }
            }
        });

        folderModCount.forEach((count, key) => {
            const folder = this._folders.get(key);
            if (folder) {
                if (key === "_") {
                    return;
                }
                const folderName = key.slice(key.lastIndexOf("_") + 1, key.length);
                if (count === 0) {
                    folder.title = `  ${folderName}`;
                } else {
                    folder.title = `* ${folderName}`;
                }
            }
        });

    }

    saveParameters() {
        if (!("showSaveFilePicker" in window)) {
            alert("File System Access API not supported, consider switching to recent versions of Chrome");
            return;
        }

        const opts = {
            types: [
                {
                    description: "Parameters file",
                    accept: {"text/plain": [".params"]}
                },
            ],
        };
        window.showSaveFilePicker(opts).then((fileHandle) => {
            return fileHandle.createWritable();
        }).then((writable) => {
            const serialized = serialize(this._paneState);
            return Promise.all([writable, writable.write(serialized)]);
        }).then(([writable, _]) => {
            writable.close();
        }).catch((err) => {
            console.error(err);
        });
    }

    loadParameters() {
        if (!("showSaveFilePicker" in window)) {
            alert("File System Access API not supported, consider switching to recent versions of chrome");
            return;
        }

        const opts = {
            types: [
                {
                    description: "Parameters file",
                    accept: {"text/plain": [".params"]}
                },
            ],
        };
        window.showOpenFilePicker(opts).then((fileHandles) => {
            return fileHandles[0].getFile();
        }).then((file) => {
            return file.text();
        }).then((fileData) => {
            const loadedPaneState = deSerializePaneParams(fileData);

            mergePaneParams(this._paneState, loadedPaneState);

            this._paneState.folders.forEach((folder, folderKey) => {
                for (const [parameterKey, value] of Object.entries(folder.current)) {
                    const fullParameterName = `${folderKey}|${parameterKey}`;
                    const paramInfo = this._parametersInfo.get(fullParameterName);
                    if (paramInfo && !paramInfo.noSave) {
                        paramInfo.containerObject[parameterKey] = cloneDeep(value);
                    }
                }

                const tpFolder = this._folders.get(folderKey);
                if (tpFolder) {
                    tpFolder.expanded = !folder.isFolded;
                }
            });

            this.checkDefaults();

            this._folders.forEach((folder) => {
                folder.refresh();
            });
        }).catch((err) => {
            console.error(err);
        });
    }

    initPane() {
        // Load state
        const serializedPaneState = localStorage.getItem(this._storageName);
        this._paneState = deSerializePaneParams(serializedPaneState);

        // Create containers for UI elements
        this._container = window.document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapbox-devtools';

        this._container.onwheel = () => {
            this._scrollUnblocked = true;
            this.dump();
        };

        this._container.onclick = () => {
            this._scrollUnblocked = true;
            this.dump();
        };

        this._container.onscroll = () => {
            if (this._scrollUnblocked) {
                this.dump();
            }
        };

        this._container.onscrollend = () => {
            if (this._scrollUnblocked) {
                this.dump();
            }
        };

        const positionContainer = this._map._controlPositions['top-right'];
        positionContainer.appendChild(this._container);

        const pane = new Pane({
            container: this._container,
            expanded: this._paneState.isMainPaneShown,
            title: 'devtools',
        });

        pane.on('fold', (e) => {
            this._paneState.isMainPaneShown = e.expanded;
            this.dump();
        });

        pane.addButton({
            title: 'Reset To Defaults'
        }).on('click', () => {
            this.resetToDefaults();
        });

        pane.addButton({
            title: 'Unfold'
        }).on('click', () => {
            this.unfold();
        });

        pane.addButton({
            title: 'Save'
        }).on('click', () => {
            this.saveParameters();
        });

        pane.addButton({
            title: 'Load'
        }).on('click', () => {
            this.loadParameters();
        });

        this._folders.set("_", pane);
    }

    createFoldersChainAndSelectScope(scope: Array<string>): {currentScope: any, fullScopeName: string } {
        assert(scope.length >= 1);

        // Iterate/create panes
        let currentScope: any = this._folders.get("_");
        let fullScopeName = "_";
        for (let i = 0; i < scope.length; ++i) {
            fullScopeName = scope.slice(0, i + 1).reduce((prev, cur) => { return `${prev}_${cur}`; }, "_");

            if (this._folders.has(fullScopeName)) {
                currentScope = this._folders.get(fullScopeName);
            } else {
                const folder = currentScope.addFolder({
                    title: `  ${scope[i]}`,
                    expanded: true,
                });

                this._folders.set(fullScopeName, folder);
                currentScope = folder;

                if (!this._paneState.folders.has(fullScopeName)) {
                    const folderObj = new FolderState();
                    this._paneState.folders.set(fullScopeName, folderObj);
                }

                const folderObj: FolderState = (this._paneState.folders.get(fullScopeName): any);
                currentScope.expanded = !folderObj.isFolded;

                currentScope.on('fold', (ev) => {
                    folderObj.isFolded = !ev.expanded;
                    this.dump();
                });

            }
        }

        return {currentScope, fullScopeName};
    }

    registerParameter(containerObject: Object, scope: Array<string>, name: string, description: ?Description, changeValueCallback: ?Function) {
        const {currentScope, fullScopeName} = this.createFoldersChainAndSelectScope(scope);

        const folderStateObj: FolderState = (this._paneState.folders.get(fullScopeName): any);

        // Full parameter name with scope prefix
        const fullParameterName = `${fullScopeName}|${name}`;

        if (!this._parametersInfo.has(fullParameterName)) {
            const defaultValue = cloneDeep(containerObject[name]);

            // Check if parameter should ignore (de)serialization
            const noSave = !!(description && description.noSave);

            if (!noSave && folderStateObj.current.hasOwnProperty(name)) {
                containerObject[name] = cloneDeep(folderStateObj.current[name]);
            } else {
                folderStateObj.current[name] = cloneDeep(containerObject[name]);
            }

            // Create binding to TweakPane UI
            const binding = currentScope.addBinding(containerObject, name, description);
            binding.on('change', (ev) => {
                folderStateObj.current[name] = cloneDeep(ev.value);
                this.dump();
                this.checkDefaults();
                if (changeValueCallback) { changeValueCallback(ev.value); }
            });

            this._parametersInfo.set(fullParameterName, new ParameterInfo(containerObject, name, defaultValue, noSave, binding));
        } else {
            console.log(`Parameter "${fullParameterName}" already registered`);
        }

        this.checkDefaults();

        if (!this._scrollUnblocked) {
            this._container.scrollTop = this._paneState.scrollTopRatio * this._container.scrollHeight;
        }
    }

    registerButton(scope: Array<string>, buttonTitle: string, onClick: Function) {
        const {currentScope} = this.createFoldersChainAndSelectScope(scope);

        // Add button to TweakPane UI
        const button = currentScope.addButton({title: buttonTitle});
        button.on('click', () => {
            onClick();
        });
    }
}
