import {bindAll} from '../util/util';
import Point from '@mapbox/point-geometry';
import {Event, Evented, ErrorEvent} from '../util/evented';

import type {Map} from '../ui/map';
import type {PointLike} from '../types/point-like';
import type {SchemaSpecification} from '../style-spec/types';
import type Style from './style';

type Level = {
    id: string
    name: string
};

type Building = {
    id: string
    name: string
    levels: [Level]
};

// The events emitted by IndoorManager
type IndoorEvents = {
    'floorplanselected': {
        buildings: [Building]
        levels: [Level],
        selectedLevelId?: string
    };
    'floorplangone': void;
    'buildingselected': {
        buildingId?: string
        levels: [Level]
    };
    'levelselected': {
        levelId?: string
    };
}

const indoorSchemaExtension: SchemaSpecification = {
    // Contains an array of IDs with the active floorplans in the area
    "mbx-indoor-active-floorplans": {
        "default": ["literal", []]
    },
    // True if the map should render underground floors (currently used for dimming)
    "mbx-indoor-underground": {
        "default": ["literal", false]
    },
    // Contains an array of the loaded level IDs (Note: Not the same as selected!)
    "mbx-indoor-loaded-levels": {
        "default": ["literal", []]
    },
    // Contains a map from the level IDs to the top height of the floor
    "mbx-indoor-level-height": {
        "default": ["literal", {}]
    },
    // Contains a map from the level IDs to the base height of the floor
    "mbx-indoor-level-base": {
        "default": ["literal", {}]
    },
    // Contains the selection state of the level (value is true if it is selected)
    "mbx-indoor-level-selected": {
        "default": ["literal", {}]
    },
    // Contains the overlapped state of the level (value is true if it is overlapped by another level)
    "mbx-indoor-level-overlapped": {
        "default": ["literal", {}]
    }
};

export function expandSchemaWithIndoor(schema?: SchemaSpecification): SchemaSpecification {
    schema = schema ? schema : {};
    return Object.assign(schema, indoorSchemaExtension);
}

type FloorplanState = {
    selectedBuilding?: string;
    selectedLevel?: string;
};

type FloorplanLevel = {
    id: string;
    levelOrder: number;
}

class IndoorManager extends Evented<IndoorEvents> {
    //// Public configuration options

    // If true, floors with similar floorIDs will be merged, in a floorplan that contains multiple set of floors.
    mergeFloors = true;

    //// Properties required for interactivity
    _map: Map;
    _scope = undefined;
    _queryFeatureSetId = undefined;
    _buildingEntryFeatureSetId = undefined;

    //// Indoor state management

    // The active floorplan in the current area
    _selectedFloorplan = undefined;

    // The parsed indoor-data field of the active floorplan
    _indoorData = undefined;

    // Tracker of the previously selected floorplan elements
    // which is used to restore selections when leaving and returning to the area.
    _floorplanStates: { [ID: string]: FloorplanState } = {};

    constructor(map: Map) {
        super();

        bindAll([
            '_onLoad',
            '_onMove',
            '_checkFloorplanVisible'
        ], this);

        this._map = map;
        this._checkFloorplanVisible();
        this._map.on('load', this._onLoad);
        this._map.on('move', this._onMove);
    }

    destroy() {
        this._map.indoor.off('load', this._onLoad);
        this._map.indoor.off('move', this._onMove);
        this._map = undefined;
    }

    // Prepare IndoorManager on the map load.
    // If the style contains any fragment with "indoor" property
    // the manager gets automatically enabled and it starts querying features.
    _onLoad() {
        this._map.style.forEachFragmentStyle((style: Style) => {
            // Find a style with an indoor property
            if (style.stylesheet.indoor) {
                if (!this._queryFeatureSetId) {
                    this._queryFeatureSetId = style.stylesheet.indoor.floorplanFeaturesetId;
                    this._buildingEntryFeatureSetId = style.stylesheet.indoor.buildingFeaturesetId;
                    this._scope = style.scope;
                } else {
                    this.fire(new ErrorEvent(new Error('Multiple indoor map styles detected, simultaneous usage is not allowed currently.')));
                }
            }
        });

        if (this._queryFeatureSetId && this._buildingEntryFeatureSetId) {
            this._map.addInteraction('mbx-indoor-buildingclick', {
                type: 'click',
                target: {
                    featuresetId: this._buildingEntryFeatureSetId,
                    importId: this._scope
                },
                handler: (e) => {
                    if (e.feature && e.feature.properties.floorplan) {
                        this.selectFloorplan(e.feature.properties.floorplan);
                    }
                    return true;
                }
            });
        }

        this._checkFloorplanVisible();
    }

