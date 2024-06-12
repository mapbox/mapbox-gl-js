import type {ITrackedParameters} from '../tracked-parameters/tracked_parameters_base';

// none  - no debug visualization
// zPass - always render occluders
// zTest - render occluders with depth test highlighting passed fragments
type VisualizeOcclusionMode = 'none' | 'zPass' | 'zTest';

export class SymbolParams {
    useOcclusionQueries: boolean;
    visualizeOcclusions: VisualizeOcclusionMode;
    // Number of frames to issue all occlusion queries of a single bucket
    occlusionQueryFrameWindow: number;
    // Occluder size in pixels
    occluderSize: number;
    // Hidden<->Revealed transition speed, fade units per second
    fadeSpeed: number;
    // Depth offset in NDC units, to prevent coplanar symbol/geometry cases
    depthOffset: number;

    constructor(tp: ITrackedParameters) {
        this.useOcclusionQueries = true;
        this.visualizeOcclusions = 'none';
        this.occlusionQueryFrameWindow = 5;
        this.occluderSize = 32;
        this.fadeSpeed = 7; // 7 fade units per second, i.e. transition from 0 to 1 happens in approx 1/7 = 142ms
        this.depthOffset = -0.0001;

        tp.registerParameter(this, ["Symbols"], "useOcclusionQueries");
        tp.registerParameter(this, ["Symbols"], "visualizeOcclusions", {
            options: {
                none: 'none',
                zPass: 'zPass',
                zTest: 'zTest',
            }
        });
        tp.registerParameter(this, ["Symbols"], "occlusionQueryFrameWindow", {min:1, max: 30, step: 1});
        tp.registerParameter(this, ["Symbols"], "occluderSize", {min:1, max: 100, step: 1});
        tp.registerParameter(this, ["Symbols"], "fadeSpeed", {min:0.1, max: 50, step: 0.1});
        tp.registerParameter(this, ["Symbols"], "depthOffset", {min:-0.001, max: 0, step: 0.0001});
    }
}
