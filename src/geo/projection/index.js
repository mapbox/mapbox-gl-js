// @flow
import Albers from './albers.js';
import EqualEarth from './equal_earth.js';
import Equirectangular from './equirectangular.js';
import LambertConformalConic from './lambert.js';
import Mercator from './mercator.js';
import NaturalEarth from './natural_earth.js';
import WinkelTripel from './winkel_tripel.js';
import CylindricalEqualArea from './cylindrical_equal_area.js';
import Globe from './globe.js';

import type {ProjectionSpecification} from '../../style-spec/types.js';
import type Projection from './projection.js';

export function getProjection(config: ProjectionSpecification): Projection {

    const parallels = config.parallels;
    const isDegenerateConic = parallels ? Math.abs(parallels[0] + parallels[1]) < 0.01 : false;

    switch (config.name) {
    case 'mercator':
        return new Mercator(config);
    case 'equirectangular':
        return new Equirectangular(config);
    case 'naturalEarth':
        return new NaturalEarth(config);
    case 'equalEarth':
        return new EqualEarth(config);
    case 'winkelTripel':
        return new WinkelTripel(config);
    case 'albers':
        return isDegenerateConic ? new CylindricalEqualArea(config) : new Albers(config);
    case 'lambertConformalConic':
        return isDegenerateConic ? new CylindricalEqualArea(config) : new LambertConformalConic(config);
    case 'globe':
        return new Globe(config);
    }

    throw new Error(`Invalid projection name: ${config.name}`);
}

export function selectProjectionByPriority(projection: ?ProjectionSpecification, styleProjection: ?ProjectionSpecification) {
    // Given a stylesheet and eventual runtime projection, in order of priority, we select:
    //  1. the explicit projection
    //  2. the stylesheet projection
    //  3. mercator (fallback)
    return projection || styleProjection || {name: "mercator"};
}
