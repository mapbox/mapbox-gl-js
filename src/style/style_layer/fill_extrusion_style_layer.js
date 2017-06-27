// @flow

const StyleLayer = require('../style_layer');
const FillExtrusionBucket = require('../../data/bucket/fill_extrusion_bucket');

import type {GlobalProperties, FeatureProperties} from '../style_layer';
import type {BucketParameters} from '../../data/bucket';

class FillExtrusionStyleLayer extends StyleLayer {

    getPaintValue(name: string, globalProperties?: GlobalProperties, featureProperties?: FeatureProperties) {
        const value = super.getPaintValue(name, globalProperties, featureProperties);
        if (name === 'fill-extrusion-color' && value) {
            value[3] = 1;
        }
        return value;
    }

    createBucket(parameters: BucketParameters) {
        return new FillExtrusionBucket(parameters);
    }
}

module.exports = FillExtrusionStyleLayer;
