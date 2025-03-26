import Transform from "../../../src/geo/transform";
import {Evented} from "../../../src/util/evented";
import {RequestManager} from "../../../src/util/mapbox";

export class StubMap extends Evented {
    transform: Transform;
    _requestManager: RequestManager;
    _markers: any[];
    _triggerCameraUpdate: () => void;
    _prioritizeAndUpdateProjection: () => void;

    constructor() {
        super();
        this.transform = new Transform();
        this._requestManager = new RequestManager();
        this._markers = [];
        this._triggerCameraUpdate = () => {};
        this._prioritizeAndUpdateProjection = () => {};
    }

    getScaleFactor() {}

    setCamera() {}

    _getMapId() {
        return 1;
    }

    getWorldview() {}
}
