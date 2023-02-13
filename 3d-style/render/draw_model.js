// @flow

import type Painter from '../../src/render/painter.js';
import type SourceCache from '../../src/source/source_cache.js';
import type ModelStyleLayer from '../style/style_layer/model_style_layer.js';

export default drawModels;

function drawModels(painter: Painter, sourceCache: SourceCache, layer: ModelStyleLayer) {
    console.log('drawModels');
}
