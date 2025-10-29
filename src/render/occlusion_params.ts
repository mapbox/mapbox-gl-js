import {DevTools} from '../ui/devtools';

export class OcclusionParams {
    // Occluder size in pixels
    occluderSize: number;
    // Depth offset in NDC units, to prevent coplanar symbol/geometry cases
    depthOffset: number;

    constructor() {
        this.occluderSize = 30;
        this.depthOffset = -0.0001;

        DevTools.addParameter(this, 'occluderSize', 'Occlusion', {min: 1, max: 100, step: 1});
        DevTools.addParameter(this, 'depthOffset', 'Occlusion', {min: -0.05, max: 0, step: 0.00001});
    }
}
