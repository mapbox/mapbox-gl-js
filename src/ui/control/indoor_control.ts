import * as DOM from '../../util/dom';
import {bindAll} from '../../util/util';

import type {Map, ControlPosition, IControl} from '../map';
import type {IndoorControlModel, IndoorControlFloor} from '../../style/indoor_data';

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
        bindAll(['_onIndoorUpdate'], this);
    }

    onAdd(map: Map): HTMLElement {
        this._map = map;
        this._container = DOM.create('div', 'mapboxgl-ctrl mapboxgl-ctrl-group');
        if (this._map.style) {
            this._map.style.indoorManager.on('selector-update', (controlModel: IndoorControlModel) => this._onIndoorUpdate(controlModel));
        }
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

        if (this._map && this._map.style) {
            this._map.style.indoorManager.off('selector-update', this._onIndoorUpdate);
            this._map = null;
        }
    }

    getDefaultPosition(): ControlPosition {
        return 'right';
    }

    _onIndoorUpdate(model: IndoorControlModel | null) {
        if (!model || !model.floors) {
            this._model = model;
            this._container.style.display = 'none';
            return;
        }

        const oldModel = this._model;
        this._model = model;
        this._container.style.display = 'inline-block';
        this._container.style.borderRadius = '8px';

        if (oldModel) {
            Array.from(this._container.children).forEach(child => child.remove());
        }

        if (model.floors.length > 0) {
            this.addBuildingsToggleButton();
            this.addCurrentFloors(model.floors, model.activeFloorsVisible);
            this._updateBuildingsButtonState();
        }
    }

    addBuildingsToggleButton() {
        const buildingsButton = this._createButton('mapboxgl-ctrl-buildings-toggle', () => {
            const map = this._map;
            if (this._model && map) {
                map._setIndoorActiveFloorsVisibility(!this._model.activeFloorsVisible);
            }
        });
        DOM.create('span', `mapboxgl-ctrl-icon`, buildingsButton).setAttribute('aria-hidden', 'true');

        buildingsButton.classList.add('mapboxgl-ctrl-level-button', 'mapboxgl-ctrl-buildings-toggle');

        if (this._model && !this._model.activeFloorsVisible) {
            buildingsButton.classList.add('mapboxgl-ctrl-level-button-selected');
        }

        this._container.append(buildingsButton);
        this._createSeparator();
    }

    _updateBuildingsButtonState() {
        const buildingsButton = this._container.querySelector('.mapboxgl-ctrl-buildings-toggle');
        if (buildingsButton && this._model) {
            if (!this._model.activeFloorsVisible) {
                buildingsButton.classList.add('mapboxgl-ctrl-level-button-selected');
            } else {
                buildingsButton.classList.remove('mapboxgl-ctrl-level-button-selected');
            }
        }
    }

    addCurrentFloors(floors: Array<IndoorControlFloor>, showSelectedFloor: boolean) {
        for (let i = 0; i < floors.length; i++) {
            const floor = floors[i];
            const levelButton = this._createButton('mapboxgl-ctrl-level-button', () => {
                this._map._selectIndoorFloor(floor.id);
            });

            const floorName = (floor.name || '').trim();
            const zIndexText = floor.zIndex.toString();
            const buttonTitle = floorName ? Array.from(floorName).slice(0, 3).join('') : zIndexText;
            this._setButtonTitle(levelButton, buttonTitle);

            if (this._model && floor.id === this._model.selectedFloorId && showSelectedFloor) {
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
