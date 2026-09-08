// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect, waitFor} from '../../util/vitest';
import Style from '../../../src/style/style';
import LazySource from '../../../src/source/lazy_source';
import {StubMap} from './utils';

// `raster-array` stands in for any lazy source type: its class lives in a code-split module, so
// `addSource` installs a `LazySource` placeholder. These tests must not call
// `ensureSourceType('raster-array')`, which registers the class process-wide and would make
// `addSource` take the eager path instead.
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

    test('starts once a layer makes the source used', async () => {
        const style = loadStyle('used', [{id: 'ra', type: 'raster', source: 'used'}]);
        await waitFor(style, 'style.load');
        style.update({zoom: 0, fadeDuration: 0});
        await waitFor(style, 'data');

        expect(style.getOwnSource('used')).not.toBeInstanceOf(LazySource);
    });
});
