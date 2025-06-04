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
                "shape_type": "venue",
                "id": "7451233234",
                "indoor-data": {
                    "id": "7451233234",
                    "extent": [
                        [
                            24.939551666380453,
                            60.17302767645245
                        ],
                        [
                            24.945229562879092,
                            60.1701328609106
                        ]
                    ],
                    "buildings": [
                        {
                            "name": "Central Railway Station",
                            "id": "43246546456",
                            "levels": [
                                "demo-level-634123123",
                                "demo-level-235234234",
                                "demo-level-852343423"
                            ],
                        },
                        {
                            "name": "Secondary building",
                            "id": "234634543534",
                            "levels": [
                                "demo-level-634123123",
                                "demo-level-235234234",
                                "demo-level-852343423"
                            ],
                        }
                    ],
                    "levels": [
                        {
                            "id": "demo-level-634123123",
                            "name": "Tunnel level",
                            "levelOrder": -1,
                        },
                        {
                            "id": "demo-level-235234234",
                            "name": "Ground level",
                            "levelOrder": 0,
                        },
                        {
                            "id": "demo-level-852343423",
                            "name": "Clock tower",
                            "levelOrder": 7,
                        }
                    ]
                }
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
        }
    ]
};

const indoorStyle = {
    version: 8,
    imports: [{
        id: 'indoor',
        url: '',
        data: {
            version: 8,
            featuresets: {
                "floorplan-detection": {
                    "selectors": [
                        {
                            "layer": "query-area",
                            "properties": {
                                "id": ["get", "id"],
                                "indoor-data": ["get", "indoor-data"]
                            }
                        }
                    ]
                }
            },
            sources: {
                "indoor-data": {
                    "type": "geojson",
                    "data": indoorData
                }
            },
            indoor: {
                floorplanFeaturesetId: "floorplan-detection",
                buildingFeaturesetId: "building-entry"
            },
            layers: [
                {
                    "type": "fill",
                    "id": "query-area",
                    "source": "indoor-data",
                    "filter": [
                        "all",
                        ["==", ["geometry-type"], "Polygon"],
                        ["==", ["get", "shape_type"], "venue"]
                    ],
                    "paint": {
                        // Note: We should keep opacity above zero to enable queries of the footprint
                        "fill-opacity": 0.03,
                        "fill-color": "#800080"
                    }
                }
            ]
        }
    }],
    center: [24.94248, 60.16931],
    zoom: 14.0,
    sources: {},
    layers: []
};

describe('IndoorManager', () => {
    test('created with map', () => {
        const map = createMap({interactive: true, style: createStyle()});
        expect(map.indoor._map).toEqual(map);
        expect(map.indoor._queryFeatureSetId).toEqual(undefined);
        expect(map.indoor._selectedFloorplan).toEqual(undefined);
    });

    test('auto select floorplan on map load', async () => {
        const map = createMap({style: indoorStyle});
        await waitFor(map.indoor, "floorplanselected");
        expect(map.indoor._queryFeatureSetId).toEqual("floorplan-detection");
        expect(map.indoor._selectedFloorplan).toBeTruthy();
        expect(map.indoor._indoorData.id).toEqual("7451233234");
    });

    test('deselect floorplan on camera move', async () => {
        const map = createMap({style: indoorStyle});
        await waitFor(map.indoor, "floorplanselected");
        expect(map.indoor._selectedFloorplan).toBeTruthy();
        map.flyTo({center: [10, 50], duration: 100});
        await waitFor(map.indoor, "floorplangone");
        expect(map.indoor._selectedFloorplan).toEqual(undefined);
    });

    test('select level with public api', async () => {
        const map = createMap({style: indoorStyle});
        await waitFor(map.indoor, "floorplanselected");
        expect(map.indoor._selectedFloorplan).toBeTruthy();
        expect(map.indoor._floorplanStates).toEqual({
            "7451233234": {
                "selectedBuilding": "43246546456",
                "selectedLevel": "demo-level-235234234" // default level
            }
        });
        map.indoor.selectLevel("demo-level-634123123");
        expect(map.indoor._floorplanStates).toEqual({
            "7451233234": {
                "selectedBuilding": "43246546456",
                "selectedLevel": "demo-level-634123123"
            }
        });
    });

    test('select building with public api', async () => {
        const map = createMap({style: indoorStyle});
        await waitFor(map.indoor, "floorplanselected");
        expect(map.indoor._selectedFloorplan).toBeTruthy();
        expect(map.indoor._floorplanStates).toEqual({
            "7451233234": {
                "selectedBuilding": "43246546456",
                "selectedLevel": "demo-level-235234234" // default level
            }
        });
        map.indoor.selectBuilding("234634543534");
        expect(map.indoor._floorplanStates).toEqual({
            "7451233234": {
                "selectedBuilding": "234634543534",
                "selectedLevel": "demo-level-235234234"
            }
        });
    });
});
