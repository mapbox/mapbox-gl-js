import {drawBuilding, drawRasterParticle, prepareRasterParticle, shaders, Rain, Snow} from './hd_main_imports';

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

export async function prepareHD() { return Promise.resolve(); }
