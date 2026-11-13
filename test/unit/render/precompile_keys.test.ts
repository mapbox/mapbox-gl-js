import {describe, test, expect} from '../../util/vitest';
import {deviceNeutralProgramKey} from '../../../src/render/precompile_keys';

describe('deviceNeutralProgramKey', () => {
    test('drops the uniform-block size and TERRAIN_DEM_FLOAT_FORMAT, keeping the order of the rest', () => {
        expect(deviceNeutralProgramKey('symbol/LIGHTING_3D_MODE/TERRAIN/TERRAIN_DEM_FLOAT_FORMAT/LEGACY_PLACEMENT_FADE/MAX_UBO_SIZE_VEC4 2048u'))
            .toEqual('symbol/LIGHTING_3D_MODE/TERRAIN/LEGACY_PLACEMENT_FADE/MAX_UBO_SIZE_VEC4');
    });

    test('drops CUSTOM_ANTIALIASING from globeRaster only', () => {
        expect(deviceNeutralProgramKey('globeRaster/LIGHTING_3D_MODE/PROJECTION_GLOBE_VIEW/CUSTOM_ANTIALIASING')).toEqual('globeRaster/LIGHTING_3D_MODE/PROJECTION_GLOBE_VIEW');
        expect(deviceNeutralProgramKey('raster/CUSTOM_ANTIALIASING')).toEqual('raster/CUSTOM_ANTIALIASING');
    });

    test('keeps the empty part of a paint configuration', () => {
        expect(deviceNeutralProgramKey('fill//u_fill-color/u_fill-opacity/USE_MRT1')).toEqual('fill//u_fill-color/u_fill-opacity/USE_MRT1');
    });
});
