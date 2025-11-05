// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect, vi} from '../../../util/vitest';
import createStyleLayer from '../../../../src/style/create_style_layer';
import RasterStyleLayer from '../../../../src/style/style_layer/raster_style_layer';

describe('RasterStyleLayer#raster-blend-mode', () => {
    function createRasterLayer(blendMode?: string, opacity?: number) {
        const config: any = {
            "id": "test-raster",
            "type": "raster",
            "source": "test-source",
            "paint": {}
        };

        if (blendMode !== undefined) {
            config.paint['raster-blend-mode'] = blendMode;
        }
        if (opacity !== undefined) {
            config.paint['raster-opacity'] = opacity;
        }

        const layer = createStyleLayer(config);
        layer.updateTransitions({});
        layer.recalculate({zoom: 0});
        return layer;
    }

    test('instantiates as RasterStyleLayer', () => {
        const layer = createRasterLayer();
        expect(layer instanceof RasterStyleLayer).toBeTruthy();
    });

    test('defaults to undefined when not specified', () => {
        const layer = createRasterLayer();
        expect(layer.getPaintProperty('raster-blend-mode')).toEqual(undefined);
    });

    test('sets multiply blend mode', () => {
        const layer = createRasterLayer('multiply');
        expect(layer.getPaintProperty('raster-blend-mode')).toEqual('multiply');
        expect(layer.paint.get('raster-blend-mode')).toEqual('multiply');
    });

    test('sets screen blend mode', () => {
        const layer = createRasterLayer('screen');
        expect(layer.getPaintProperty('raster-blend-mode')).toEqual('screen');
        expect(layer.paint.get('raster-blend-mode')).toEqual('screen');
    });

    test('sets darken blend mode', () => {
        const layer = createRasterLayer('darken');
        expect(layer.getPaintProperty('raster-blend-mode')).toEqual('darken');
        expect(layer.paint.get('raster-blend-mode')).toEqual('darken');
    });

    test('sets lighten blend mode', () => {
        const layer = createRasterLayer('lighten');
        expect(layer.getPaintProperty('raster-blend-mode')).toEqual('lighten');
        expect(layer.paint.get('raster-blend-mode')).toEqual('lighten');
    });

    test('updates blend mode value', () => {
        const layer = createRasterLayer('multiply');
        layer.setPaintProperty('raster-blend-mode', 'screen');
        expect(layer.getPaintProperty('raster-blend-mode')).toEqual('screen');
    });

    test('unsets blend mode value', () => {
        const layer = createRasterLayer('multiply');
        layer.setPaintProperty('raster-blend-mode', null);
        expect(layer.getPaintProperty('raster-blend-mode')).toEqual(undefined);
    });
});

describe('RasterStyleLayer#_validateBlendModeOpacity', () => {
    function createRasterLayer(blendMode?: string, opacity?: number) {
        const config: any = {
            "id": "test-raster",
            "type": "raster",
            "source": "test-source",
            "paint": {}
        };

        if (blendMode !== undefined) {
            config.paint['raster-blend-mode'] = blendMode;
        }
        if (opacity !== undefined) {
            config.paint['raster-opacity'] = opacity;
        }

        const layer = createStyleLayer(config);
        layer.updateTransitions({});
        layer.recalculate({zoom: 0});
        return layer;
    }

    test('does not warn for darken with opacity 0', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const layer = createRasterLayer('darken', 0);
        layer.setPaintProperty('raster-blend-mode', 'darken');
        expect(console.warn).not.toHaveBeenCalled();
    });

    test('does not warn for darken with opacity 1', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const layer = createRasterLayer('darken', 1);
        layer.setPaintProperty('raster-blend-mode', 'darken');
        expect(console.warn).not.toHaveBeenCalled();
    });

    test('warns for darken with partial opacity', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const layer = createRasterLayer('darken', 0.5);
        layer.setPaintProperty('raster-blend-mode', 'darken');
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            console.warn.mock.calls[0][0]
        ).toMatch(/raster-blend-mode "darken" has limited opacity support/);
    });

    test('does not warn for multiply with partial opacity', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const layer = createRasterLayer('multiply', 0.5);
        layer.setPaintProperty('raster-blend-mode', 'multiply');
        expect(console.warn).not.toHaveBeenCalled();
    });

    test('does not warn for screen with partial opacity', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const layer = createRasterLayer('screen', 0.5);
        layer.setPaintProperty('raster-blend-mode', 'screen');
        expect(console.warn).not.toHaveBeenCalled();
    });

    test('does not warn for lighten with partial opacity', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const layer = createRasterLayer('lighten', 0.5);
        layer.setPaintProperty('raster-blend-mode', 'lighten');
        expect(console.warn).not.toHaveBeenCalled();
    });

    test('does not warn when no blend mode is set', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const layer = createRasterLayer(undefined, 0.5);
        layer.setPaintProperty('raster-opacity', 0.7);
        expect(console.warn).not.toHaveBeenCalled();
    });
});
