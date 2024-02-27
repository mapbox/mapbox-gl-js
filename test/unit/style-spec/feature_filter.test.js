import {describe, test, beforeEach, expect, vi} from "../../util/vitest.js";
import {default as createFilter, isExpressionFilter, isDynamicFilter, extractStaticFilter} from '../../../src/style-spec/feature_filter/index.js';

import convertFilter from '../../../src/style-spec/feature_filter/convert.js';
import Point from '@mapbox/point-geometry';
import MercatorCoordinate from '../../../src/geo/mercator_coordinate.js';
import EXTENT from '../../../src/style-spec/data/extent.js';

describe('filter', () => {
    test('expression, zoom', () => {
        const f = createFilter(['>=', ['number', ['get', 'x']], ['zoom']]).filter;
        expect(f({zoom: 1}, {properties: {x: 0}})).toEqual(false);
        expect(f({zoom: 1}, {properties: {x: 1.5}})).toEqual(true);
        expect(f({zoom: 1}, {properties: {x: 2.5}})).toEqual(true);
        expect(f({zoom: 2}, {properties: {x: 0}})).toEqual(false);
        expect(f({zoom: 2}, {properties: {x: 1.5}})).toEqual(false);
        expect(f({zoom: 2}, {properties: {x: 2.5}})).toEqual(true);
    });

    test('expression, compare two properties', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const f = createFilter(['==', ['string', ['get', 'x']], ['string', ['get', 'y']]]).filter;
        expect(f({zoom: 0}, {properties: {x: 1, y: 1}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {x: '1', y: '1'}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {x: 'same', y: 'same'}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {x: null}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {x: undefined}})).toEqual(false);
    });

    test('expression, collator comparison', () => {
        const caseSensitive = createFilter(['==', ['string', ['get', 'x']], ['string', ['get', 'y']], ['collator', {'case-sensitive': true}]]).filter;
        expect(caseSensitive({zoom: 0}, {properties: {x: 'a', y: 'b'}})).toEqual(false);
        expect(caseSensitive({zoom: 0}, {properties: {x: 'a', y: 'A'}})).toEqual(false);
        expect(caseSensitive({zoom: 0}, {properties: {x: 'a', y: 'a'}})).toEqual(true);

        const caseInsensitive = createFilter(['==', ['string', ['get', 'x']], ['string', ['get', 'y']], ['collator', {'case-sensitive': false}]]).filter;
        expect(caseInsensitive({zoom: 0}, {properties: {x: 'a', y: 'b'}})).toEqual(false);
        expect(caseInsensitive({zoom: 0}, {properties: {x: 'a', y: 'A'}})).toEqual(true);
        expect(caseInsensitive({zoom: 0}, {properties: {x: 'a', y: 'a'}})).toEqual(true);
    });

    test('expression, any/all', () => {
        expect(createFilter(['all']).filter()).toEqual(true);
        expect(createFilter(['all', true]).filter()).toEqual(true);
        expect(createFilter(['all', true, false]).filter()).toEqual(false);
        expect(createFilter(['all', true, true]).filter()).toEqual(true);
        expect(createFilter(['any']).filter()).toEqual(false);
        expect(createFilter(['any', true]).filter()).toEqual(true);
        expect(createFilter(['any', true, false]).filter()).toEqual(true);
        expect(createFilter(['any', false, false]).filter()).toEqual(false);
    });

    test('expression, type error', () => {
        expect(() => {
            createFilter(['==', ['number', ['get', 'x']], ['string', ['get', 'y']]]);
        }).toThrowError();

        expect(() => {
            createFilter(['number', ['get', 'x']]);
        }).toThrowError();

        expect(() => {
            createFilter(['boolean', ['get', 'x']]);
        }).not.toThrowError();
    });

    test('expression, within', () => {
        const  getPointFromLngLat = (lng, lat, canonical) => {
            const p = MercatorCoordinate.fromLngLat({lng, lat}, 0);
            const tilesAtZoom = Math.pow(2, canonical.z);
            return new Point(
                (p.x * tilesAtZoom - canonical.x) * EXTENT,
                (p.y * tilesAtZoom - canonical.y) * EXTENT);
        };
        const withinFilter =  createFilter(['within', {'type': 'Polygon', 'coordinates': [[[0, 0], [5, 0], [5, 5], [0, 5], [0, 0]]]}]);
        expect(withinFilter.needGeometry).toEqual(true);
        const canonical = {z: 3, x: 3, y:3};
        expect(
            withinFilter.filter({zoom: 3}, {type: 1, geometry: [[getPointFromLngLat(2, 2, canonical)]]}, canonical)
        ).toEqual(true);
        expect(
            withinFilter.filter({zoom: 3}, {type: 1, geometry: [[getPointFromLngLat(6, 6, canonical)]]}, canonical)
        ).toEqual(false);
        expect(
            withinFilter.filter({zoom: 3}, {type: 1, geometry: [[getPointFromLngLat(5, 5, canonical)]]}, canonical)
        ).toEqual(false);
        expect(
            withinFilter.filter({zoom: 3}, {type: 2, geometry: [[getPointFromLngLat(2, 2, canonical), getPointFromLngLat(3, 3, canonical)]]}, canonical)
        ).toEqual(true);
        expect(
            withinFilter.filter({zoom: 3}, {type: 2, geometry: [[getPointFromLngLat(6, 6, canonical), getPointFromLngLat(2, 2, canonical)]]}, canonical)
        ).toEqual(false);
        expect(
            withinFilter.filter({zoom: 3}, {type: 2, geometry: [[getPointFromLngLat(5, 5, canonical), getPointFromLngLat(2, 2, canonical)]]}, canonical)
        ).toEqual(false);
    });

    describe('dynamic filters', () => {
        const DYNAMIC_FILTERS = [
            ["case",
                ["<", ["pitch"], 60], true,
                ["all", [">=", ["pitch"], 60], ["<", ["distance-from-center"], 2]], true,
                false
            ],
            ["case",
                ["<", ["pitch"], 60], ["<", ["get", "filter_rank"], 2],
                [">", ["get", "filter_rank"], 4],
            ],
            ["all", ["<", ["get", "filter_rank"], 2 ], [ "<", ["pitch"], 60]],
            ["any", ["<", ["get", "filter_rank"], 2 ], [ "<", ["pitch"], 60]],
            ["<", ["pitch"], 60],
            ["all",
                [
                    "<=",
                    ["get", "filterrank"],
                    3
                ],
                [
                    "match",
                    ["get", "class"],
                    "settlement",
                    [
                        "match",
                        ["get", "worldview"],
                        ["all", "US"],
                        true,
                        false
                    ],
                    "disputed_settlement",
                    [
                        "all",
                        [
                            "==",
                            ["get", "disputed"],
                            "true"
                        ],
                        [
                            "match",
                            ["get", "worldview"],
                            ["all", "US"],
                            true,
                            false
                        ],
                        ["all", [">=", ["pitch"], 60], ["<", ["distance-from-center"], 2]]
                    ],
                    false
                ],
                [
                    "step",
                    ["zoom"],
                    false,
                    8,
                    [
                        "<",
                        ["get", "symbolrank"],
                        11
                    ],
                    10,
                    [
                        "<",
                        ["get", "symbolrank"],
                        12
                    ],
                    11,
                    [
                        "<",
                        ["get", "symbolrank"],
                        13
                    ],
                    12,
                    [
                        "<",
                        ["get", "symbolrank"],
                        15
                    ],
                    13,
                    [
                        ">=",
                        ["get", "symbolrank"],
                        11
                    ],
                    14,
                    [
                        ">=",
                        ["get", "symbolrank"],
                        13
                    ]
                ]
            ]
        ];

        const STATIC_FILTERS = [
            ["match",
                ["get", "class"],
                "country",
                [
                    "match",
                    ["get", "worldview"],
                    ["all", "US"],
                    true,
                    false
                ],
                "disputed_country",
                [
                    "all",
                    [
                        "==",
                        ["get", "disputed"],
                        "true"
                    ],
                    [
                        "match",
                        ["get", "worldview"],
                        ["all", "US"],
                        true,
                        false
                    ]
                ],
                false
            ],
            ["all",
                [
                    "<=",
                    ["get", "filterrank"],
                    3
                ],
                [
                    "match",
                    ["get", "class"],
                    "settlement",
                    [
                        "match",
                        ["get", "worldview"],
                        ["all", "US"],
                        true,
                        false
                    ],
                    "disputed_settlement",
                    [
                        "all",
                        [
                            "==",
                            ["get", "disputed"],
                            "true"
                        ],
                        [
                            "match",
                            ["get", "worldview"],
                            ["all", "US"],
                            true,
                            false
                        ]
                    ],
                    false
                ],
                [
                    "step",
                    ["zoom"],
                    false,
                    8,
                    [
                        "<",
                        ["get", "symbolrank"],
                        11
                    ],
                    10,
                    [
                        "<",
                        ["get", "symbolrank"],
                        12
                    ],
                    11,
                    [
                        "<",
                        ["get", "symbolrank"],
                        13
                    ],
                    12,
                    [
                        "<",
                        ["get", "symbolrank"],
                        15
                    ],
                    13,
                    [
                        ">=",
                        ["get", "symbolrank"],
                        11
                    ],
                    14,
                    [
                        ">=",
                        ["get", "symbolrank"],
                        13
                    ]
                ]
            ],
            ["all",
                [
                    "match",
                    ["get", "class"],
                    "settlement_subdivision",
                    [
                        "match",
                        ["get", "worldview"],
                        ["all", "US"],
                        true,
                        false
                    ],
                    "disputed_settlement_subdivision",
                    [
                        "all",
                        [
                            "==",
                            ["get", "disputed"],
                            "true"
                        ],
                        [
                            "match",
                            ["get", "worldview"],
                            ["all", "US"],
                            true,
                            false
                        ]
                    ],
                    false
                ],
                [
                    "<=",
                    ["get", "filterrank"],
                    4
                ]
            ],
            ["<=",
                ["get", "filterrank"],
                [
                    "+",
                    [
                        "step",
                        ["zoom"],
                        0,
                        16,
                        1,
                        17,
                        2
                    ],
                    3
                ]
            ],
            ["<=", ["get", "test_param"], null]
        ];

        describe('isDynamicFilter', () => {
            test('true', () => {
                for (const filter of DYNAMIC_FILTERS) {
                    expect(isDynamicFilter(filter)).toBeTruthy();
                }
            });

            test('false', () => {
                for (const filter of STATIC_FILTERS) {
                    expect(isDynamicFilter(filter)).toBeFalsy();
                }
            });
        });

        describe('extractStaticFilter', () => {
            test('it lets static filters pass through', () => {
                for (const filter of STATIC_FILTERS) {
                    expect(extractStaticFilter(filter)).toEqual(filter);
                }
            });

            test('it collapses dynamic case expressions to any expressions', () => {
                const testCases = [
                    {
                        dynamic: ["case",
                            ["<", ["pitch"], 60], true,
                            ["all", [">=", ["pitch"], 60], ["<", ["distance-from-center"], 2]], true,
                            false
                        ],
                        static: ["any", true, true, false]
                    },
                    {
                        dynamic: ["case",
                            ["<", ["pitch"], 60], ["<", ["get", "filter_rank"], 2],
                            [">", ["get", "filter_rank"], 4],
                        ],
                        static: ["any", ["<", ["get", "filter_rank"], 2], [">", ["get", "filter_rank"], 4]]
                    },
                    {
                        dynamic: ["case",
                            ["<", ["pitch"], 60], ["<", ["get", "filter_rank"], 2],
                            ["all", [">=", ["pitch"], 60], ["<", ["distance-from-center"], 2]], [">", ["get", "filter_rank"], 4],
                            false
                        ],
                        static: ["any", ["<", ["get", "filter_rank"], 2], [">", ["get", "filter_rank"], 4], false]
                    },
                    {
                        dynamic: ["case",
                            ["<", ["pitch"], 60], ["<", ["get", "filter_rank"], 2],
                            ["all", [">=", ["pitch"], 60], ["<", ["distance-from-center"], 2]], [">", ["get", "filter_rank"], 4],
                            ["any", ["==", ["get", "filter_rank"], 2], ["==", ["get", "filter_rank"], 3]]
                        ],
                        static: ["any",
                            ["<", ["get", "filter_rank"], 2],
                            [">", ["get", "filter_rank"], 4],
                            ["any", ["==", ["get", "filter_rank"], 2], ["==", ["get", "filter_rank"], 3]]
                        ]
                    },
                    {
                        dynamic: ["all",
                            [
                                "match",
                                ["get", "class"],
                                "settlement_subdivision",
                                [
                                    "match",
                                    ["get", "worldview"],
                                    ["all", "US"],
                                    true,
                                    false
                                ],
                                "disputed_settlement_subdivision",
                                [
                                    "all",
                                    [
                                        "==",
                                        ["get", "disputed"],
                                        "true"
                                    ],
                                    [
                                        "case",
                                        ["<", ["pitch"], 60], ["==", ["get", "worldview"], "US"],
                                        ["all", [">=", ["pitch"], 60], ["<", ["distance-from-center"], 2]], ["==", ["get", "worldview"], "IND"],
                                        ["==", ["get", "worldview"], "INTL"]
                                    ]
                                ],
                                false
                            ],
                            [
                                "<=",
                                ["get", "filterrank"],
                                4
                            ]
                        ],
                        static: ["all",
                            [
                                "match",
                                ["get", "class"],
                                "settlement_subdivision",
                                [
                                    "match",
                                    ["get", "worldview"],
                                    ["all", "US"],
                                    true,
                                    false
                                ],
                                "disputed_settlement_subdivision",
                                [
                                    "all",
                                    [
                                        "==",
                                        ["get", "disputed"],
                                        "true"
                                    ],
                                    [
                                        "any",
                                        ["==", ["get", "worldview"], "US"],
                                        ["==", ["get", "worldview"], "IND"],
                                        ["==", ["get", "worldview"], "INTL"]
                                    ]
                                ],
                                false
                            ],
                            [
                                "<=",
                                ["get", "filterrank"],
                                4
                            ]
                        ]
                    },
                    {
                        dynamic: ["all",
                            [
                                "match",
                                ["get", "class"],
                                "settlement_subdivision",
                                [
                                    "match",
                                    ["get", "worldview"],
                                    ["all", "US"],
                                    true,
                                    false
                                ],
                                "disputed_settlement_subdivision",
                                [
                                    "all",
                                    [
                                        "==",
                                        ["get", "disputed"],
                                        "true"
                                    ],
                                    [
                                        "case",
                                        ["<", ["pitch"], 60], ["==", ["get", "worldview"], "US"],
                                        ["all", [">=", ["pitch"], 60], ["<", ["distance-from-center"], 2]], ["==", ["get", "worldview"], "IND"],
                                        ["==", ["get", "worldview"], "INTL"]
                                    ]
                                ],
                                false
                            ],
                            [
                                "case",
                                ["<", ["pitch"], 60], ["<", ["get", "filterrank"], 4],
                                [">=", ["get", "filterrank"], 5]
                            ]
                        ],
                        static: ["all",
                            [
                                "match",
                                ["get", "class"],
                                "settlement_subdivision",
                                [
                                    "match",
                                    ["get", "worldview"],
                                    ["all", "US"],
                                    true,
                                    false
                                ],
                                "disputed_settlement_subdivision",
                                [
                                    "all",
                                    [
                                        "==",
                                        ["get", "disputed"],
                                        "true"
                                    ],
                                    [
                                        "any",
                                        ["==", ["get", "worldview"], "US"],
                                        ["==", ["get", "worldview"], "IND"],
                                        ["==", ["get", "worldview"], "INTL"]
                                    ]
                                ],
                                false
                            ],
                            [
                                "any",
                                ["<", ["get", "filterrank"], 4],
                                [">=", ["get", "filterrank"], 5]
                            ]
                        ]
                    }
                ];

                for (const testCase of testCases) {
                    expect(extractStaticFilter(testCase.dynamic)).toEqual(testCase.static);
                    // Ensure input doesnt get mutated
                    expect(testCase.dynamic).not.toStrictEqual(testCase.static);
                }
            });

            test('it collapses dynamic match expressions to any expressions', () => {
                const testCases = [
                    {
                        dynamic: ["match",
                            ["pitch"],
                            [10, 20, 30], [ "<", ["get", "filterrank"], 2],
                            [70, 80], [ ">", ["get", "filterrank"], 5],
                            ["all", [ ">", ["get", "filterrank"], 2], [ "<", ["get", "filterrank"], 5]]
                        ],
                        static: ["any",
                            [ "<", ["get", "filterrank"], 2],
                            [ ">", ["get", "filterrank"], 5],
                            ["all", [ ">", ["get", "filterrank"], 2], [ "<", ["get", "filterrank"], 5]]
                        ]
                    },
                    {
                        dynamic: ["all",
                            [
                                "match",
                                ["get", "class"],
                                "settlement_subdivision",
                                [
                                    "match",
                                    ["get", "worldview"],
                                    ["all", "US"],
                                    true,
                                    false
                                ],
                                "disputed_settlement_subdivision",
                                [
                                    "all",
                                    [
                                        "match",
                                        ["distance-from-center"],
                                        [1, 2], ["==", ["get", "worldview"], "US"],
                                        [4, 5], ["==", ["get", "worldview"], "IND"],
                                        ["==", ["get", "worldview"], "INTL"]
                                    ],
                                    [
                                        "case",
                                        ["<", ["pitch"], 60], ["==", ["get", "worldview"], "US"],
                                        ["all", [">=", ["pitch"], 60], ["<", ["distance-from-center"], 2]], ["==", ["get", "worldview"], "IND"],
                                        ["==", ["get", "worldview"], "INTL"]
                                    ]
                                ],
                                false
                            ],
                            [
                                "<=",
                                ["get", "filterrank"],
                                4
                            ]
                        ],
                        static: ["all",
                            [
                                "match",
                                ["get", "class"],
                                "settlement_subdivision",
                                [
                                    "match",
                                    ["get", "worldview"],
                                    ["all", "US"],
                                    true,
                                    false
                                ],
                                "disputed_settlement_subdivision",
                                [
                                    "all",
                                    [
                                        "any",
                                        ["==", ["get", "worldview"], "US"],
                                        ["==", ["get", "worldview"], "IND"],
                                        ["==", ["get", "worldview"], "INTL"]
                                    ],
                                    [
                                        "any",
                                        ["==", ["get", "worldview"], "US"],
                                        ["==", ["get", "worldview"], "IND"],
                                        ["==", ["get", "worldview"], "INTL"]
                                    ]
                                ],
                                false
                            ],
                            [
                                "<=",
                                ["get", "filterrank"],
                                4
                            ]
                        ]
                    }
                ];

                for (const testCase of testCases) {
                    expect(extractStaticFilter(testCase.dynamic)).toEqual(testCase.static);
                    // Ensure input doesnt get mutated
                    expect(testCase.dynamic).not.toStrictEqual(testCase.static);
                }
            });

            test('it collapses dynamic step expressions to any expressions', () => {
                const testCases = [
                    {
                        dynamic: [
                            "all",
                            [
                                "<=",
                                ["get", "filterrank"],
                                3
                            ],
                            [
                                "match",
                                ["get", "class"],
                                "settlement",
                                [
                                    "match",
                                    ["get", "worldview"],
                                    ["all", "US"],
                                    true,
                                    false
                                ],
                                "disputed_settlement",
                                [
                                    "all",
                                    [
                                        "==",
                                        ["get", "disputed"],
                                        "true"
                                    ],
                                    [
                                        "match",
                                        ["get", "worldview"],
                                        ["all", "US"],
                                        true,
                                        false
                                    ]
                                ],
                                false
                            ],
                            [
                                "step",
                                ["pitch"],
                                true,
                                10,
                                [
                                    ">=",
                                    ["get", "symbolrank"],
                                    10
                                ],
                                20,
                                [
                                    ">=",
                                    ["get", "symbolrank"],
                                    20
                                ],
                                30,
                                [
                                    ">=",
                                    ["get", "symbolrank"],
                                    30
                                ],
                                40,
                                [
                                    ">=",
                                    ["get", "symbolrank"],
                                    40
                                ],
                                50,
                                [
                                    ">=",
                                    ["get", "symbolrank"],
                                    50
                                ],
                                60,
                                [
                                    ">=",
                                    ["get", "symbolrank"],
                                    60
                                ]
                            ]
                        ],
                        static: [
                            "all",
                            [
                                "<=",
                                ["get", "filterrank"],
                                3
                            ],
                            [
                                "match",
                                ["get", "class"],
                                "settlement",
                                [
                                    "match",
                                    ["get", "worldview"],
                                    ["all", "US"],
                                    true,
                                    false
                                ],
                                "disputed_settlement",
                                [
                                    "all",
                                    [
                                        "==",
                                        ["get", "disputed"],
                                        "true"
                                    ],
                                    [
                                        "match",
                                        ["get", "worldview"],
                                        ["all", "US"],
                                        true,
                                        false
                                    ]
                                ],
                                false
                            ],
                            [
                                "any",
                                true,
                                [
                                    ">=",
                                    ["get", "symbolrank"],
                                    10
                                ],
                                [
                                    ">=",
                                    ["get", "symbolrank"],
                                    20
                                ],
                                [
                                    ">=",
                                    ["get", "symbolrank"],
                                    30
                                ],
                                [
                                    ">=",
                                    ["get", "symbolrank"],
                                    40
                                ],
                                [
                                    ">=",
                                    ["get", "symbolrank"],
                                    50
                                ],
                                [
                                    ">=",
                                    ["get", "symbolrank"],
                                    60
                                ]
                            ]
                        ]
                    }
                ];

                for (const testCase of testCases) {
                    expect(extractStaticFilter(testCase.dynamic)).toEqual(testCase.static);
                    // Ensure input doesnt get mutated
                    expect(testCase.dynamic).not.toStrictEqual(testCase.static);
                }
            });

            test('it collapses dynamic conditionals to true', () => {
                const testCases = [
                    {
                        dynamic: ["<", ["pitch"], 60],
                        static: true
                    },
                    {
                        dynamic: ["all", ["<", ["pitch"], 60], ["<", ["distance-from-center"], 4]],
                        static: ["all", true, true]
                    },
                    {
                        dynamic: ["all", ["<", ["+", ["*", ["pitch"], 2], 5], 60], ["<", ["+", ["distance-from-center"], 1], 4]],
                        static: ["all", true, true]
                    },
                    {
                        dynamic: [
                            "all",
                            [
                                "<=",
                                ["get", "filterrank"],
                                3
                            ],
                            [
                                "match",
                                ["get", "class"],
                                "settlement",
                                [
                                    "match",
                                    ["get", "worldview"],
                                    ["all", "US"],
                                    true,
                                    false
                                ],
                                "disputed_settlement",
                                [
                                    "all",
                                    [
                                        "==",
                                        ["get", "disputed"],
                                        "true"
                                    ],
                                    [
                                        "match",
                                        ["get", "worldview"],
                                        ["all", "US"],
                                        true,
                                        false
                                    ]
                                ],
                                false
                            ],
                            [
                                "step",
                                ["zoom"],
                                true,
                                8,
                                [
                                    ">=",
                                    ["get", "symbolrank"],
                                    11
                                ],
                                10,
                                [
                                    ">=",
                                    ["get", "symbolrank"],
                                    12
                                ],
                                11,
                                [
                                    ">=",
                                    ["get", "symbolrank"],
                                    13
                                ],
                                12,
                                [
                                    ">=",
                                    ["get", "symbolrank"],
                                    15
                                ],
                                13,
                                [
                                    ">=",
                                    ["get", "symbolrank"],
                                    11
                                ],
                                14,
                                [
                                    ">=",
                                    ["get", "symbolrank"],
                                    13
                                ]
                            ],
                            [
                                "<=",
                                ["pitch"],
                                60
                            ],
                            [
                                "<=",
                                ["distance-from-center"],
                                2
                            ]
                        ],
                        static: [
                            "all",
                            [
                                "<=",
                                ["get", "filterrank"],
                                3
                            ],
                            [
                                "match",
                                ["get", "class"],
                                "settlement",
                                [
                                    "match",
                                    ["get", "worldview"],
                                    ["all", "US"],
                                    true,
                                    false
                                ],
                                "disputed_settlement",
                                [
                                    "all",
                                    [
                                        "==",
                                        ["get", "disputed"],
                                        "true"
                                    ],
                                    [
                                        "match",
                                        ["get", "worldview"],
                                        ["all", "US"],
                                        true,
                                        false
                                    ]
                                ],
                                false
                            ],
                            [
                                "step",
                                ["zoom"],
                                true,
                                8,
                                [
                                    ">=",
                                    ["get", "symbolrank"],
                                    11
                                ],
                                10,
                                [
                                    ">=",
                                    ["get", "symbolrank"],
                                    12
                                ],
                                11,
                                [
                                    ">=",
                                    ["get", "symbolrank"],
                                    13
                                ],
                                12,
                                [
                                    ">=",
                                    ["get", "symbolrank"],
                                    15
                                ],
                                13,
                                [
                                    ">=",
                                    ["get", "symbolrank"],
                                    11
                                ],
                                14,
                                [
                                    ">=",
                                    ["get", "symbolrank"],
                                    13
                                ]
                            ],
                            true,
                            true
                        ]
                    }
                ];
                for (const testCase of testCases) {
                    expect(extractStaticFilter(testCase.dynamic)).toEqual(testCase.static);
                    // Ensure input doesnt get mutated
                    expect(testCase.dynamic).not.toStrictEqual(testCase.static);
                }
            });
        });
    });

    legacyFilterTests(createFilter);
});

