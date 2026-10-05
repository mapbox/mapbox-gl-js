import {createRTL} from '@mapbox/mapbox-gl-rtl-text/rtl.js';
import config from '../util/config';

import type {RTL} from '@mapbox/mapbox-gl-rtl-text/rtl.js';

// Set on the worker once the wasm loads
export let rtl: RTL | null = null;
let rtlLoading: Promise<void> | null = null;

export function waitForRTL(): Promise<void> | void {
    if (rtl) return;
    rtlLoading ??= createRTL(fetch(new URL(config.RTL_TEXT_URL, config.API_URL))).then((module) => { rtl = module; });
    return rtlLoading;
}
