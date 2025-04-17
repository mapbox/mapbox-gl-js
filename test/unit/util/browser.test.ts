// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect} from '../../util/vitest';
import browser from '../../../src/util/browser';

describe('browser', () => {
    test('frame', () => {
        const id = browser.frame(() => {
            expect(id).toBeTruthy();
        });
    });

    test('now', () => {
        expect(typeof browser.now()).toEqual('number');
    });

    test('frame', () => {
        const frame = browser.frame(() => {
            expect.unreachable();
        });
        frame.cancel();
    });

    test('devicePixelRatio', () => {
        expect(typeof browser.devicePixelRatio).toEqual('number');
    });
});
