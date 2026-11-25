import {describe, test, expect} from '../../util/vitest';
import {styleUrl, zoomGroup} from '../../../src/render/precompile_list_lookup';

describe('styleUrl', () => {
    test('drops the query', () => {
        expect(styleUrl('mapbox://styles/test/style?optimize=true&fresh=true')).toBe('mapbox://styles/test/style');
    });
});

describe('zoomGroup', () => {
    test('takes a range from min up to max, without max', () => {
        const groups = [{name: 'low', min: 0, max: 6}, {name: 'high', min: 6, max: 100}];
        expect([zoomGroup(groups, 5.9), zoomGroup(groups, 6)]).toEqual(['low', 'high']);
    });

    test('takes min === max as exactly that zoom, ahead of later groups', () => {
        const groups = [{name: 'exact', min: 6, max: 6}, {name: 'range', min: 0, max: 100}];
        expect([zoomGroup(groups, 6), zoomGroup(groups, 6.5)]).toEqual(['exact', 'range']);
    });

    test('gives nothing outside every group', () => {
        expect(zoomGroup([{name: 'low', min: 0, max: 6}], 6)).toBeUndefined();
    });
});
