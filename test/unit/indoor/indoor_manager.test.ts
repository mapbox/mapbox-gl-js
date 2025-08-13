// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import {describe, test, beforeEach, afterEach, expect, waitFor, vi, createMap} from '../../util/vitest';
import {createStyle} from '../ui/map/util';

const indoorData = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {
                "type": "building",
                "id": "7451233234",
                "name": "Central Railway Station",
            },
            "geometry": {
                "coordinates": [
                    [
                        [
                            24.93949488741535,
                            60.17301355602015
                        ],
                        [
                            24.93949488741535,
                            60.17016110424569
                        ],
                        [
                            24.945257952361146,
                            60.17016110424569
                        ],
                        [
                            24.945257952361146,
                            60.17301355602015
                        ],
                        [
                            24.93949488741535,
                            60.17301355602015
                        ]
                    ]
                ],
                "type": "Polygon"
            },
            "id": 0
        },
        {
            "type": "Feature",
            "properties": {
                "type": "floor",
                "id": "7451233234",
                "name": "Central Railway Station Floor 1",
                "is_default": true,
                "z_index": 1
            },
            "geometry": {
                "coordinates": [
                    [
                        [
                            24.93949488741535,
                            60.17301355602015
                        ],
                        [
                            24.93949488741535,
                            60.17016110424569
                        ],
                        [
                            24.945257952361146,
                            60.17016110424569
                        ],
                        [
                            24.945257952361146,
                            60.17301355602015
                        ],
                        [
                            24.93949488741535,
                            60.17301355602015
                        ]
                    ]
                ],
                "type": "Polygon"
            },
        },
        
    ]
};

const indoorLayers = [
    {
        "type": "fill",
        "id": "building-outline",
        "source": "indoor-source",
        "minzoom": 16.0,
        "slot": "middle",
        "filter": [
            "all",
            ["==", ["geometry-type"], "Polygon"],
            ["in", ["get", "shape_type"], ["literal", ["building"]]],
        ],
        "paint": {
            // Note: We should keep opacity above zero to enable queries of the footprint
            "fill-opacity": 0.01,
            "fill-color": "#e8a5b8"
        }
    },
    {
        "type": "fill",
        "id": "floor-outline",
        "source": "indoor-source",
        "minzoom": 16.0,
        "slot": "middle",
        "filter": [
            "all",
            ["in", ["get", "shape_type"], ["literal", ["floor"]]],
        ],
        "paint": {
            // Note: We should keep opacity above zero to enable queries of the footprint
            "fill-opacity": 0.01,
            "fill-color": "#803080"
        }
    },
];

const indoorStyle = {
    version: 8,
    imports: [{
        id: 'indoor',
        url: '',
        data: {
            version: 8,
            featuresets: {
                "building-outline": {
                    "selectors": [
                        {
                            "layer": "building-outline",
                            "properties": {
                                "id": ["get", "id"],
                                "building_id": ["get", "building_id"],
                                "shape_type": ["get", "shape_type"],
                                "name": ["get", "name"],
                                "numeric_name": ["get", "numeric_name"],
                                "floor_level": ["get", "floor_level"]
                            }
                        }
                    ]
                },
                "floor-outline": {
                    "selectors": [
                        {
                            "layer": "floor-outline",
                            "properties": {
                                "id": ["get", "id"],
                                "building_id": ["get", "building_id"],
                                "shape_type": ["get", "shape_type"],
                                "name": ["get", "name"],
                                "numeric_name": ["get", "numeric_name"],
                                "floor_level": ["get", "floor_level"]
                            }
                        }
                    ]
                },
            },
            sources: {
                "indoor-source": {
                    "type": "geojson",
                    "data": indoorData
                }
            },
            indoor: {
                floorplanFeaturesetId: "floorplan-detection",
                buildingFeaturesetId: "building-entry"
            },
            layers: indoorLayers,
       }
    }],
    center: [24.94248, 60.16931],
    zoom: 17.0,
    sources: {},
    layers: []
};

describe('IndoorManager', () => {
    test('created with map', () => {
        const map = createMap({interactive: true, style: createStyle()});
        expect(map.indoor._map).toEqual(map);
        expect(map.indoor._indoorDataQuery).toBeFalsy();
        expect(map.indoor._floorSelectionState).toBeTruthy();
        expect(map.indoor._floorSelectionState._selectedFloorId).toEqual(null);
        expect(map.indoor._floorSelectionState._selectedBuildingId).toEqual(null);
    });
});
