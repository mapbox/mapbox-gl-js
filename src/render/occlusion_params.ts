import type {ITrackedParameters} from '../tracked-parameters/tracked_parameters_base';

export class OcclusionParams {
    // Occluder size in pixels
    occluderSize: number;
    // Depth offset in NDC units, to prevent coplanar symbol/geometry cases
    depthOffset: number;

    constructor(tp: ITrackedParameters) {
        this.occluderSize = 30;
        this.depthOffset = -0.0001;

        tp.registerParameter(this, ["Occlusion"], "occluderSize", {min: 1, max: 100, step: 1});
        tp.registerParameter(this, ["Occlusion"], "depthOffset", {min: -0.05, max: 0, step: 0.00001});
    }
}
