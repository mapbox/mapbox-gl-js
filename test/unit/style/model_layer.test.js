import {test} from '../../util/test.js';
import Style from '../../../src/style/style.js';
import Transform from '../../../src/geo/transform.js';
import {RequestManager} from '../../../src/util/mapbox.js';
import {Evented} from '../../../src/util/evented.js';
import window from '../../../src/util/window.js';

class StubMap extends Evented {
    constructor() {
        super();
        this.transform = new Transform();
        this._requestManager = new RequestManager();
        this._markers = [];
        this._prioritizeAndUpdateProjection = () => {};
    }

    setCamera() {}

    _getMapId() {
        return 1;
    }
}

test('ModelLayer#loadStyleExpressionConstraint', (t) => {
    t.beforeEach(() => {
        window.useFakeXMLHttpRequest();
    });

    t.afterEach(() => {
        window.restore();
    });

    t.test('validates the style', (t) => {
        const style = new Style(new StubMap());
        let errorCount = 0;

        style.on('error', ({error}) => {
            t.ok(error);
            switch (errorCount) {
            case 0:
                t.match(error.message, /model\-emissive\-strength does not support measure\-light/);
                break;
            case 1:
                t.match(error.message, /model\-color does not support measure\-light/);
                break;
            default:
                t.match(error.message, /model\-color\-mix\-intensity does not support measure\-light/);
            }
            errorCount++;
            if (errorCount === 3) {
                t.end();
            }
        });

        style.loadURL('style.json');
        window.server.respondWith(JSON.stringify({
            "version": 8,
            "sources": {
                "trees": {
                    "type": "vector",
                    "url": "mapbox://mapbox.mapbox-models-v1"
                }
            },
            "layers": [
                {
                    "source": "trees",
                    "source-layer": "tree",
                    "type": "model",
                    "id": "trees",
                    "layout": {
                        "model-id": "id"
                    },
                    "paint": {
                        "model-scale": [
                            "interpolate",
                            [ "linear" ],
                            [ "zoom" ],
                            14.2,
                            [
                                1.0,
                                1.0,
                                0.0
                            ],
                            14.5,
                            [
                                1.0,
                                1.0,
                                1.0
                            ]
                        ],
                        "model-emissive-strength": [
                            "match",
                            [
                                "get",
                                "part"
                            ],
                            "door",
                            [
                                "interpolate",
                                [ "linear" ],
                                [ "measure-light", "brightness" ],
                                0.2,
                                1.5,
                                0.4,
                                2.5
                            ],
                            "logo",
                            0.8,
                            "window",
                            [
                                "random",
                                0.4,
                                1.2,
                                [
                                    "id"
                                ]
                            ],
                            0.0
                        ],
                        "model-color": [
                            "interpolate",
                            [ "linear" ],
                            [ "measure-light", "brightness" ],
                            0, "white",
                            0.15, "yellow"
                        ],
                        "model-color-mix-intensity": [
                            "interpolate",
                            [ "linear" ],
                            [ "measure-light", "brightness" ],
                            0, 0,
                            0.15, 1
                        ]
                    }
                }
            ]
        }));
        window.server.respond();
    });

    t.end();
});

