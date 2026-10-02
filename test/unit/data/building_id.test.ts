import {test, expect} from '../../util/vitest';
import {resolveBuildingId} from '../../../src/data/building_id';

test('resolveBuildingId converts numeric building_id values', () => {
    expect(resolveBuildingId({'building_id': 42})).toEqual(42);
    expect(resolveBuildingId({'building_id': '42'})).toEqual(42);
});

test('resolveBuildingId reports values that are not numeric as absent', () => {
    expect(resolveBuildingId({'building_id': '2f6b3ee3-a3e4-4d1a-9e14-8a3f5e2d1c00'})).toEqual(undefined);
    expect(resolveBuildingId({'building_id': ''})).toEqual(undefined);
    expect(resolveBuildingId({'building_id': null})).toEqual(undefined);
    expect(resolveBuildingId({'building_id': true})).toEqual(undefined);
});

test('resolveBuildingId reports a missing building_id as absent', () => {
    expect(resolveBuildingId({})).toEqual(undefined);
    expect(resolveBuildingId(undefined)).toEqual(undefined);
});
