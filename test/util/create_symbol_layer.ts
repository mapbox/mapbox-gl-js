// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import SymbolBucket from '../../src/data/bucket/symbol_bucket';
import SymbolStyleLayer from '../../src/style/style_layer/symbol_style_layer';
import featureFilter from '../../src/style-spec/feature_filter/index';

export function createSymbolBucket(layerId, font, text, collisionBoxArray) {
    const layer = new SymbolStyleLayer({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        id: layerId,
        type: 'symbol',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        layout: {'text-font': [font], 'text-field': text},
        filter: featureFilter()
    }, '');
    layer.recalculate({zoom: 0});

    return new SymbolBucket({
        overscaling: 1,
        zoom: 0,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        collisionBoxArray,
        layers: [layer],
        projection: {name: 'mercator'}
    });
}
