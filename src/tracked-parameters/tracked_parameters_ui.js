// @flow
import {Pane} from 'tweakpane';
import cloneDeep from 'lodash.clonedeep';
import serialize from 'serialize-to-js';
import assert from 'assert';
import window from '../../src/util/window.js';

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

    constructor() {
        this.isMainPaneShown = false;
        this.folders = new Map < string, FolderState >();
    }
}

function mergePaneParams(dest: PaneState, src: PaneState) {
    dest.isMainPaneShown = src.isMainPaneShown;

    const mergedFolderKeys = [...new Set([...src.folders.keys(), ...dest.folders.keys()])];

    for (const key of mergedFolderKeys) {
        const srcFolder = src.folders.get(key);
        const destFolder = dest.folders.get(key);
        if (srcFolder && destFolder) {
            for (const parameterKey of Object.keys(srcFolder.current)) {
                destFolder.current[parameterKey] = cloneDeep(srcFolder.current[parameterKey]);
            }

            destFolder.isFolded = srcFolder.isFolded;
        } else if (srcFolder) {
            dest.folders.set(key, srcFolder);
        }
    }
}

function deSerializePaneParams(input: string): PaneState {
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

export function registerParameter(object: Object, scope: Array<string>, name: string, description: Object, onChange: Function) {
    console.warn(`Dev only "registerParameter" call. For production consider replacing with tracked parameters container method.`);

    global.registerParameter(object, scope, name, description, onChange);
}

// For fast prototyping in case of only one map present
let global: TrackedParameters;

// Reference to actual object and default values
class ParameterInfo {
    containerObject: Object;
    parameterName: string;
    defaultValue: any;

    constructor(object: Object, parameterName: string, defaultValue: any) {
        this.containerObject = object;
        this.parameterName = parameterName;
        this.defaultValue = defaultValue;
    }
}

// Tracked parameters container
export class TrackedParameters {
    // All TweakPane scopes
    _folders: Map<string, any>;

    // For (de)serialization
    _paneState: PaneState;

    // Store container object reference for each parameter
    // Key = Scopes + parameter name
    _parametersInfo: Map<string, ParameterInfo>;

    _storageName: string;

    constructor(id: string, container: HTMLElement) {

        this._folders = new Map < string, any >();

        const location = window.location;
        const url = location.toString().split("?")[0].split("#")[0];

        this._parametersInfo = new Map < string, ParameterInfo >();

        this._storageName = `TP_${id}_${url}`;

        this.initPane(container);

        // Keep global reference, making it possible to register parameters
        // without passing reference to TrackedParameters class
        // Needed purely for dev purposes where only one map is present
        global = this;
    }

    // Serialize pane state and write it to local storage
    dump() {
        const serialized = serialize(this._paneState);
        window.localStorage.setItem(this._storageName, serialized);
    }

    addPaneContainersToDocument(container: HTMLElement): Array<HTMLDivElement> {
        const paneContainer = window.document.createElement("div");
        const toggleContainer = window.document.createElement("div");
        paneContainer.className = `mapboxEmbeddedConfig`;
        toggleContainer.className = `mapboxToggleConfig`;

        const styles = window.document.getElementsByTagName("head")[0].getElementsByTagName("style");
        const mapboxStyle = styles.namedItem("mapboxEmbeddedConfigStyle");

        if (!mapboxStyle) {
            const styleElement = window.document.createElement("style");
            styleElement.id = "mapboxEmbeddedConfigStyle";
            styleElement.appendChild(window.document.createTextNode(
                `
            .mapboxToggleConfig {
                position: absolute;
                bottom:3px;
                left:100px;
                z-index: 100;
            }
    
            .mapboxToggleConfig .tp-lblv_v {
                width: 25px;
            }
    
            .mapboxEmbeddedConfig {
                position: absolute;
                top:20%;
                right:20px;
                max-height: 75%;
                overflow-y:auto;
                z-index: 100;
            }
    
            .mapboxEmbeddedConfig::-webkit-scrollbar {
                width: 10px;
                height: 10px;
            }
            .mapboxEmbeddedConfig::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 10px;
            }
            .mapboxEmbeddedConfig::-webkit-scrollbar-thumb {
                background: rgba(110, 110, 110);
                border-radius: 10px;
            }
            .mapboxEmbeddedConfig::-webkit-scrollbar-thumb:hover {
                background-color: rgba(90, 90, 90);
            }
            `
            ));
            window.document.getElementsByTagName("head")[0].appendChild(styleElement);
        }

        container.appendChild(paneContainer);
        container.appendChild(toggleContainer);
        return [paneContainer, toggleContainer];
    }

    resetToDefaults() {
        this._parametersInfo.forEach((elem) => {
            elem.containerObject[elem.parameterName] = elem.defaultValue;
        });

        this._folders.forEach((folder) => {
            folder.expanded = true;
            folder.refresh();
        });
    }

    saveParameters() {
        if (!("showSaveFilePicker" in window)) {
            window.alert("File System Access API not supported, consider switching to recent versions of chrome");
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
            window.alert("File System Access API not supported, consider switching to recent versions of chrome");
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
                    if (paramInfo) {
                        paramInfo.containerObject[parameterKey] = cloneDeep(value);
                    }
                }

                const tpFolder = this._folders.get(folderKey);
                if (tpFolder) {
                    tpFolder.expanded = !folder.isFolded;
                }
            });

            this._folders.forEach((folder) => {
                folder.refresh();
            });
        }).catch((err) => {
            console.error(err);
        });
    }

    initPane(container: HTMLElement) {
        // Load state
        const serializedPaneState = window.localStorage.getItem(this._storageName);
        this._paneState = deSerializePaneParams(serializedPaneState);

        // Create containers for UI elements
        const [paneContainer, toggleContainer] = this.addPaneContainersToDocument(container);

        const togglePaneParams = {
            debug: true,
        };
        togglePaneParams.debug = this._paneState.isMainPaneShown;

        const togglePane = new Pane({container: toggleContainer});
        const debugToggle = togglePane.addBinding(togglePaneParams, 'debug');

        const pane = new Pane({
            container: paneContainer,
            title: 'Engine parameters',
        });

        const resetToDefaultsButton = pane.addButton({
            title: 'Reset To Defaults'
        });

        resetToDefaultsButton.on('click', () => {
            this.resetToDefaults();
        });

        const saveButton = pane.addButton({
            title: 'Save'
        });

        saveButton.on('click', () => {
            this.saveParameters();
        });

        const loadButton = pane.addButton({
            title: 'Load'
        });

        loadButton.on('click', () => {
            this.loadParameters();
        });

        pane.hidden = !this._paneState.isMainPaneShown;

        debugToggle.on('change', (ev) => {
            pane.hidden = !ev.value;
            this._paneState.isMainPaneShown = !pane.hidden;
            this.dump();
        });

        this._folders.set("_", pane);
    }

    registerParameter(containerObject: Object, scope: Array<string>, name: string, description: ?Object, changeValueCallback: ?Function) {
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
                    title: scope[i],
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

        const folderObj: FolderState = (this._paneState.folders.get(fullScopeName): any);

        // Full parameter name with scope prefix
        const fullParameterName = `${fullScopeName}|${name}`;

        if (!this._parametersInfo.has(fullParameterName)) {
            this._parametersInfo.set(fullParameterName, new ParameterInfo(containerObject, name, cloneDeep(containerObject[name])));
        }

        if (folderObj.current.hasOwnProperty(name)) {
            containerObject[name] = cloneDeep(folderObj.current[name]);
        } else {
            folderObj.current[name] = cloneDeep(containerObject[name]);
        }

        // Create binding to TweakPane UI
        const binding = currentScope.addBinding(containerObject, name, description);
        binding.on('change', (ev) => {
            folderObj.current[name] = cloneDeep(ev.value);
            this.dump();
            if (changeValueCallback) { changeValueCallback(ev.value); }
        });
    }
}
