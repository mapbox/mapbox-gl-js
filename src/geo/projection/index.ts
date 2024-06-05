import Albers from './albers';
import EqualEarth from './equal_earth';
import Equirectangular from './equirectangular';
import LambertConformalConic from './lambert';
import Mercator from './mercator';
import NaturalEarth from './natural_earth';
import WinkelTripel from './winkel_tripel';
import CylindricalEqualArea from './cylindrical_equal_area';
import Globe from './globe';

import type {ProjectionSpecification} from '../../style-spec/types';
import type Projection from './projection';

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
