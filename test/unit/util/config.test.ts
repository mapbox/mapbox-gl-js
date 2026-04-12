import {describe, test, expect, beforeEach} from 'vitest';
import config, {getDracoUrl, getMeshoptUrl, getBuildingGenUrl} from '../../../src/util/config';

describe('WASM URL getters', () => {
    let originalApiUrl: string;

    beforeEach(() => {
        originalApiUrl = config.API_URL;
        return () => { config.API_URL = originalApiUrl; };
    });

    test('getDracoUrl resolves against default API_URL', () => {
        expect(getDracoUrl().startsWith('https://api.mapbox.com/mapbox-gl-js/draco_')).toBe(true);
    });

    test('getMeshoptUrl resolves against default API_URL', () => {
        const url = getMeshoptUrl();
        expect(url.startsWith('https://api.mapbox.com/mapbox-gl-js/meshopt_')).toBe(true);
    });

    test('getBuildingGenUrl resolves against default API_URL', () => {
        expect(getBuildingGenUrl().startsWith('https://api.mapbox.com/mapbox-gl-js/building-gen/')).toBe(true);
    });

    test('URLs resolve against custom API_URL', () => {
        config.API_URL = 'https://api.mapbox.cn';
        expect(getDracoUrl().startsWith('https://api.mapbox.cn/mapbox-gl-js/draco_')).toBe(true);
        expect(getBuildingGenUrl().startsWith('https://api.mapbox.cn/mapbox-gl-js/building-gen/')).toBe(true);
    });

    test('absolute DRACO_URL ignores API_URL base', () => {
        config.DRACO_URL = 'https://cdn.example.com/draco.wasm';
        expect(getDracoUrl()).toBe('https://cdn.example.com/draco.wasm');
    });
});
