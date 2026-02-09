import {warnOnce} from "../util/util";

import type {VectorTile, VectorTileFeature} from "@mapbox/vector-tile";
import type {IndoorBuilding, IndoorData, IndoorTileOptions} from "../style/indoor_data";
import type Actor from "../util/actor";

export function parseActiveFloors(data: VectorTile, indoorTileOptions: IndoorTileOptions, actor: Actor): Set<string> | undefined {
    const activeFloorsVisible = indoorTileOptions.indoorState.activeFloorsVisible;
    if (!indoorTileOptions.sourceLayers) {
        return activeFloorsVisible ? indoorTileOptions.indoorState.activeFloors : undefined;
    }
    const sourceLayers = calculateIndoorSourceLayers(indoorTileOptions.sourceLayers, new Set(Object.keys(data.layers)));
    const indoorState = indoorTileOptions.indoorState;
    const indoorData = parseData(data, sourceLayers, indoorState.activeFloors, indoorState.selectedFloorId);
    actor.send('setIndoorData', indoorData);
    return activeFloorsVisible ? indoorData.activeFloors : undefined;
}

// This function is used to parse the indoor data from the vector tile
// And resolve set of currently active floors based on lastActiveFloors and selectedFloorId
// 1. Parse the indoor data from the vector tile
// 2. selectedFloorId will be used to determine if the floor is active (either directly or via connected_floor_ids)
// 3. if lastActiveFloors is provided, we will also add floors from that set that are not conflicting with the new active floors from step 2
// 4. we also add default floors that are not conflicting with the new active floors from steps 2 and 3
// ResolveD data will be passed to the bucket and emitted to indoor manager to create new indoorState
function parseData(
    data: VectorTile,
    sourceLayers: Set<string>,
    lastActiveFloors: Set<string>,
    selectedFloorId: string
): IndoorData {
    const newActiveFloors = new Set<string>();
    const allFloors = new Set<string>();
    const allDefaultFloors = new Set<string>();

    const floorIdToConflicts = new Map<string, Set<string>>();
    const buildings: Record<string, IndoorBuilding> = {};

    // If any active floor lists candidate as conflict, or candidate lists any active as conflict
    const conflictsWithActive = (candidateId: string): boolean => {
        const candidateConflicts = floorIdToConflicts.get(candidateId) || new Set<string>();
        for (const activeId of newActiveFloors) {
            const activeConflicts = floorIdToConflicts.get(activeId) || new Set<string>();
            if (activeConflicts.has(candidateId) || candidateConflicts.has(activeId)) return true;
        }
        return false;
    };

    for (const layerId of sourceLayers) {
        const sourceLayer = data.layers[layerId];
        if (!sourceLayer) {
            warnOnce(`indoor source layer not found: ${layerId}`);
            continue;
        }

        for (let index = 0; index < sourceLayer.length; index++) {
            const feature = sourceLayer.feature(index);

            if (isValidBuildingFeature(feature)) {
                const {id, center} = parseBuilding(feature);
                upsertBuilding(buildings, id, center);
                newActiveFloors.add(id);
                continue;
            }

            // Next step: Introduce better logging in case of invalid feature with valid type
            if (isValidFloorFeature(feature)) {
                const {id, isDefault, connections, conflicts, buildings: buildingIds, name, zIndex} = parseFloor(feature);
                assignFloorToBuildings(buildings, buildingIds, id, {name, zIndex});

                floorIdToConflicts.set(id, conflicts);

                const isActiveFloor = (id === selectedFloorId) || connections.has(selectedFloorId);
                if (isActiveFloor) {
                    newActiveFloors.add(id);
                }

                allFloors.add(id);
                if (isDefault) {
                    allDefaultFloors.add(id);
                }
            }
        }
    }

    // Add last active floors that still exist and don't conflict with current active floors
    if (lastActiveFloors) {
        for (const lastActiveFloorId of lastActiveFloors) {
            // lastActiveFloors may contain floors that are not in the current tile data, so we need to check if they exist and skip if they don't
            if (!allFloors.has(lastActiveFloorId)) continue;
            if (!conflictsWithActive(lastActiveFloorId)) {
                newActiveFloors.add(lastActiveFloorId);
            }
        }
    }

    // Add default floors that don't conflict with the active floors
    for (const defaultFloorId of allDefaultFloors) {
        if (newActiveFloors.has(defaultFloorId)) continue;
        if (!conflictsWithActive(defaultFloorId)) {
            newActiveFloors.add(defaultFloorId);
        }
    }

    return {
        buildings,
        activeFloors: newActiveFloors
    };
}

