import * as DOM from '../../util/dom';
import {bindAll} from '../../util/util';

import type {Map, ControlPosition, IControl} from '../map';
import type {IndoorControlModel} from '../../style/indoor_data';
const VISIBLE_FLOORS = 3;

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
    _visibleFloorStart: number;

    constructor() {
        bindAll(['_onIndoorUpdate', '_onStyleData', '_scrollUp', '_scrollDown'], this);
        this._visibleFloorStart = 0;
    }
    onAdd(map: Map): HTMLElement {
        this._map = map;
        this._container = DOM.create('div', 'mapboxgl-ctrl mapboxgl-ctrl-group');
        this._container.style.display = 'none';
        this._map.on('styledata', this._onStyleData);
        this._updateConnection();
        return this._container;
    }
    _onStyleData() {
        this._updateConnection();
    }
    _updateConnection() {
        if (this._map && this._map.style && this._map.style.indoorManager) {
            const manager = this._map.style.indoorManager;
            manager.off('selector-update', this._onIndoorUpdate);
            manager.on('selector-update', this._onIndoorUpdate);
            this._onIndoorUpdate(manager.getControlState());
        }
    }
    _createButton(className: string, fn: (e: Event) => unknown): HTMLButtonElement {
        const a = DOM.create('button', className, this._container);
        a.type = 'button';
        a.addEventListener('click', fn);
        return a;
    }
    _setButtonTitle(button: HTMLButtonElement, title: string) {
        button.setAttribute('aria-label', title);
        button.textContent = title;
    }
    onRemove() {
        if (this._container) {
            this._container.remove();
        }
        if (this._map) {
            this._map.off('styledata', this._onStyleData);
            if (this._map.style) {
                this._map.style.indoorManager.off('selector-update', this._onIndoorUpdate);
            }
            this._map = null;
        }
    }
    getDefaultPosition(): ControlPosition {
        return 'top-right';
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

        const floorsChanged = !oldModel || oldModel.floors.length !== model.floors.length || oldModel.floors.some((f, i) => f.id !== model.floors[i].id);

        if (floorsChanged) {
            this._visibleFloorStart = 0;
        }

        if (model.selectedFloorId) {
            const selectedIndex = model.floors.findIndex(f => f.id === model.selectedFloorId);
            if (selectedIndex !== -1) {
                if (selectedIndex < this._visibleFloorStart) {
                    this._visibleFloorStart = selectedIndex;
                } else if (selectedIndex >= this._visibleFloorStart + VISIBLE_FLOORS) {
                    this._visibleFloorStart = selectedIndex - (VISIBLE_FLOORS - 1);
                }
            }
        }

        this._render();
    }

    _render() {
        if (!this._container || !this._model || !this._model.floors) return;

        this._container.innerHTML = '';
        const floors = this._model.floors;
        const totalFloors = floors.length;

        if (totalFloors > VISIBLE_FLOORS) {
            const upButton = this._createButton('mapboxgl-ctrl-arrow-up', this._scrollUp);
            if (this._visibleFloorStart === 0) {
                upButton.disabled = true;
            }
            DOM.create('span', 'mapboxgl-ctrl-icon', upButton).setAttribute('aria-hidden', 'true');
            this._container.appendChild(upButton);
        }

        const visibleFloors = floors.slice(this._visibleFloorStart, this._visibleFloorStart + VISIBLE_FLOORS);
        visibleFloors.forEach(floor => {
            const levelButton = this._createButton('mapboxgl-ctrl-level-button', () => {
                if (this._model && this._model.selectedFloorId === floor.id) return;
                if (this._map) {
                    this._map._setIndoorActiveFloorsVisibility(true);
                    this._map._selectIndoorFloor(floor.id);
                }
            });
            const floorName = (floor.name || '').trim();
            const zIndexText = floor.zIndex.toString();
            const buttonTitle = floorName ? Array.from(floorName).slice(0, 3).join('') : zIndexText;
            this._setButtonTitle(levelButton, buttonTitle);

            if (this._model && floor.id === this._model.selectedFloorId) {
                levelButton.classList.add('mapboxgl-ctrl-level-button-selected');
            }
            this._container.appendChild(levelButton);
        });

        if (totalFloors > VISIBLE_FLOORS) {
            const downButton = this._createButton('mapboxgl-ctrl-arrow-down', this._scrollDown);
            if (this._visibleFloorStart + VISIBLE_FLOORS >= totalFloors) {
                downButton.disabled = true;
            }
            DOM.create('span', 'mapboxgl-ctrl-icon', downButton).setAttribute('aria-hidden', 'true');
            this._container.appendChild(downButton);
        }
    }

    _scrollUp() {
        if (this._visibleFloorStart > 0) {
            this._visibleFloorStart--;
            this._render();
        }
    }

    _scrollDown() {
        if (this._model && this._model.floors && this._visibleFloorStart + VISIBLE_FLOORS < this._model.floors.length) {
            this._visibleFloorStart++;
            this._render();
        }
    }
}
export default IndoorControl;
