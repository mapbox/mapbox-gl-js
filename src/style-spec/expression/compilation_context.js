// @flow

const assert = require('assert');
const Scope = require('./scope');

import type EvaluationContext from './evaluation_context';
import type {Expression} from './expression';
import type {Value} from './values';

class CompilationContext {
    scope: Scope;

    constructor() {
        this.scope = new Scope();
    }

    compileAndCache(e: Expression): (EvaluationContext) => Value {
        return e.compile(this);
    }

    pushScope(bindings: Array<[string, Expression]>) {
        this.scope = this.scope.concat(bindings);
    }

    popScope() {
        assert(this.scope.parent);
        this.scope = (this.scope.parent: any);
    }
}

module.exports = CompilationContext;