describe('legacy filter detection', () => {
    test('definitely legacy filters', () => {
        // Expressions with more than two arguments.
        expect(isExpressionFilter(["in", "color", "red", "blue"])).toBeFalsy();

        // Expressions where the second argument is not a string or array.
        expect(isExpressionFilter(["in", "value", 42])).toBeFalsy();
        expect(isExpressionFilter(["in", "value", true])).toBeFalsy();
    });

    test('ambiguous value', () => {
        // Should err on the side of reporting as a legacy filter. Style authors can force filters
        // by using a literal expression as the first argument.
        expect(isExpressionFilter(["in", "color", "red"])).toBeFalsy();
    });

    test('definitely expressions', () => {
        expect(isExpressionFilter(["in", ["get", "color"], "reddish"])).toBeTruthy();
        expect(isExpressionFilter(["in", ["get", "color"], ["red", "blue"]])).toBeTruthy();
        expect(isExpressionFilter(["in", 42, 42])).toBeTruthy();
        expect(isExpressionFilter(["in", true, true])).toBeTruthy();
        expect(isExpressionFilter(["in", "red", ["get", "colors"]])).toBeTruthy();
    });
});

describe('convert legacy filters to expressions', () => {
    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    legacyFilterTests((f) => {
        const converted = convertFilter(f);
        return createFilter(converted);
    });

    test('mimic legacy type mismatch semantics', () => {
        const filter = ["any",
            ["all", [">", "y", 0], [">", "y", 0]],
            [">", "x", 0]
        ];

        const converted = convertFilter(filter);
        const f = createFilter(converted).filter;

        expect(f({zoom: 0}, {properties: {x: 0, y: 1, z: 1}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {x: 1, y: 0, z: 1}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {x: 0, y: 0, z: 1}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {x: null, y: 1, z: 1}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {x: 1, y: null, z: 1}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {x: null, y: null, z: 1}})).toEqual(false);
    });

    test('flattens nested, single child all expressions', () => {
        const filter = [
            "all",
            [
                "in",
                "$type",
                "Polygon",
                "LineString",
                "Point"
            ],
            [
                "all",
                ["in", "type", "island"]
            ]
        ];

        const expected = [
            "all",
            [
                "match",
                ["geometry-type"],
                ["LineString", "Point", "Polygon"],
                true,
                false
            ],
            [
                "match",
                ["get", "type"],
                ["island"],
                true,
                false
            ]
        ];

        const converted = convertFilter(filter);
        expect(converted).toStrictEqual(expected);
    });

    test('removes duplicates when outputting match expressions', () => {
        const filter = [
            "in",
            "$id",
            1,
            2,
            3,
            2,
            1
        ];

        const expected = [
            "match",
            ["id"],
            [1, 2, 3],
            true,
            false
        ];

        const converted = convertFilter(filter);
        expect(converted).toStrictEqual(expected);
    });
});

