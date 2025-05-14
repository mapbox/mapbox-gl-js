// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect} from '../../util/vitest';
import Anchor from '../../../src/symbol/anchor';

describe('Anchor', () => {
    test('#constructor', () => {
        expect(new Anchor(0, 0, 0, []) instanceof Anchor).toBeTruthy();
        expect(new Anchor(0, 0, 0, [], []) instanceof Anchor).toBeTruthy();
    });
    test('#clone', () => {
        const a = new Anchor(1, 2, 3, []);
        const b = new Anchor(1, 2, 3, []);
        expect(a.clone()).toEqual(b);
        expect(a.clone()).toEqual(a);
    });
});
