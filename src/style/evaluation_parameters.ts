import {isStringInSupportedScript} from '../util/script_detection';
import {plugin as rtlTextPlugin} from '../source/rtl_text_plugin';

import type {TransitionSpecification} from '../style-spec/types';

type EvaluationParametersOptions = {
    pitch?: number;
    now?: number;
    fadeDuration?: number;
    transition?: TransitionSpecification;
    brightness?: number;
    worldview?: string;
}

class EvaluationParameters {
    zoom: number;
    pitch: number | undefined;
    now: number;
    fadeDuration: number;
    transition: TransitionSpecification;
    brightness: number | undefined;
    worldview: string | undefined;

    constructor(zoom: number, options?: EvaluationParametersOptions) {
        this.zoom = zoom;

        if (options) {
            this.now = options.now;
            this.fadeDuration = options.fadeDuration;
            this.transition = options.transition;
            this.pitch = options.pitch;
            this.brightness = options.brightness;
            this.worldview = options.worldview;
        } else {
            this.now = 0;
            this.fadeDuration = 0;
            this.transition = {};
            this.pitch = 0;
            this.brightness = 0;
        }
    }

    isSupportedScript(str: string): boolean {
        return isStringInSupportedScript(str, rtlTextPlugin.isLoaded());
    }
}

export default EvaluationParameters;
