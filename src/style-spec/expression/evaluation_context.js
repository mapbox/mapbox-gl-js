// @flow

const assert = require('assert');
const Scope = require('./scope');
const parseColor = require('../util/parse_color');
const {Color} = require('./values');

import type { Feature } from './index';
import type { Expression } from './expression';

class EvaluationContext {
    globals: {+zoom?: number};
    feature: ?Feature;

    scope: Scope;
    _parseColorCache: {[string]: ?Color};

    constructor() {
        this.scope = new Scope();
        this._parseColorCache = {};
    }

    pushScope(bindings: Array<[string, Expression]>) {
        this.scope = this.scope.concat(bindings);
    }

    popScope() {
        assert(this.scope.parent);
        this.scope = (this.scope.parent: any);
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
