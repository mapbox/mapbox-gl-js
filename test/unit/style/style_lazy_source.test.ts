// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect, waitFor} from '../../util/vitest';
import Style from '../../../src/style/style';
import LazySource from '../../../src/source/lazy_source';
import {StubMap} from './utils';

import type {LazyModelSource, LazyRasterArraySource} from '../../../src/source/lazy_source';
import type {RasterArraySourceSpecification} from '../../../src/style-spec/types';

// `raster-array` stands in for any lazy source type: its class lives in a code-split module, so
// `addSource` installs a `LazySource` placeholder. These tests must not call
// `ensureSourceType('raster-array')`, which registers the class process-wide and would make
// `addSource` take the eager path instead. A test that makes a source used loads the module too,
// so the tests that need the placeholder run first.
function loadStyle(sourceId: string, layers: unknown[]) {
    const style = new Style(new StubMap());
    style.loadJSON({
        version: 8,
        sources: {[sourceId]: {type: 'raster-array', tiles: ['http://example.com/{z}/{x}/{y}.mrt']}},
        layers
    });
    return style;
}

describe('lazy source module loading', () => {
    test('stays deferred for a source no layer references', async () => {
        const style = loadStyle('unused', []);
        await waitFor(style, 'style.load');
        style.update({zoom: 0, fadeDuration: 0});

        const source = style.getOwnSource('unused');
        expect(source).toBeInstanceOf(LazySource);
        expect(source._loader).toBeTruthy();
    });

    test('keeps a property set on the placeholder', async () => {
        const style = loadStyle('unused', []);
        await waitFor(style, 'style.load');

        const source = style.getOwnSource('unused') as LazyRasterArraySource;
        source.setMaxzoom(6);

        expect(source).toBeInstanceOf(LazySource);
        expect((source.serialize() as RasterArraySourceSpecification).maxzoom).toEqual(6);
    });

    test('has only the setters of the real source class', async () => {
        const style = loadStyle('unused', []);
        await waitFor(style, 'style.load');

        const source = style.getOwnSource('unused');

        expect(source).toBeInstanceOf(LazySource);
        expect('setModels' in source).toBe(false);
    });

    test('has no models on a model source placeholder', async () => {
        const style = loadStyle('unused', []);
        await waitFor(style, 'style.load');
        style.addSource('models', {type: 'model', models: {}});

        const source = style.getOwnSource('models') as LazyModelSource;

        expect(source).toBeInstanceOf(LazySource);
        expect(source.getModels()).toEqual([]);
    });

    test('does not change the options object passed to addSource', async () => {
        const style = loadStyle('unused', []);
        await waitFor(style, 'style.load');
        const options: RasterArraySourceSpecification = {type: 'raster-array', tiles: ['http://example.com/{z}/{x}/{y}.mrt']};
        style.addSource('added', options);

        const source = style.getOwnSource('added') as LazyRasterArraySource;
        source.setMaxzoom(6);

        expect(source).toBeInstanceOf(LazySource);
        expect(options.maxzoom).toBeUndefined();
        expect((source.serialize() as RasterArraySourceSpecification).maxzoom).toEqual(6);
    });

    test('creates the real source with a property set on the placeholder', async () => {
        const style = loadStyle('used', [{id: 'ra', type: 'raster', source: 'used'}]);
        await waitFor(style, 'style.load');

        expect(style.getOwnSource('used')).toBeInstanceOf(LazySource);
        (style.getOwnSource('used') as LazyRasterArraySource).setTiles(['http://example.com/v2/{z}/{x}/{y}.mrt']);
        style.update({zoom: 0, fadeDuration: 0});
        await waitFor(style, 'data');

        const source = style.getOwnSource('used');
        expect(source).not.toBeInstanceOf(LazySource);
        expect((source.serialize() as RasterArraySourceSpecification).tiles).toEqual(['http://example.com/v2/{z}/{x}/{y}.mrt']);
    });

    test('starts once a layer makes the source used', async () => {
        const style = loadStyle('used', [{id: 'ra', type: 'raster', source: 'used'}]);
        await waitFor(style, 'style.load');
        style.update({zoom: 0, fadeDuration: 0});
        await waitFor(style, 'data');

        expect(style.getOwnSource('used')).not.toBeInstanceOf(LazySource);
    });
});
