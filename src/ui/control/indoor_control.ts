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

    _setButtonTitle(button: HTMLButtonElement, title: string) {
        if (!this._map) return;
        button.setAttribute('aria-label', title);
        button.innerHTML = `<strong>${title}</strong>`;
        if (button.firstElementChild) button.firstElementChild.setAttribute('title', title);
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
        const currentFloors = model.floors.sort((a, b) => a.levelOrder - b.levelOrder);

        if (oldModel) {
            Array.from(this._container.children).forEach(child => child.remove());
            this.addCurrentFloors(currentFloors);
        } else {
            this.addCurrentFloors(currentFloors);
        }
    }

    addCurrentFloors(floors: Array<IndoorControlLevel>) {
        for (const floor of floors) {
            const levelButton = this._createButton('mapboxgl-ctrl-level-button', () => {
                this._map._selectIndoorFloor(floor.id);
                // Update selected state of all buttons
                Array.from(this._container.children).forEach(button => {
                    button.classList.remove('mapboxgl-ctrl-level-button-selected');
                });
                levelButton.classList.add('mapboxgl-ctrl-level-button-selected');
            });
            this._setButtonTitle(levelButton, floor.shortName);
            // Add selected state if this is the currently selected level
            if (this._model && floor.id === this._model.selectedFloorId) {
                this._map._selectIndoorFloor(floor.id);
                levelButton.classList.add('mapboxgl-ctrl-level-button-selected');
            }
            this._container.append(levelButton);
        }
    }
}

export default IndoorControl;
