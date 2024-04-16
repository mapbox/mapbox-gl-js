import {describe, test, beforeAll, afterEach, afterAll, expect} from "../../util/vitest.js";
import {getNetworkWorker, http, HttpResponse} from '../../util/network.js';
import Style from '../../../src/style/style.js';
import Transform from '../../../src/geo/transform.js';
import {RequestManager} from '../../../src/util/mapbox.js';
import {Evented} from '../../../src/util/evented.js';

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

let networkWorker;

beforeAll(async () => {
    networkWorker = await getNetworkWorker(window);
});

afterEach(() => {
    networkWorker.resetHandlers();
});

afterAll(() => {
    networkWorker.stop();
});

describe('ModelLayer#loadStyleExpressionConstraint', () => {
    test('validates the style', async () => {
        networkWorker.use(
            http.get('/style.json', async () => {
                return HttpResponse.json({
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

                });
            }),
        );

        const style = new Style(new StubMap());
        let errorCount = 0;

        await new Promise(resolve => {
            style.on('error', ({error}) => {

                expect(error).toBeTruthy();
                switch (errorCount) {
                case 0:
                    expect(error.message).toMatch(/model\-emissive\-strength does not support measure\-light/);
                    break;
                case 1:
                    expect(error.message).toMatch(/model\-color does not support measure\-light/);
                    break;
                default:
                    expect(error.message).toMatch(/model\-color\-mix\-intensity does not support measure\-light/);
                }
                errorCount++;
                if (errorCount === 3) {
                    resolve();
                }
            });

            style.loadURL('/style.json');
        });
    });
});

