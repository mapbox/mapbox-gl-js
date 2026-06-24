import {vi} from '../../util/vitest';
import {Map} from '../../../src/index.esm';

import type {LayerSpecification} from '../../../src/style-spec/types';

export function makeContainer() {
    const container = document.createElement('div');
    Object.defineProperty(container, 'getBoundingClientRect',
        {value: () => ({height: 200, width: 200}), configurable: true});
    return container;
}

export function makeMap(layers: LayerSpecification[] = [], sources = {}) {
    vi.spyOn(Map.prototype, '_detectMissingCSS').mockImplementation(() => {});
    const map = new Map({
        testMode: true,
        container: makeContainer(),
        zoom: 1,
        center: [0, 0],
        interactive: false,
        attributionControl: false,
        performanceMetricsCollection: false,
        precompilePrograms: false,
        style: {version: 8, sources, layers},
    });
    map._authenticate = () => {};
    return map;
}

export async function waitForLoaded(mod: {loaded?: boolean}) {
    await vi.waitUntil(() => mod.loaded === true, {timeout: 3000, interval: 20});
}

export async function settle() {
    await new Promise<void>(resolve => { setTimeout(resolve, 150); });
}
