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
        this._map.indoor.off('load', this._onLoad);
        this._map.indoor.off('move', this._onMove);
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

        if (this._map.transform.zoom < 16.0) {
            this._clearIndoorData();
            return;
        }

        const indoorData: IndoorData | null = this._indoorDataQuery.execute(this._map);
        if (!indoorData || indoorData.floors.length === 0) {
            this._clearIndoorData();
            return;
        }

        if (!this._floorSelectionState.getSelectedFloorId()) {
            this._map._addIndoorControl();
        }

        this._selectFloors(indoorData);
    }

    _selectFloors(indoorData: IndoorData) {
        if (indoorData.building) {
            this._floorSelectionState.setBuildingId(indoorData.building.properties.id as string);
            this._floorSelectionState.setFloors(indoorData.floors);
            this._updateUI();
        } else {
            // Keep the current floor until it's gone from viewport  as we may have just encounter a hole or other big space near the current building
            // That way it means less flickering in some cases where it's a space between several buildings
            const selectedFloorId = this._floorSelectionState.getSelectedFloorId();
            if (selectedFloorId && indoorData.floors.some(floor => floor.properties.id === selectedFloorId)) {
                return;
            }

            this._clearIndoorData();

        }
    }

    _clearIndoorData() {
        this._floorSelectionState.reset();
        this._map._removeIndoorControl();
        this._map.setConfigProperty(this._scope, "mbx-indoor-level-selected", ["literal", []]);
    };

    _updateUI() {
        const floors = this._floorSelectionState.getCurrentBuildingFloors().map((floor) => ({
            id: floor.properties.id as string,
            name: floor.properties.name as string,
            shortName: floor.properties.floor_level as string,
            levelOrder: floor.properties.floor_level as number
        }));

        const selectedFloorId = this._floorSelectionState.getSelectedFloorId();
        if (!selectedFloorId) {
            console.warn('IndoorManager: Selected floor is not set');
            return;
        }

        this._updateIndoorConfig();

        this.fire(new Event('indoorupdate', {
            selectedFloorId,
            floors
        }));
    }

    // eslint-disable-next-line no-warning-comments
    // TODO: Replace use of config with the style expressions
    _updateIndoorConfig() {
        const selectedFloorId = this._floorSelectionState.getSelectedFloorId();
        if (!selectedFloorId) {
            console.warn('IndoorManager: Selected floor is not set');
            return;
        }

        this._map.setConfigProperty(this._scope, "mbx-indoor-level-selected", ["literal", [selectedFloorId]]);
    }

    // Selects a level of based on a provided ID.
    selectFloor(floorId: string | null) {
        this._floorSelectionState.setFloorId(floorId);
        this._updateIndoorConfig();
    }
}
