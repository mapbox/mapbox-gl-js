import drawBuilding from '../3d-style/render/draw_building';
import drawRasterParticle, {prepare as prepareRasterParticle} from '../src/render/draw_raster_particle';
import shaders from '../3d-style/shaders/shaders_hd';
import {Rain} from '../src/precipitation/draw_rain';
import {Snow} from '../src/precipitation/draw_snow';

export const HD = {
    building: {
        draw: drawBuilding,
    },
    particles: {
        draw: drawRasterParticle,
        prepare: prepareRasterParticle,
    },
    precipitation: {
        Rain,
        Snow,
    },
    shaders,
};
