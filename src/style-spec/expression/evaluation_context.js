// @flow

const parseColor = require('../util/parse_color');
const {Color} = require('./values');

import type { Feature } from './index';

class EvaluationContext {
    globals: {+zoom?: number};
    feature: ?Feature;

    _parseColorCache: {[string]: ?Color};

    constructor() {
        this._parseColorCache = {};
    }

    parseColor(input: string): ?Color {
        let cached = this._parseColorCache[input];
        if (!cached) {
            const c = parseColor(input);
            cached = this._parseColorCache[input] = c ? new Color(c[0], c[1], c[2], c[3]) : null;
        }
        return cached;
    }
}

module.exports = EvaluationContext;
