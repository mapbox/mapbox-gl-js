import {describe, test, expect, createMap} from '../../util/vitest';
import Texture from '../../../src/render/texture';
import {RGBAImage, Float32Image} from '../../../src/util/image';

import type {Map} from '../../../src/ui/map';

function createRGBATexture(map: Map, size: number): Texture {
    const gl = map.painter.context.gl;
    return new Texture(map.painter.context, new RGBAImage({width: size, height: size}), gl.RGBA8);
}

function createR32FTexture(map: Map, size: number): Texture {
    const gl = map.painter.context.gl;
    return new Texture(map.painter.context, new Float32Image({width: size, height: size}, new Float32Array(size * size)), gl.R32F, {premultiply: false});
}

describe('Painter tile texture pool', () => {
    test('reuses a saved texture with the same size and format', () => {
        const map = createMap();
        const texture = createRGBATexture(map, 512);
        map.painter.saveTileTexture(texture);

        expect(map.painter.getTileTexture(512)).toBe(texture);
        map.remove();
    });

    test('does not reuse an R32F texture for an RGBA8 request of the same size', () => {
        const map = createMap();
        map.painter.saveTileTexture(createR32FTexture(map, 512));

        expect(map.painter.getTileTexture(512, map.painter.context.gl.RGBA8)).toBeNull();
        map.remove();
    });

    test('does not reuse an RGBA8 texture for an R32F request of the same size', () => {
        const map = createMap();
        map.painter.saveTileTexture(createRGBATexture(map, 512));

        expect(map.painter.getTileTexture(512, map.painter.context.gl.R32F)).toBeNull();
        map.remove();
    });

    test('reuses a saved R32F texture for an R32F request of the same size', () => {
        const map = createMap();
        const texture = createR32FTexture(map, 512);
        map.painter.saveTileTexture(texture);

        expect(map.painter.getTileTexture(512, map.painter.context.gl.R32F)).toBe(texture);
        map.remove();
    });

    test('does not reuse a texture of a different size', () => {
        const map = createMap();
        map.painter.saveTileTexture(createRGBATexture(map, 256));

        expect(map.painter.getTileTexture(512)).toBeNull();
        map.remove();
    });
});