function upsertBuilding(
    buildings: Record<string, IndoorBuilding>,
    buildingId: string,
    center?: [number, number]
): void {
    if (!buildings[buildingId]) {
        buildings[buildingId] = {
            floorIds: new Set(),
            center: center ? center : [0, 0],
            floors: {},
        };
    } else if (center) {
        buildings[buildingId].center = center;
    }
}

function assignFloorToBuildings(
    buildings: Record<string, IndoorBuilding>,
    buildingIds: Set<string>,
    floorId: string,
    floor: {name: string, zIndex: number}
): void {
    for (const buildingId of buildingIds) {
        upsertBuilding(buildings, buildingId);
        buildings[buildingId].floors[floorId] = floor;
        buildings[buildingId].floorIds.add(floorId);
    }
}

function parseBuilding(feature: VectorTileFeature): {id: string, center: [number, number]} {
    const id = feature.properties.id.toString();
    const center = feature.properties.center.toString().split(";").map(Number) as [number, number];
    return {id, center};
}

function parseFloor(feature: VectorTileFeature): {id: string, isDefault: boolean, connections: Set<string>, conflicts: Set<string>, buildings: Set<string>, zIndex: number, name: string} {
    const id = feature.properties.id.toString();
    const isDefault = feature.properties.is_default ?
        feature.properties.is_default as boolean :
        false;
    const connections: Set<string> = feature.properties.connected_floor_ids ?
        new Set(feature.properties.connected_floor_ids.toString().split(";")) :
        new Set();
    const conflicts: Set<string> = feature.properties.conflicted_floor_ids ?
        new Set(feature.properties.conflicted_floor_ids.toString().split(";")) :
        new Set();
    const buildings: Set<string> = feature.properties.building_ids ?
        new Set(feature.properties.building_ids.toString().split(";")) :
        new Set();
    const name = feature.properties.name.toString();
    const zIndex = feature.properties.z_index as number;

    return {id, isDefault, connections, conflicts, buildings, name, zIndex};
}

function hasRequiredProperties(feature: VectorTileFeature, requiredProps: string[]): boolean {
    return requiredProps.every(prop => feature.properties && feature.properties[prop] !== undefined && feature.properties[prop] !== null);
}

function isValidBuildingFeature(feature: VectorTileFeature): boolean {
    return hasRequiredProperties(feature, ['type', 'id', 'name']) &&
            feature.properties.type === "building";
}

function isValidFloorFeature(feature: VectorTileFeature): boolean {
    return hasRequiredProperties(feature, ['type', 'id', 'name', 'z_index']) &&
            feature.properties.type === "floor";
}

function calculateIndoorSourceLayers(sourceLayers: Set<string> | null, actualSourceLayers: Set<string>): Set<string> {
    if (!sourceLayers) {
        warnOnce('No source layers defined in indoor specification');
        return actualSourceLayers;
    }

    // This is a valid case for GeoJSON, where we have single sourceLayer with special id, which we don't want to rely explicitly
    if (sourceLayers.size === 0) {
        return actualSourceLayers;
    }

    const missingSourceLayers = sourceLayers.difference(actualSourceLayers);
    for (const missingSourceLayer of missingSourceLayers) {
        warnOnce(`Missing source layer required in indoor specification: ${missingSourceLayer}`);
    }

    return actualSourceLayers.intersection(actualSourceLayers);
}
