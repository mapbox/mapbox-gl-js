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
    _lastSelectedFloorId: string | null;

    constructor() {
        bindAll(['_onIndoorUpdate', '_onStyleData', '_scrollUp', '_scrollDown', '_toggleIndoor'], this);
        this._visibleFloorStart = 0;
        this._lastSelectedFloorId = null;
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
        if (!model || !model.floors || model.floors.length === 0) {
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
            this._lastSelectedFloorId = null;
        }

        if (model.selectedFloorId) {
            const selectionChanged = model.selectedFloorId !== this._lastSelectedFloorId;

            if (selectionChanged || floorsChanged) {
                const selectedIndex = model.floors.findIndex(f => f.id === model.selectedFloorId);
                if (selectedIndex !== -1) {
                    const totalFloors = model.floors.length;
                    let minVisible, maxVisible;

                    if (totalFloors <= VISIBLE_FLOORS + 2) {
                        minVisible = 0;
                        maxVisible = totalFloors - 1;
                    } else {
                        const isAtTop = this._visibleFloorStart === 0;
                        const isAtBottom = this._visibleFloorStart >= totalFloors - VISIBLE_FLOORS;

                        if (isAtTop) {
                            minVisible = 0;
                            maxVisible = VISIBLE_FLOORS;
                        } else if (isAtBottom) {
                            minVisible = totalFloors - VISIBLE_FLOORS - 1;
                            maxVisible = totalFloors - 1;
                        } else {
                            minVisible = this._visibleFloorStart;
                            maxVisible = this._visibleFloorStart + VISIBLE_FLOORS - 1;
                        }
                    }

                    if (selectedIndex < minVisible) {
                        this._visibleFloorStart = selectedIndex;
                    } else if (selectedIndex > maxVisible) {
                        this._visibleFloorStart = selectedIndex - (VISIBLE_FLOORS - 1);
                    }
                }
            }
            this._lastSelectedFloorId = model.selectedFloorId;
        }

        this._render();
    }

    _render() {
        if (!this._container || !this._model || !this._model.floors) return;

        this._container.innerHTML = '';

        // Add Toggle Button
        const toggleButton = this._createButton('mapboxgl-ctrl-indoor-toggle', this._toggleIndoor);
        const toggleIcon = DOM.create('span', 'mapboxgl-ctrl-icon', toggleButton);
        toggleIcon.setAttribute('aria-hidden', 'true');

        if (!this._model.activeFloorsVisible) {
            toggleButton.classList.add('mapboxgl-ctrl-level-button-selected');
        }
        this._container.appendChild(toggleButton);

        const floors = this._model.floors;
        const totalFloors = floors.length;

        // If we can fit all floors in the space of (Arrow + 3 Floors + Arrow = 5 slots), do it.
        if (totalFloors <= VISIBLE_FLOORS + 2) {
            floors.forEach(floor => this._createFloorButton(floor));
            return;
        }

        const isAtTop = this._visibleFloorStart === 0;
        const isAtBottom = this._visibleFloorStart >= totalFloors - VISIBLE_FLOORS;

        // Top Button
        if (isAtTop) {
            this._createFloorButton(floors[0]);
        } else {
            const upButton = this._createButton('mapboxgl-ctrl-arrow-up', this._scrollUp);
            DOM.create('span', 'mapboxgl-ctrl-icon', upButton).setAttribute('aria-hidden', 'true');
            this._container.appendChild(upButton);
        }

        // Middle Floors
        let middleFloors: {id: string; name: string; zIndex: number}[] = [];
        if (isAtTop) {
            middleFloors = floors.slice(1, 1 + VISIBLE_FLOORS);
        } else if (isAtBottom) {
            middleFloors = floors.slice(this._visibleFloorStart - 1, this._visibleFloorStart + VISIBLE_FLOORS - 1);
        } else {
            middleFloors = floors.slice(this._visibleFloorStart, this._visibleFloorStart + VISIBLE_FLOORS);
        }

        middleFloors.forEach(floor => this._createFloorButton(floor));

        // Bottom Button
        if (isAtBottom) {
            this._createFloorButton(floors[totalFloors - 1]);
        } else {
            const downButton = this._createButton('mapboxgl-ctrl-arrow-down', this._scrollDown);
            DOM.create('span', 'mapboxgl-ctrl-icon', downButton).setAttribute('aria-hidden', 'true');
            this._container.appendChild(downButton);
        }
    }

    _createFloorButton(floor: {id: string; name: string; zIndex: number}) {
        const levelButton = this._createButton('mapboxgl-ctrl-level-button', () => {
            const floorId = floor.id;
            // If the floor is already selected, do nothing.
            if (this._model && this._model.selectedFloorId === floorId && this._model.activeFloorsVisible) return;

            if (this._map) {
                if (this._model && !this._model.activeFloorsVisible && this._map.style && this._map.style.indoorManager) {
                    this._map.style.indoorManager.setActiveFloorsVisibility(true);
                }
                this._map._selectIndoorFloor(floorId);
            }
        });
        const floorName = (floor.name || '').trim();
        const zIndexText = floor.zIndex.toString();
        const buttonTitle = floorName ? Array.from(floorName).slice(0, 3).join('') : zIndexText;
        this._setButtonTitle(levelButton, buttonTitle);

        if (this._model && this._model.activeFloorsVisible && floor.id === this._model.selectedFloorId) {
            levelButton.classList.add('mapboxgl-ctrl-level-button-selected');
        }
        if (this._container) {
            this._container.appendChild(levelButton);
        }
    }

    _toggleIndoor() {
        if (this._map && this._map.style && this._map.style.indoorManager && this._model) {
            if (this._model.activeFloorsVisible) {
                this._map.style.indoorManager.setActiveFloorsVisibility(false);
            }
        }
    }

    _scrollUp() {
        if (this._visibleFloorStart > 0) {
            this._visibleFloorStart--;
            if (this._visibleFloorStart === 1) {
                this._visibleFloorStart = 0;
            }
            const floors = (this._model && this._model.floors) || [];
            if (floors.length > VISIBLE_FLOORS) {
                const maxStart = floors.length - VISIBLE_FLOORS;
                if (this._visibleFloorStart === maxStart - 1) {
                    this._visibleFloorStart = maxStart - 2;
                }
            }
            this._render();
        }
    }

    _scrollDown() {
        if (this._model && this._model.floors) {
            const maxStart = this._model.floors.length - VISIBLE_FLOORS;
            if (this._visibleFloorStart < maxStart) {
                this._visibleFloorStart++;
                if (this._visibleFloorStart === 1) {
                    this._visibleFloorStart = 2;
                }
                if (this._visibleFloorStart === maxStart - 1) {
                    this._visibleFloorStart = maxStart;
                }

                if (this._visibleFloorStart > maxStart) {
                    this._visibleFloorStart = maxStart;
                }

                this._render();
            }
        }
    }
}
export default IndoorControl;
