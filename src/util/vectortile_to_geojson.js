// @flow
import type {LayerSpecification} from '../style-spec/types.js';
import type {GeoJSONGeometry, GeoJSONFeature} from '@mapbox/geojson-types';

// we augment GeoJSON with custom properties in query*Features results
export type QueryFeature = $ReadOnly<GeoJSONFeature> & {
    layer?: ?LayerSpecification;
    [key: string]: mixed;
};

const customProps = ['tile', 'layer', 'source', 'sourceLayer', 'state'];

class Feature {
    type: 'Feature';
    _geometry: ?GeoJSONGeometry;
    properties: {};
    id: number | string | void;
    _vectorTileFeature: VectorTileFeature;
    _x: number;
    _y: number;
    _z: number;

    tile: ?mixed;
    layer: ?LayerSpecification;
    source: ?mixed;
    sourceLayer: ?mixed;
    state: ?mixed;

    constructor(vectorTileFeature: VectorTileFeature, z: number, x: number, y: number, id: string | number | void) {
        this.type = 'Feature';

        this._vectorTileFeature = vectorTileFeature;
        this._z = z;
        this._x = x;
        this._y = y;

        this.properties = vectorTileFeature.properties;
        this.id = id;
    }

    get geometry(): ?GeoJSONGeometry {
        if (this._geometry === undefined) {
            this._geometry = this._vectorTileFeature.toGeoJSON(this._x, this._y, this._z).geometry;
        }
        return this._geometry;
    }

    set geometry(g: ?GeoJSONGeometry) {
        this._geometry = g;
    }

    toJSON(): QueryFeature {
        const json: QueryFeature = {
            type: 'Feature',
            geometry: this.geometry,
            properties: this.properties
        };
        if (this.id !== undefined) json.id = this.id;
        for (const key of customProps) {
            // Flow doesn't support indexed access for classes https://github.com/facebook/flow/issues/1323
            if ((this: any)[key] !== undefined) json[key] = (this: any)[key];
        }
        return json;
    }
}

export default Feature;
