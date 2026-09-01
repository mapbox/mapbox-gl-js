import {describe, test, expect} from '../../util/vitest';
import {createRuntimeLayerUID} from '../../../src/placement/layer_uid';

describe('createRuntimeLayerUID', () => {
    test('returns a different id on each call', () => {
        const a = createRuntimeLayerUID();
        const b = createRuntimeLayerUID();

        expect(a).not.toEqual(b);
    });
});
