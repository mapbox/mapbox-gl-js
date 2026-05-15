import Transform from "../../../src/geo/transform";
import Style from "../../../src/style/style";
import {Evented} from "../../../src/util/evented";
import {RequestManager} from "../../../src/util/mapbox";

export class StubMap extends Evented {
    transform: Transform;
    style: Style;
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

    getIndoorTileOptions(source: string, scope: string) {
        return null;
    }
}

// Real Map sets `map.style` itself in Map._updateStyle; StubMap doesn't, so
// fragment Styles that read `this.map.style` (e.g. _reloadImports checking the
// root style's initial-broadcast flag) crash without this wiring. Use this
// helper in place of `new Style(new StubMap())`. Returns both refs so tests
// that also need the map (e.g. for `map.on(...)`) can destructure.
export function newStubStyle(): {map: StubMap; style: Style} {
    const map = new StubMap();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const style = new Style(map as any);
    map.style = style;
    return {map, style};
}
