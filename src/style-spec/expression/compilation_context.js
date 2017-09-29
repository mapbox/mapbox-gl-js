// @flow

const assert = require('assert');
const Scope = require('./scope');

import type {Expression} from './expression';

class CompilationContext {
    _id: number;
    _cache: {[string]: string};
    _prelude: string;
    scope: Scope;

    constructor() {
        this._cache = {};
        this._id = 0;
        this._prelude = '';
        this.scope = new Scope();
    }

    compileAndCache(e: Expression): string {
        const id = this.addExpression(e.compile(this));
        return `${id}()`;
    }

    compileToFunction(e: Expression, evaluationContext: Object): Function {
        const finalId = this.addExpression(e.compile(this));
        const src = `
            var $globalProperties;
            var $feature;
            var $props;
            ${this._prelude}
            return function (globalProperties, feature) {
                $globalProperties = globalProperties;
                $feature = feature;
                $props = feature && $feature.properties || {};
                return $this.unwrap(${finalId}())
            };`;
        return (new Function('$this', src): any)(evaluationContext);
    }

    getPrelude() {
        return this._prelude;
    }

    addExpression(body: string): string {
        let id = this._cache[body];
        if (!id) {
            id = `e${this._id++}`;
            this._cache[body] = id;

            assert(!/return/.test(body));
            this._prelude += `\nfunction ${id}() { return ${body} }`;
        }

        return id;
    }

    // Add a variable declaration to the prelude, and return its name.
    addVariable(body: string): string {
        let id = this._cache[body];
        if (!id) {
            id = `v${this._id++}`;
            this._cache[body] = id;
            this._prelude += `\nvar ${id} = ${body};`;
        }

        return id;
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
