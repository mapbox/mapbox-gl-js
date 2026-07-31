import {describe, test, expect} from '../../../util/vitest';
import RasterStyleLayer, {COLOR_RAMP_RES} from '../../../../src/style/style_layer/raster_style_layer';

import type {RGBAImage} from '../../../../src/util/image';
import type {RasterLayerSpecification} from '../../../../src/style-spec/types';

const createRasterLayer = (paint: RasterLayerSpecification['paint'] = {}): RasterStyleLayer => {
    const layer: RasterLayerSpecification = {
        id: 'raster',
        type: 'raster',
        source: 'source',
        paint: {
            'raster-color': ['step', ['raster-value'], 'rgba(0, 0, 0, 0)', 0.35, 'white'],
            'raster-color-range': [0, 350],
            ...paint
        }
    };

    return new RasterStyleLayer(layer, '', null);
};

// The number of transparent texels is the most distinguishable when it comes to different scales,
// because it represents data on the low end of the range.
const transparentTexels = (colorRamp: RGBAImage): number => {
    let i = 0;
    while (colorRamp.data[i * 4 + 3] === 0) i++;
    return i;
};

describe('RasterStyleLayer#updateColorRamp', () => {
    test('spaces raster values evenly by default', () => {
        const layer = createRasterLayer();
        layer.updateColorRamp();
        expect(layer.colorRamp.width).toEqual(COLOR_RAMP_RES);
        expect(transparentTexels(layer.colorRamp)).toEqual(2);
    });

    test('gives low-end values more of the ramp with `raster-color-scale: log`', () => {
        const layer = createRasterLayer({'raster-color-scale': 'log'});
        layer.updateColorRamp();
        expect(layer.colorRamp.width).toEqual(COLOR_RAMP_RES);
        expect(transparentTexels(layer.colorRamp)).toEqual(4);
    });

    test('rebakes the ramp when `raster-color-scale` changes', () => {
        const layer = createRasterLayer();
        layer.updateColorRamp();
        layer.setPaintProperty('raster-color-scale', 'log');
        expect(transparentTexels(layer.colorRamp)).toEqual(4);
    });
});