function legacyFilterTests(createFilterExpr) {
    test('degenerate', () => {
        expect(createFilterExpr().filter()).toEqual(true);
        expect(createFilterExpr(undefined).filter()).toEqual(true);
        expect(createFilterExpr(null).filter()).toEqual(true);
    });

    test('==, string', () => {
        const f = createFilterExpr(['==', 'foo', 'bar']).filter;
        expect(f({zoom: 0}, {properties: {foo: 'bar'}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: 'baz'}})).toEqual(false);
    });

    test('==, number', () => {
        const f = createFilterExpr(['==', 'foo', 0]).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: true}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {}})).toEqual(false);
    });

    test('==, null', () => {
        const f = createFilterExpr(['==', 'foo', null]).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: true}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toEqual(true);
        // t.equal(f({zoom: 0}, {properties: {foo: undefined}}), false);
        expect(f({zoom: 0}, {properties: {}})).toEqual(false);
    });

    test('==, $type', () => {
        const f = createFilterExpr(['==', '$type', 'LineString']).filter;
        expect(f({zoom: 0}, {type: 1})).toEqual(false);
        expect(f({zoom: 0}, {type: 2})).toEqual(true);
    });

    test('==, $id', () => {
        const f = createFilterExpr(['==', '$id', 1234]).filter;

        expect(f({zoom: 0}, {id: 1234})).toEqual(true);
        expect(f({zoom: 0}, {id: '1234'})).toEqual(false);
        expect(f({zoom: 0}, {properties: {id: 1234}})).toEqual(false);
    });

    test('!=, string', () => {
        const f = createFilterExpr(['!=', 'foo', 'bar']).filter;
        expect(f({zoom: 0}, {properties: {foo: 'bar'}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: 'baz'}})).toEqual(true);
    });

    test('!=, number', () => {
        const f = createFilterExpr(['!=', 'foo', 0]).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: true}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: false}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: null}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {}})).toEqual(true);
    });

    test('!=, null', () => {
        const f = createFilterExpr(['!=', 'foo', null]).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: true}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: false}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: null}})).toEqual(false);
        // t.equal(f({zoom: 0}, {properties: {foo: undefined}}), true);
        expect(f({zoom: 0}, {properties: {}})).toEqual(true);
    });

    test('!=, $type', () => {
        const f = createFilterExpr(['!=', '$type', 'LineString']).filter;
        expect(f({zoom: 0}, {type: 1})).toEqual(true);
        expect(f({zoom: 0}, {type: 2})).toEqual(false);
    });

    test('<, number', () => {
        const f = createFilterExpr(['<', 'foo', 0]).filter;
        expect(f({zoom: 0}, {properties: {foo: 1}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: 0}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: -1}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: '1'}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: '-1'}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: true}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {}})).toEqual(false);
    });

    test('<, string', () => {
        const f = createFilterExpr(['<', 'foo', '0']).filter;
        expect(f({zoom: 0}, {properties: {foo: -1}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: 0}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: '1'}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: '-1'}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: true}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toEqual(false);
    });

    test('<=, number', () => {
        const f = createFilterExpr(['<=', 'foo', 0]).filter;
        expect(f({zoom: 0}, {properties: {foo: 1}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: 0}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: -1}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: '1'}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: '-1'}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: true}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {}})).toEqual(false);
    });

    test('<=, string', () => {
        const f = createFilterExpr(['<=', 'foo', '0']).filter;
        expect(f({zoom: 0}, {properties: {foo: -1}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: 0}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: '1'}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: '-1'}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: true}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toEqual(false);
    });

    test('>, number', () => {
        const f = createFilterExpr(['>', 'foo', 0]).filter;
        expect(f({zoom: 0}, {properties: {foo: 1}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: 0}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: -1}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: '1'}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: '-1'}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: true}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {}})).toEqual(false);
    });

    test('>, string', () => {
        const f = createFilterExpr(['>', 'foo', '0']).filter;
        expect(f({zoom: 0}, {properties: {foo: -1}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: 0}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: '1'}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: '-1'}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: true}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toEqual(false);
    });

    test('>=, number', () => {
        const f = createFilterExpr(['>=', 'foo', 0]).filter;
        expect(f({zoom: 0}, {properties: {foo: 1}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: 0}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: -1}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: '1'}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: '-1'}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: true}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {}})).toEqual(false);
    });

    test('>=, string', () => {
        const f = createFilterExpr(['>=', 'foo', '0']).filter;
        expect(f({zoom: 0}, {properties: {foo: -1}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: 0}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: '1'}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: '-1'}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: true}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toEqual(false);
    });

    test('in, degenerate', () => {
        const f = createFilterExpr(['in', 'foo']).filter;
        expect(f({zoom: 0}, {properties: {foo: 1}})).toEqual(false);
    });

    test('in, string', () => {
        const f = createFilterExpr(['in', 'foo', '0']).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: true}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {}})).toEqual(false);
    });

    test('in, number', () => {
        const f = createFilterExpr(['in', 'foo', 0]).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: true}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toEqual(false);
    });

    test('in, null', () => {
        const f = createFilterExpr(['in', 'foo', null]).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: true}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toEqual(true);
    });

    test('in, multiple', () => {
        const f = createFilterExpr(['in', 'foo', 0, 1]).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: 3}})).toEqual(false);
    });

    test('in, large_multiple', () => {
        const values = Array.from({length: 2000}).map(Number.call, Number);
        values.reverse();
        const f = createFilterExpr(['in', 'foo'].concat(values)).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: 1999}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: 2000}})).toEqual(false);
    });

    test('in, large_multiple, heterogeneous', () => {
        const values = Array.from({length: 2000}).map(Number.call, Number);
        values.push('a');
        values.unshift('b');
        const f = createFilterExpr(['in', 'foo'].concat(values)).filter;
        expect(f({zoom: 0}, {properties: {foo: 'b'}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: 'a'}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: 0}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: 1999}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: 2000}})).toEqual(false);
    });

    test('in, $type', () => {
        const f = createFilterExpr(['in', '$type', 'LineString', 'Polygon']).filter;
        expect(f({zoom: 0}, {type: 1})).toEqual(false);
        expect(f({zoom: 0}, {type: 2})).toEqual(true);
        expect(f({zoom: 0}, {type: 3})).toEqual(true);

        const f1 = createFilterExpr(['in', '$type', 'Polygon', 'LineString', 'Point']).filter;
        expect(f1({zoom: 0}, {type: 1})).toEqual(true);
        expect(f1({zoom: 0}, {type: 2})).toEqual(true);
        expect(f1({zoom: 0}, {type: 3})).toEqual(true);
    });

    test('!in, degenerate', () => {
        const f = createFilterExpr(['!in', 'foo']).filter;
        expect(f({zoom: 0}, {properties: {foo: 1}})).toEqual(true);
    });

    test('!in, string', () => {
        const f = createFilterExpr(['!in', 'foo', '0']).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {}})).toEqual(true);
    });

    test('!in, number', () => {
        const f = createFilterExpr(['!in', 'foo', 0]).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: null}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toEqual(true);
    });

    test('!in, null', () => {
        const f = createFilterExpr(['!in', 'foo', null]).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: null}})).toEqual(false);
    });

    test('!in, multiple', () => {
        const f = createFilterExpr(['!in', 'foo', 0, 1]).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: 3}})).toEqual(true);
    });

    test('!in, large_multiple', () => {
        const f = createFilterExpr(['!in', 'foo'].concat(Array.from({length: 2000}).map(Number.call, Number))).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: 1999}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: 2000}})).toEqual(true);
    });

    test('!in, $type', () => {
        const f = createFilterExpr(['!in', '$type', 'LineString', 'Polygon']).filter;
        expect(f({zoom: 0}, {type: 1})).toEqual(true);
        expect(f({zoom: 0}, {type: 2})).toEqual(false);
        expect(f({zoom: 0}, {type: 3})).toEqual(false);
    });

    test('any', () => {
        const f1 = createFilterExpr(['any']).filter;
        expect(f1({zoom: 0}, {properties: {foo: 1}})).toEqual(false);

        const f2 = createFilterExpr(['any', ['==', 'foo', 1]]).filter;
        expect(f2({zoom: 0}, {properties: {foo: 1}})).toEqual(true);

        const f3 = createFilterExpr(['any', ['==', 'foo', 0]]).filter;
        expect(f3({zoom: 0}, {properties: {foo: 1}})).toEqual(false);

        const f4 = createFilterExpr(['any', ['==', 'foo', 0], ['==', 'foo', 1]]).filter;
        expect(f4({zoom: 0}, {properties: {foo: 1}})).toEqual(true);
    });

    test('all', () => {
        const f1 = createFilterExpr(['all']).filter;
        expect(f1({zoom: 0}, {properties: {foo: 1}})).toEqual(true);

        const f2 = createFilterExpr(['all', ['==', 'foo', 1]]).filter;
        expect(f2({zoom: 0}, {properties: {foo: 1}})).toEqual(true);

        const f3 = createFilterExpr(['all', ['==', 'foo', 0]]).filter;
        expect(f3({zoom: 0}, {properties: {foo: 1}})).toEqual(false);

        const f4 = createFilterExpr(['all', ['==', 'foo', 0], ['==', 'foo', 1]]).filter;
        expect(f4({zoom: 0}, {properties: {foo: 1}})).toEqual(false);
    });

    test('none', () => {
        const f1 = createFilterExpr(['none']).filter;
        expect(f1({zoom: 0}, {properties: {foo: 1}})).toEqual(true);

        const f2 = createFilterExpr(['none', ['==', 'foo', 1]]).filter;
        expect(f2({zoom: 0}, {properties: {foo: 1}})).toEqual(false);

        const f3 = createFilterExpr(['none', ['==', 'foo', 0]]).filter;
        expect(f3({zoom: 0}, {properties: {foo: 1}})).toEqual(true);

        const f4 = createFilterExpr(['none', ['==', 'foo', 0], ['==', 'foo', 1]]).filter;
        expect(f4({zoom: 0}, {properties: {foo: 1}})).toEqual(false);
    });

    test('has', () => {
        const f = createFilterExpr(['has', 'foo']).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: true}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: false}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: null}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toEqual(true);
        expect(f({zoom: 0}, {properties: {}})).toEqual(false);
    });

    test('!has', () => {
        const f = createFilterExpr(['!has', 'foo']).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toEqual(false);
        expect(f({zoom: 0}, {properties: {}})).toEqual(true);
    });
}
