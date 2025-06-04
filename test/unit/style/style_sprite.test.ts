// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {vi, describe, test, expect, createStyleJSON, waitFor, doneAsync} from '../../../test/util/vitest';
import Style from '../../../src/style/style';
import {getPNGResponse, mockFetch} from '../../util/network';
import {StubMap} from './utils';

import type MapboxMap from '../../../src/ui/map';

describe('Style', () => {
    describe('Sprite', () => {
        describe('loadJSON', () => {
            test('transforms sprite json and image URLs before request', async () => {
                mockFetch({
                    'http://example.com/sprites/bright-v8.json': () => new Response(JSON.stringify({})),
                    'http://example.com/sprites/bright-v8.png': async () => new Response(await getPNGResponse())
                });

                const map = new StubMap();
                const transformSpy = vi.spyOn(map._requestManager, 'transformRequest');
                const style = new Style(map as MapboxMap);

                style.loadJSON(Object.assign(createStyleJSON(), {
                    "sprite": "http://example.com/sprites/bright-v8"
                }));

                await waitFor(style, 'style.load');

                expect(transformSpy).toHaveBeenCalledTimes(2);
                expect(transformSpy.mock.calls[0][0]).toEqual('http://example.com/sprites/bright-v8.json');
                expect(transformSpy.mock.calls[0][1]).toEqual('SpriteJSON');
                expect(transformSpy.mock.calls[1][0]).toEqual('http://example.com/sprites/bright-v8.png');
                expect(transformSpy.mock.calls[1][1]).toEqual('SpriteImage');

                await waitFor(style, "data");
            });

            test('fires "data" when the sprite finishes loading', async () => {
                const {wait, withAsync} = doneAsync();
                mockFetch({
                    'http://example.com/sprite.json': () => new Response(JSON.stringify({})),
                    'http://example.com/sprite.png': async () => new Response(await getPNGResponse())
                });

                const style = new Style(new StubMap() as MapboxMap);

                style.loadJSON({
                    "version": 8,
                    "sources": {},
                    "layers": [],
                    "sprite": "http://example.com/sprite"
                });

                style.once('error', () => expect.unreachable());
                style.once('data', withAsync((e, doneRef) => {
                    expect(e.target).toBe(style);
                    expect(e.dataType).toEqual('style');

                    style.once('data', (e) => {
                        expect(e.target).toBe(style);
                        expect(e.dataType).toEqual('style');
                        doneRef.resolve();
                    });
                }));

                await wait;
            });
        });
    });
});
