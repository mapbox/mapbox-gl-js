import type {TargetFeature} from '../util/vectortile_to_geojson';

export default class IndoorFloorSelectionState {
    _selectedFloorId: string | null;
    _selectedBuildingId: string | null;
    _floors: Array<TargetFeature>;

    constructor() {
        this._selectedFloorId = null;
        this._selectedBuildingId = null;
        this._floors = [];
    }

    setBuildingId(buildingId: string) {
        this._selectedBuildingId = buildingId;
    }

    setFloors(floors: Array<TargetFeature>) {
        this._floors = floors.filter(floor => floor.properties.building_id === this._selectedBuildingId);

        // eslint-disable-next-line no-warning-comments
        // TODO: Fallback on the default floor if the selected floor is not in the list of floors. Data should be enriched.
        if (!this._selectedFloorId || !this._floors.map(floor => floor.properties.id as string).includes(this._selectedFloorId)) {
            const floorLevels = this._floors.map(floor => ({
                id: floor.properties.id as string,
                level: floor.properties.floor_level as number
            }));
            const closestToFloorOne = floorLevels.reduce((prev, curr) => {
                const prevDiff = Math.abs(prev.level - 1);
                const currDiff = Math.abs(curr.level - 1);
                return currDiff < prevDiff ? curr :
                    currDiff === prevDiff ? (curr.level > prev.level ? curr : prev) :
                    prev;
            });
            this._selectedFloorId = closestToFloorOne.id;
        }
    }

    setFloorId(floorId: string | null) {
        this._selectedFloorId = floorId;
    }

    getSelectedFloorId(): string | null {
        return this._selectedFloorId;
    }

    getCurrentBuildingFloors(): Array<TargetFeature> {
        return this._floors;
    }

    reset() {
        this._selectedFloorId = null;
        this._selectedBuildingId = null;
        this._floors = [];
    }
}
