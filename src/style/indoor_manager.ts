import {bindAll} from '../util/util';
import {Event, Evented, ErrorEvent} from '../util/evented';
import {type IndoorData, IndoorDataQuery} from './indoor_data_query';
import IndoorFloorSelectionState from './indoor_floor_selection_state';

import type {Map} from '../ui/map';
import type {SchemaSpecification} from '../style-spec/types';
import type Style from './style';

type IndoorEvents = {
    'indoorupdate': {
        selectedFloorId: string;
        floors: Array<{
            id: string;
            name: string;
            shortName: string;
            levelOrder: number;
        }>;
    };
};

const indoorSchemaExtension: SchemaSpecification = {
    "mbx-indoor-level-selected": {
        "default": ["literal", []]
    },
};

export function expandSchemaWithIndoor(schema?: SchemaSpecification): SchemaSpecification {
    schema = schema ? schema : {};
    return Object.assign(schema, indoorSchemaExtension);
}

export default class IndoorManager extends Evented<IndoorEvents> {
    _map: Map;
    _floorSelectionState: IndoorFloorSelectionState | null;
    _scope: string | null;
    _indoorDataQuery: IndoorDataQuery | null;

    constructor(map: Map) {
        super();

        bindAll([
            '_onLoad',
            '_onMove',
        ], this);

        this._map = map;
        this._floorSelectionState = new IndoorFloorSelectionState();
        this._queryIndoor();
        this._map.on('load', this._onLoad);
        this._map.on('move', this._onMove);
    }

    destroy() {
        this._map.off('load', this._onLoad);
        this._map.off('move', this._onMove);
        this._map = null;
        this._floorSelectionState = null;
    }

    // Prepare IndoorManager on the map load.
    // If the style contains any fragment with "indoor" property
    // the manager gets automatically enabled and it starts querying features.
    _onLoad() {
        this._map.style.forEachFragmentStyle((style: Style) => {
            // Find a style with an indoor property
            if (style.stylesheet.indoor) {
                if (!this._indoorDataQuery) {
                    this._scope = style.scope;
                    this._indoorDataQuery = new IndoorDataQuery(this._scope);
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

        const minimumIndoorZoom = 16.0;
        if (this._map.transform.zoom < minimumIndoorZoom) {
            this._clearIndoorData();
            return;
        }

        const indoorData: IndoorData | null = this._indoorDataQuery.execute(this._map);
        if (!indoorData || indoorData.floors.length === 0) {
            this._clearIndoorData();
            return;
        }

        if (this._floorSelectionState.getActiveFloors().length === 0) {
            this._selectFloors(indoorData);
        }

        // If the building has changed, update the indoor selector and selectedBuildingId
        if (this._floorSelectionState.hasBuildingChanged(indoorData)) {
            this._selectFloors(indoorData);
            this._updateIndoorSelector();
        }
    }

    _selectFloors(indoorData: IndoorData) {
        if (indoorData.building) {
            this._floorSelectionState.setIndoorData(indoorData);
            this._updateUI();
        } else {
            if (this._floorSelectionState.getActiveFloors().length > 0) {
                return;
            }

            this._clearIndoorData();
        }
    }

    _clearIndoorData() {
        this._floorSelectionState.reset();
        this._updateIndoorSelector();
        this._map.setConfigProperty(this._scope, "mbx-indoor-level-selected", ["literal", []]);
    };

    _updateIndoorSelector() {
        const currentBuildingSelection = this._floorSelectionState.getCurrentBuildingSelection();
        const floors = currentBuildingSelection.floors.map((floor) => ({
            id: floor.properties.id as string,
            name: floor.properties.name as string,
            shortName: floor.properties.z_index as string,
            levelOrder: floor.properties.z_index as number
        }));

        this.fire(new Event('indoorupdate', {
            selectedFloorId: currentBuildingSelection.selectedFloorId,
            floors
        }));
    }

    _updateUI() {
        this._updateIndoorConfig();
        this._updateIndoorSelector();
    }

    // eslint-disable-next-line no-warning-comments
    // TODO: Replace use of config with the style expressions
    _updateIndoorConfig() {
        const activeFloors = this._floorSelectionState.getActiveFloors().map(floor => floor.properties.id as string) || [];
        this._map.setConfigProperty(this._scope, "mbx-indoor-level-selected", ["literal", activeFloors]);
    }

    // Selects a level of based on a provided ID.
    selectFloor(floorId: string | null) {
        this._floorSelectionState.setFloorId(floorId);
        this._updateIndoorConfig();
    }
}
