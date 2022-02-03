// @flow

import ZoomHistory from './zoom_history.js';
import {isStringInSupportedScript} from '../util/script_detection.js';
import {plugin as rtlTextPlugin} from '../source/rtl_text_plugin.js';

import type {TransitionSpecification} from '../style-spec/types.js';

export type CrossfadeParameters = {
    fromScale: number,
    toScale: number,
    t: number
};

class EvaluationParameters {
    zoom: number;
    pitch: number;
    now: number;
    fadeDuration: number;
    zoomHistory: ZoomHistory;
    transition: TransitionSpecification;

    // "options" may also be another EvaluationParameters to copy, see CrossFadedProperty.possiblyEvaluate
    constructor(zoom: number, options?: *) {
        this.zoom = zoom;

        if (options) {
            this.now = options.now;
            this.fadeDuration = options.fadeDuration;
            this.zoomHistory = options.zoomHistory;
            this.transition = options.transition;
            this.pitch = options.pitch;
        } else {
            this.now = 0;
            this.fadeDuration = 0;
            this.zoomHistory = new ZoomHistory();
            this.transition = {};
            this.pitch = 0;
        }
    }

    isSupportedScript(str: string): boolean {
        return isStringInSupportedScript(str, rtlTextPlugin.isLoaded());
    }

    crossFadingFactor() {
        if (this.fadeDuration === 0) {
            return 1;
        } else {
            return Math.min((this.now - this.zoomHistory.lastIntegerZoomTime) / this.fadeDuration, 1);
        }
    }

    getCrossfadeParameters(): CrossfadeParameters {
        const z = this.zoom;
        const fraction = z - Math.floor(z);
        const t = this.crossFadingFactor();

        return z > this.zoomHistory.lastIntegerZoom ?
            {fromScale: 2, toScale: 1, t: fraction + (1 - fraction) * t} :
            {fromScale: 0.5, toScale: 1, t: 1 - (1 - t) * fraction};
    }
}

export default EvaluationParameters;
