export class OcclusionParams {
    // Occluder size in pixels
    occluderSize: number;
    // Depth offset in NDC units, to prevent coplanar symbol/geometry cases
    depthOffset: number;

    constructor() {
        this.occluderSize = 30;
        this.depthOffset = -0.0001;
    }
}
