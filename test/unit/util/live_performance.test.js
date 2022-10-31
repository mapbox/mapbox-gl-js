import {test} from '../../util/test.js';
import window from '../../../src/util/window.js';
import {getLivePerformanceMetrics} from '../../../src/util/live_performance.js';
import {version} from '../../../package.json';

test('LivePerformance', (t) => {
    t.beforeEach(() => {
        window.useFakeXMLHttpRequest();
    });

    t.afterEach(() => {
        window.restore();
    });

    t.test('getLivePerformanceMetrics', (t) => {
        window.performance.getEntriesByType = (type) => {
            if (type === 'resource') {
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
            interactionRange: [0, 0],
            projection: 'mercator',
            vendor: 'webgl vendor',
            renderer: 'webgl renderer'
        });
        t.deepEqual(metrics.counters, [
            {name: 'cssTransferStart', value: '25'},
            {name: 'cssTransferEnd', value: '52'},
            {name: 'javascriptTransferStart', value: '25'},
            {name: 'javascriptTransferEnd', value: '417'},
            {name: 'styleTransferStart', value: '784'},
            {name: 'styleTransferEnd', value: '795'},
            {name: 'tilejsonTransferStart', value: '809'},
            {name: 'tilejsonTransferEnd', value: '870'},
            {name: 'spriteTransferStart', value: '810'},
            {name: 'spriteTransferEnd', value: '900'},
            {name: 'fontTransferStart', value: '1509.5'},
            {name: 'fontTransferEnd', value: '1544.5'}
        ]);
        t.deepEqual(metrics.metadata, [
            {name: 'devicePixelRatio', value: '1'},
            {name: 'cpuCores', value: window.navigator.hardwareConcurrency.toString()},
            {
                name: 'userAgent',
                value: window.navigator.userAgent
            },
            {name: 'windowWidth', value: '1024'},
            {name: 'windowHeight', value: '768'},
            {name: 'mapWidth', value: '100'},
            {name: 'mapHeight', value: '50'},
            {name: 'webglRenderer', value: 'webgl renderer'},
            {name: 'webglVendor', value: 'webgl vendor'},
            {name: 'sdkVersion', value: version},
            {name: 'sdkIdentifier', value: 'mapbox-gl-js'}
        ]);
        t.deepEqual(metrics.attributes, [
            {name: 'style', value: 'mapbox:streets-v11'},
            {name: 'terrainEnabled', value: 'false'},
            {name: 'fogEnabled', value: 'false'}
        ]);
        t.end();
    });

    t.end();
});
