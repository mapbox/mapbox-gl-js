// @flow

import CircleBucket from './circle_bucket.js';

import {register} from '../../util/web_worker_transfer.js';

import type ParticleStyleLayer from '../../style/style_layer/particle_style_layer.js';

class ParticleBucket extends CircleBucket<ParticleStyleLayer> {
    // Needed for flow to accept omit: ['layers'] below, due to
    // https://github.com/facebook/flow/issues/4262
    layers: Array<ParticleStyleLayer>;
}

register('ParticleBucket', ParticleBucket, {omit: ['layers']});

export default ParticleBucket;