    _onMove() {
        this._checkFloorplanVisible();
    }

    _checkFloorplanVisible() {
        if (!this._queryFeatureSetId) {
            return;
        }
        if (!this._map.isStyleLoaded()) {
            return;
        }

        const clearFloorplanData = () => {
            this._indoorData = undefined;
            this._selectedFloorplan = undefined;
            this._map.setConfigProperty(this._scope, "mbx-indoor-underground", false);
            this._map.setConfigProperty(this._scope, "mbx-indoor-active-floorplans", ["literal", []]);
            this.fire(new Event('floorplangone'));
        };

        // Prevent queries on low zoom levels
        if (this._map.transform.zoom < 13.0) {
            clearFloorplanData();
            return;
        }

        const queryParams = {
            target: {
                featuresetId: this._queryFeatureSetId,
                importId: this._scope
            }
        };
        const width = this._map.transform.width;
        const height = this._map.transform.height;
        const partialWidth = width * (2 / 3);
        const partialHeight = height * (2 / 3);
        const offsetX = 0.5 * (width - partialWidth);
        const offsetY = 0.5 * (height - partialHeight);
        const partialScreen: [PointLike, PointLike] = [
            new Point(offsetX, offsetY),
            new Point(offsetX + partialWidth, offsetY + partialHeight)
        ];
        const features = this._map.queryRenderedFeatures(partialScreen, queryParams);
        // Note: Currently the first returned feature is automatically selected. This logic could be expanded to select the floorplan closest to the map's center.
        if (features.length > 0) {
            if (!this._selectedFloorplan || features[0].properties.id !== this._selectedFloorplan.properties.id) {
                this._selectedFloorplan = features[0];
                this._floorplanSelected();
            }
        } else {
            clearFloorplanData();
        }
    }

    _floorplanSelected() {
        this._indoorData = JSON.parse(this._selectedFloorplan.properties["indoor-data"]);
        this._indoorData.id = this._selectedFloorplan.properties.id;
        this._floorplanStates[this._indoorData.id] = this._floorplanStates[this._indoorData.id] || {};
        this._map.setConfigProperty(this._scope, "mbx-indoor-active-floorplans", ["literal", [this._indoorData.id]]);

        // Select building - previously selected, or first building
        const selectedBuildingId = this._floorplanStates[this._indoorData.id].selectedBuilding;
        const building = selectedBuildingId ?
            this._indoorData.buildings.find(e => e.id === selectedBuildingId) :
            (this._indoorData.buildings.length > 0 ? this._indoorData.buildings[0] : null);
        // Select level - previously selected, or default level which will be the zero floor level
        const selectedLevelId = this._floorplanStates[this._indoorData.id].selectedLevel;
        const selectedLevelMatch = this._indoorData.levels.find(level => level.id === selectedLevelId);
        // If the selected level is not found, select the zero floor level. TODO: Not very optimal.
        const zeroFloorLevel: FloorplanLevel | undefined = this._indoorData.levels.find((level: FloorplanLevel) => {
            if (!building || !building.levels) return false;
            return Number(level.levelOrder) === 0 && (building.levels as string[]).includes(level.id);
        });
        const levelId = selectedLevelMatch ? selectedLevelMatch.id : (zeroFloorLevel ? zeroFloorLevel.id : undefined);

        // Fire 'floorplanselected' event before any of the building and level selection events
        this.fire(new Event('floorplanselected', {
            buildings: this._indoorData.buildings,
            levels: this._indoorData.levels,
            selectedLevelId: levelId
        }));

        if (building) this._buildingSelected(building, false);

        if (levelId) {
            this._levelSelected(levelId);
        }
    }

    _buildingSelected(selectedBuilding, animated) {
        if (!selectedBuilding || !selectedBuilding.id) {
            console.warn('IndoorManager: Building or building id is undefined');
            return;
        }

        // Animate camera to the selected building, if the building has a pre-calculated extent
        if (animated && selectedBuilding.extent) {
            this._map.fitBounds(selectedBuilding.extent, {
                pitch: this._map.getPitch(),
                bearing: this._map.getBearing()
            });
        }

        this._floorplanStates[this._indoorData.id].selectedBuilding = selectedBuilding ? selectedBuilding.id : undefined;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        const levelsForBuilding = this._indoorData.levels.filter((item) => selectedBuilding.levels.includes(item.id));

        this.fire(new Event('buildingselected', {
            buildingId: selectedBuilding.id,
            levels: levelsForBuilding
        }));
    }

