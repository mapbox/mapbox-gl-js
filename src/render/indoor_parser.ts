import {warnOnce} from "../util/util";
import {getLngLatPoint} from "../style-spec/expression/definitions/distance";
import {IndoorActiveFloorStrategy} from "../style/indoor_active_floor_strategy";

import type {VectorTile, VectorTileFeature} from "@mapbox/vector-tile";
import type {IndoorBuilding, IndoorData, IndoorTileOptions} from "../style/indoor_data";
import type Actor from "../util/actor";
import type {CanonicalTileID} from "../source/tile_id";
import type {Polygon, MultiPolygon} from "geojson";

export function parseActiveFloors(data: VectorTile, indoorTileOptions: IndoorTileOptions, actor: Actor, tileID: CanonicalTileID): Set<string> | undefined {
    const activeFloorsVisible = indoorTileOptions.indoorState.activeFloorsVisible;
    if (!indoorTileOptions.sourceLayers) {
        return activeFloorsVisible ? indoorTileOptions.indoorState.activeFloors : undefined;
    }
    const sourceLayers = calculateIndoorSourceLayers(indoorTileOptions.sourceLayers, new Set(Object.keys(data.layers)));
    const indoorState = indoorTileOptions.indoorState;
    const indoorData = parseData(data, sourceLayers, indoorState.activeFloors, indoorState.selectedFloorId, tileID);
    actor.send('setIndoorData', indoorData);
    return activeFloorsVisible ? indoorData.activeFloors : undefined;
}

function parseData(
    data: VectorTile,
    sourceLayers: Set<string>,
    lastActiveFloors: Set<string>,
    selectedFloorId: string,
    tileID: CanonicalTileID
): IndoorData {
    const buildings: Record<string, IndoorBuilding> = {};

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
                continue;
            }

            // Next step: Introduce better logging in case of invalid feature with valid type
            if (isValidFloorFeature(feature)) {
                const floor = parseFloor(feature, tileID);
                assignFloorToBuildings(buildings, floor.buildings, floor.id, floor);
            }
        }
    }

    const activeFloors = IndoorActiveFloorStrategy.calculate(buildings, selectedFloorId, lastActiveFloors);
    return {
        buildings,
        activeFloors
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
    floor: {name: string, zIndex: number, connections: Set<string>, conflicts: Set<string>, isDefault: boolean, buildings: Set<string>}
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

function parseFloor(feature: VectorTileFeature, tileID: CanonicalTileID): {id: string, isDefault: boolean, connections: Set<string>, conflicts: Set<string>, buildings: Set<string>, zIndex: number, name: string, geometry: Polygon | MultiPolygon | undefined} {
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
    const geometry = extractGeometry(feature, tileID);
    return {id, isDefault, connections, conflicts, buildings, name, zIndex, geometry};
}

function extractGeometry(feature: VectorTileFeature, tileID: CanonicalTileID): Polygon | MultiPolygon | undefined {
    const geometry = feature.loadGeometry();
    if (!geometry || geometry.length === 0) return undefined;

    const coordinates = geometry.map(ring => {
        return ring.map(p => {
            return getLngLatPoint(p, tileID, feature.extent);
        });
    });
    if (coordinates.length === 0) return undefined;

    // Just construct a Polygon with the first ring as exterior.
    return {type: 'Polygon', coordinates: [coordinates[0]]};
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
