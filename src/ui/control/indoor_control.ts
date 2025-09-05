import * as DOM from '../../util/dom';
import {bindAll} from '../../util/util';

import type {Map, ControlPosition, IControl} from '../map';

type IndoorControlLevel = {
    id: string;
    name: string;
    shortName: string;
    levelOrder: number;
};

type IndoorControlModel = {
    selectedFloorId: string;
    floors: Array<IndoorControlLevel>;
};

/**
 * An `IndoorControl` control presents the map's indoor floors.
 * Add this control to a map using {@link Map#addControl}.
 *
 * @implements {IControl}
 * @experimental
 * @example
 * const map = new mapboxgl.Map()
 *     .addControl(new mapboxgl.IndoorControl());
 */
class IndoorControl implements IControl {
    _map: Map | null;
    _container: HTMLElement | null;
    _model: IndoorControlModel | null;

    constructor() {
        bindAll([
            '_onIndoorUpdate'
        ], this);
    }

    onAdd(map: Map): HTMLElement {
        this._map = map;
        this._container = DOM.create('div', 'mapboxgl-ctrl mapboxgl-ctrl-group');

        this._map.indoor.on('indoorupdate', (event) => this._onIndoorUpdate({
            selectedFloorId: event.selectedFloorId,
            floors: event.floors
        }));

        return this._container;
    }

    _createButton(className: string, fn: (e: Event) => unknown): HTMLButtonElement {
        const a = DOM.create('button', className, this._container);
        a.type = 'button';
        a.addEventListener('click', fn);
        return a;
    }

    _createSeparator(): HTMLElement {
        return DOM.create('div', 'mapboxgl-ctrl-separator', this._container);
    }

    _setButtonTitle(button: HTMLButtonElement, title: string) {
        if (!this._map) return;
        button.setAttribute('aria-label', title);
        button.textContent = title;
    }

    onRemove() {
        if (this._container) {
            this._container.remove();
        }

        if (this._map && this._map.indoor) {
            this._map.indoor.off('indoorupdate', this._onIndoorUpdate);
            this._map = null;
        }
    }

    getDefaultPosition(): ControlPosition {
        return 'right';
    }

    _onIndoorUpdate(model: IndoorControlModel | null) {
        if (!model || !model.floors) {
            this._container.style.display = 'none';
            return;
        }

        const oldModel = this._model;
        this._model = model;
        this._container.style.display = 'inline-block';
        this._container.style.borderRadius = '8px';
        const currentFloors = model.floors.sort((a, b) => b.levelOrder - a.levelOrder);

        if (oldModel) {
            Array.from(this._container.children).forEach(child => child.remove());
            this.addCurrentFloors(currentFloors);
        } else {
            this.addCurrentFloors(currentFloors);
        }
    }

    addCurrentFloors(floors: Array<IndoorControlLevel>) {
        for (let i = 0; i < floors.length; i++) {
            const floor = floors[i];
            const levelButton = this._createButton('mapboxgl-ctrl-level-button', () => {
                this._map._selectIndoorFloor(floor.id);
                if (this._model) {
                    this._model.selectedFloorId = floor.id;
                }
                Array.from(this._container.children).forEach(child => {
                    if (child.classList.contains('mapboxgl-ctrl-level-button')) {
                        child.classList.remove('mapboxgl-ctrl-level-button-selected');
                    }
                });
                levelButton.classList.add('mapboxgl-ctrl-level-button-selected');
            });

            this._setButtonTitle(levelButton, floor.shortName);

            if (this._model && floor.id === this._model.selectedFloorId) {
                levelButton.classList.add('mapboxgl-ctrl-level-button-selected');
            }

            this._container.append(levelButton);

            // Add separator after each button except the last one
            if (i < floors.length - 1) {
                this._createSeparator();
            }
        }
    }
}

export default IndoorControl;
