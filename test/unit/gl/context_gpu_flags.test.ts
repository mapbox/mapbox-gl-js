import {test, expect, describe} from '../../util/vitest';
import Context from '../../../src/gl/context';

describe('Context GPU flags', () => {
    function createContext(options?: ConstructorParameters<typeof Context>[1]) {
        const el = window.document.createElement('canvas');
        const gl = el.getContext('webgl2');
        return new Context(gl, options);
    }

    describe('disableSymbolUBO', () => {
        test('disabled by default on standard GPUs', () => {
            const context = createContext();
            expect(context.disableSymbolUBO).toBe(false);
        });

        test('enabled when forceDisableSymbolUBO option is set', () => {
            const context = createContext({forceDisableSymbolUBO: true});
            expect(context.disableSymbolUBO).toBe(true);
        });
    });
});
