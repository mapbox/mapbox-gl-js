import {describe, test, expect} from "../../util/vitest.js";
import {getLivePerformanceMetrics} from '../../../src/util/live_performance.js';
import {version} from '../../../package.json';

describe('LivePerformance', () => {
    test('getLivePerformanceMetrics', () => {
        window.performance.getEntriesByType = (type) => {
            if (type === 'mark') {
                return [
                    {
                        "name": "library-evaluate",
                        "entryType": "mark",
                        "startTime": 664.9000000357628,
                        "duration": 0
                    },
                    {
                        "name": "create",
                        "entryType": "mark",
                        "startTime": 716.6000000238419,
                        "duration": 0
                    },
                    {
                        "name": "frame",
                        "entryType": "mark",
                        "startTime": 741,
                        "duration": 0
                    },
                    {
                        "name": "render",
                        "entryType": "mark",
                        "startTime": 741.1999999880791,
                        "duration": 0
                    },
                    {
                        "name": "load",
                        "entryType": "mark",
                        "startTime": 2076.900000035763,
                        "duration": 0
                    },
                    {
                        "name": "fullLoad",
                        "entryType": "mark",
                        "startTime": 112120.10000002384,
                        "duration": 0
                    }
                ];
            } else if (type === 'resource') {
                return [
                    {
                        "name": "https://api.mapbox.com/mapbox-gl-js/v2.10.0/mapbox-gl.css",
                        "startTime": 25,
                        "responseEnd": 52
                    },
                    {
                        "name": "https://api.mapbox.com/mapbox-gl-js/v2.10.0/mapbox-gl.js",
                        "startTime": 25,
                        "responseEnd": 417
                    },
                    {
                        "name": "https://api.mapbox.com/styles/v1/mapbox/streets-v11?access_token=pk.eyJ1IjoiY2x",
                        "startTime": 784,
                        "responseEnd": 795
                    },
                    {
                        "name": "https://api.mapbox.com/v4/mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2.json?secure&access_token=pk.eyJ1IjoiY2x",
                        "startTime": 809,
                        "responseEnd": 870
                    },
                    {
                        "name": "https://api.mapbox.com/styles/v1/mapbox/streets-v11/sprite@2x.json?access_token=pk.eyJ1IjoiY2x",
                        "startTime": 810,
                        "responseEnd": 863
                    },
                    {
                        "name": "https://api.mapbox.com/styles/v1/mapbox/streets-v11/sprite@2x.png?access_token=pk.eyJ1IjoiY2x",
                        "startTime": 810,
                        "responseEnd": 900
                    },
                    {
                        "name": "https://events.mapbox.com/events/v2?access_token=pk.eyJ1IjoiY2x",
                        "startTime": 1190,
                        "responseEnd": 1264
                    },
                    {
                        "name": "https://api.mapbox.com/fonts/v1/mapbox/DIN%20Offc%20Pro%20Regular,Arial%20Unicode%20MS%20Regular/0-255.pbf?access_token=pk.eyJ1IjoiY2x",
                        "startTime": 1509.5,
                        "responseEnd": 1532.5
                    },
                    {
                        "name": "https://api.mapbox.com/fonts/v1/mapbox/DIN%20Offc%20Pro%20Regular,Arial%20Unicode%20MS%20Regular/8192-8447.pbf?access_token=pk.eyJ1IjoiY2x",
                        "startTime": 1510,
                        "responseEnd": 1520.5
                    },
                    {
                        "name": "https://api.mapbox.com/fonts/v1/mapbox/DIN%20Offc%20Pro%20Bold,Arial%20Unicode%20MS%20Bold/0-255.pbf?access_token=pk.eyJ1IjoiY2x",
                        "startTime": 1510.5,
                        "responseEnd": 1530
                    },
                    {
                        "name": "https://api.mapbox.com/fonts/v1/mapbox/DIN%20Offc%20Pro%20Medium,Arial%20Unicode%20MS%20Regular/0-255.pbf?access_token=pk.eyJ1IjoiY2x",
                        "startTime": 1511,
                        "responseEnd": 1536
                    },
                    {
                        "name": "https://api.mapbox.com/fonts/v1/mapbox/DIN%20Offc%20Pro%20Medium,Arial%20Unicode%20MS%20Regular/8192-8447.pbf?access_token=pk.eyJ1IjoiY2x",
                        "startTime": 1528,
                        "responseEnd": 1544.5
                    },
                    {
                        "name": "https://docs.mapbox.com/mapbox-gl-js/assets/vendor-4bc283c6a472dc89ca08.chunk.js",
                        "startTime": 407.20000000298023,
                        "responseEnd": 493.70000000298023
                    },
                    {
                        "name": "https://api.mapbox.com/mapbox-assembly/fonts/opensans-bold.v1.woff2",
                        "startTime": 475.1000000089407,
                        "responseEnd": 479
                    },
                    {
                        "name": "https://www.mapbox.com/api/session",
                        "startTime": 1208.800000011921,
                        "responseEnd": 1488.5
                    },
                    {
                        "name": "https://www.google-analytics.com/analytics.js",
                        "startTime": 1273.5,
                        "responseEnd": 1287
                    },
                    {
                        "name": "https://static-assets.mapbox.com/branding/favicon/v1/site.webmanifest?v=gAd4JjrGWl",
                        "startTime": 1679.4000000059605,
                        "responseEnd": 1685
                    }
                ];
            }
        };
        const metrics = getLivePerformanceMetrics({
            width: 100,
            height: 50,
            interactionRange: [Infinity, -Infinity],
            projection: 'mercator',
            vendor: 'webgl vendor',
            renderer: 'webgl renderer',
            zoom: 5
        });
        expect(metrics.counters).toEqual([
            {name: 'cssResolveRangeMin', value: '25'},
            {name: 'cssResolveRangeMax', value: '52'},
            {name: 'cssRequestCount', value: '1'},
            {name: 'javascriptResolveRangeMin', value: '25'},
            {name: 'javascriptResolveRangeMax', value: '417'},
            {name: 'javascriptRequestCount', value: '1'},
            {name: 'styleResolveRangeMin', value: '784'},
            {name: 'styleResolveRangeMax', value: '795'},
            {name: 'styleRequestCount', value: '1'},
            {name: 'tilejsonResolveRangeMin', value: '809'},
            {name: 'tilejsonResolveRangeMax', value: '870'},
            {name: 'tilejsonRequestCount', value: '1'},
            {name: 'spriteResolveRangeMin', value: '810'},
            {name: 'spriteResolveRangeMax', value: '900'},
            {name: 'spriteRequestCount', value: '2'},
            {name: 'fontRangeResolveRangeMin', value: '1509.5'},
            {name: 'fontRangeResolveRangeMax', value: '1544.5'},
            {name: 'fontRangeRequestCount', value: '5'},
            {name: 'create', value: '716.6000000238419'},
            {name: 'load', value: '2076.900000035763'},
            {name: 'fullLoad', value: '112120.10000002384'},
        ]);
        expect(metrics.metadata).toEqual([
            {name: 'devicePixelRatio', value: '1'},
            {name: 'connectionEffectiveType', value: '4g'},
            {
                name: 'navigatorUserAgent',
                value: window.navigator.userAgent
            },
            {name: 'screenWidth', value: window.screen.width.toString()},
            {name: 'screenHeight', value: window.screen.height.toString()},
            {name: 'windowWidth', value: '300'},
            {name: 'windowHeight', value: '150'},
            {name: 'mapWidth', value: '100'},
            {name: 'mapHeight', value: '50'},
            {name: 'webglRenderer', value: 'webgl renderer'},
            {name: 'webglVendor', value: 'webgl vendor'},
            {name: 'sdkVersion', value: version},
            {name: 'sdkIdentifier', value: 'mapbox-gl-js'}
        ]);
        expect(metrics.attributes).toEqual([
            {name: 'style', value: 'mapbox://styles/mapbox/streets-v11'},
            {name: 'terrainEnabled', value: 'false'},
            {name: 'fogEnabled', value: 'false'},
            {name: 'projection', value: 'mercator'},
            {name: 'zoom', value: '5'}
        ]);
    });
});