    _levelSelected(id) {
        const selectedLevel = this._indoorData.levels.find(l => l.id === id);
        if (selectedLevel) {
            this._updateLevels(selectedLevel, true);
            this.fire(new Event('levelselected', {levelId: selectedLevel.id}));
        } else {
            console.warn(`IndoorManager: Level with ID ${id} not found in the current floorplan.`);
        }
    }

    _updateLevels(selectedLevel: FloorplanLevel, animated: boolean) {
        if (!selectedLevel || !selectedLevel.id) {
            throw new Error("IndoorManager: Selected level or level ID is undefined");
        }

        function getIdFromFloorString(input) {
            const floorIndex = input.indexOf('/floor/');
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            if (floorIndex === -1) return input;

            const idStart = floorIndex + '/floor/'.length;
            const idEnd = input.indexOf('/', idStart);

            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return idEnd === -1 ? input.slice(idStart) : input.slice(idStart, idEnd);
        }

        this._floorplanStates[this._indoorData.id].selectedLevel = selectedLevel.id;

        const levelkeys = [];
        const levelHeight = {};
        const levelBase = {};
        const levelSelected = {};
        const levelOverlapped = {};
        for (const level of this._indoorData.levels) {
            levelkeys.push(level.id);
            levelHeight[level.id] = level.levelOrder >= 0 ? Math.abs(level.levelOrder + 1) * 3 : Math.abs(level.levelOrder) * 3;
            levelBase[level.id] = level.levelOrder >= 0 ? level.levelOrder * 3 : 0;
            if (this.mergeFloors) {
                const selectedFloor = getIdFromFloorString(selectedLevel.id);
                const targetFloor = getIdFromFloorString(level.id);
                levelSelected[level.id] = targetFloor === selectedFloor ? "true" : "false";
            } else {
                levelSelected[level.id] = level.id === selectedLevel.id ? "true" : "false";
            }
            levelOverlapped[level.id] = level.levelOrder < selectedLevel.levelOrder ? "true" : "false";
        }

        // Note: This could be optimized by only updating the changed configurations
        this._map.setConfigProperty(this._scope, "mbx-indoor-loaded-levels", ["literal", levelkeys]);
        this._map.setConfigProperty(this._scope, "mbx-indoor-level-height", ["literal", levelHeight]);
        this._map.setConfigProperty(this._scope, "mbx-indoor-level-base", ["literal", levelBase]);
        this._map.setConfigProperty(this._scope, "mbx-indoor-level-selected", ["literal", levelSelected]);
        this._map.setConfigProperty(this._scope, "mbx-indoor-level-overlapped", ["literal", levelOverlapped]);

        const isUndergroundLevel = selectedLevel.levelOrder < 0;
        this._map.setConfigProperty(this._scope, "mbx-indoor-underground", isUndergroundLevel);
    }

    //// Public functions

    // Selects a floorplan based on a provided ID, if the associated feature is visible on the screen.
    selectFloorplan(floorplanId) {
        const queryParams = {
            target: {
                featuresetId: this._queryFeatureSetId,
                importId: this._scope
            }
        };
        const wholeScreen: [PointLike, PointLike] = [new Point(0, 0), new Point(this._map.transform.width, this._map.transform.height)];
        const features = this._map.queryRenderedFeatures(wholeScreen, queryParams);
        if (features.length > 0) {
            for (const feature of features) {
                const indoorData = JSON.parse(feature.properties['indoor-data'] as string);
                if (indoorData.id === floorplanId) {
                    this._selectedFloorplan = feature;
                    this._floorplanSelected();
                    break;
                }
            }
        }
    }

    // Selects a building based on a provided ID.
    selectBuilding(id) {
        const selectedBuilding = this._indoorData.buildings.find(e => e.id === id);
        this._buildingSelected(selectedBuilding, true);
    }

    // Selects a level of based on a provided ID.
    selectLevel(levelId) {
        this._levelSelected(levelId);
    }
}

export default IndoorManager;
