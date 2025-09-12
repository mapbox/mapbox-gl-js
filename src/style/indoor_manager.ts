import {bindAll} from '../util/util';
import {Event, Evented, ErrorEvent} from '../util/evented';
import {type IndoorData, IndoorDataQuery} from './indoor_data_query';
import IndoorFloorSelectionState from './indoor_floor_selection_state';

import type {Map} from '../ui/map';
import type Style from './style';

type IndoorEvents = {
    'indoorupdate': {
        selectedFloorId: string;
        showBuildingsOverview: boolean;
        floors: Array<{
            id: string;
            name: string;
            shortName: string;
            levelOrder: number;
        }>;
    };
};

export default class IndoorManager extends Evented<IndoorEvents> {
    _map: Map;
    _scope: string | null;
    _floorSelectionState: IndoorFloorSelectionState | null;
    _indoorDataQuery: IndoorDataQuery | null;

    constructor(map: Map) {
        super();

        bindAll([
            '_onLoad',
            '_onMove',
        ], this);

        this._map = map;
        this._floorSelectionState = new IndoorFloorSelectionState();
        this._indoorDataQuery = null;
        this._map.on('load', this._onLoad);
        this._map.on('move', this._onMove);
    }

    destroy() {
        this._map.off('load', this._onLoad);
        this._map.off('move', this._onMove);
        this._map = null;
        this._floorSelectionState = null;
    }

    selectFloor(floorId: string | null) {
        const hasChanges = this._floorSelectionState.setFloorId(floorId);
        if (hasChanges) {
            this._updateIndoorConfig(true);
            this._updateIndoorSelector();
        }
    }

    setShowBuildingsOverview(showBuildingsOverview: boolean) {
        this._floorSelectionState.setShowBuildingsOverview(showBuildingsOverview);
        this._updateIndoorConfig(false);
        this._updateIndoorSelector();
    }

    _onLoad() {
        this._map.style.forEachFragmentStyle((style: Style) => {
            // Find a style import with an indoor property
            if (style.stylesheet.indoor) {
                if (!this._indoorDataQuery) {
                    this._scope = style.scope;
                    this._indoorDataQuery = new IndoorDataQuery();
                } else {
                    this.fire(new ErrorEvent(new Error('Multiple indoor map styles detected, simultaneous usage is not allowed currently.')));
                }
            }
        });

        this._map._addIndoorControl();
        this._queryIndoor();
    }

    _onMove() {
        this._queryIndoor();
    }

    _queryIndoor() {
        if (!this._indoorDataQuery || !this._map.isStyleLoaded()) {
            return;
        }

        // Starting from this zoom level, the data query is executed to retrieve the data before it is necessary to display.
        const dataQueryMinimumZoom = 15.0;
        // Starting from this zoom level, the data is displayed.
        const indoorDisplayMinimumZoom = 16.0;

        if (this._map.transform.zoom < dataQueryMinimumZoom) {
            this._clearIndoorData();
            return;
        }

        const indoorData: IndoorData | null = this._indoorDataQuery.execute(this._map);
        if (!indoorData || indoorData.floors.length === 0 || this._map.transform.zoom < indoorDisplayMinimumZoom) {
            this._clearIndoorData();
            return;
        }

        if (this._floorSelectionState.hasBuildingChanged(indoorData)) {
            if (!indoorData.building && this._floorSelectionState.getActiveFloors().length <= 0) {
                this._clearIndoorData();
                return;
            }

            this._setIndoorData(indoorData);

            if (indoorData.building) {
                this._updateIndoorSelector();
            }
        } else {
            this._setIndoorData(indoorData);
        }
    }

    _setIndoorData(indoorData: IndoorData) {
        const hasChanges = this._floorSelectionState.setIndoorData(indoorData);
        if (hasChanges) {
            this._updateIndoorConfig();
        }
    }

    _clearIndoorData() {
        if (this._floorSelectionState.isEmpty()) {
            return;
        }

        this._floorSelectionState.reset();
        this._updateIndoorSelector();
        this._map.setConfigProperty(this._scope, "activeFloors", ["literal", []]);
    };

    _updateIndoorSelector() {
        const currentBuildingSelection = this._floorSelectionState.getCurrentBuildingSelection();
        const floors = currentBuildingSelection.floors.map((floor) => ({
            id: floor.id,
            name: floor.name,
            shortName: floor.zIndex.toString(),
            levelOrder: floor.zIndex
        }));

        this.fire(new Event('indoorupdate', {
            selectedFloorId: currentBuildingSelection.selectedFloorId,
            showBuildingsOverview: this._floorSelectionState.getShowBuildingsOverview(),
            floors
        }));
    }

    // eslint-disable-next-line no-warning-comments
    // TODO: Replace use of config with the style expressions
    _updateIndoorConfig(isExplicitSelection: boolean = false) {
        if (this._floorSelectionState.getShowBuildingsOverview()) {
            this._map.setConfigProperty(this._scope, "activeFloors", ["literal", []]);
            return;
        }

        const activeFloors = this._floorSelectionState.getActiveFloors(isExplicitSelection);
        const activeFloorsIds = activeFloors.map(floor => floor.id) || [];
        this._map.setConfigProperty(this._scope, "activeFloors", ["literal", activeFloorsIds]);
    }
}
