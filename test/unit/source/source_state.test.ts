// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect, afterEach} from '../../util/vitest';
import SourceFeatureState from '../../../src/source/source_state';

// A hostile feature id such as "__proto__" can flow into setFeatureState()
// through GeoJSON/vector sources that use `promoteId`. The lookup pattern
//
//   this.stateChanges[sourceLayer][feature] = this.stateChanges[sourceLayer][feature] || {};
//   Object.assign(this.stateChanges[sourceLayer][feature], newState);
//
// resolves `this.stateChanges[sourceLayer]["__proto__"]` to `Object.prototype`
// via the normal prototype chain, and then writes newState onto it. The result
// is global prototype pollution observable from every plain object on the page.
//
// These tests guard the `Object.create(null)` hardening against regression.
describe('SourceFeatureState prototype-pollution hardening', () => {
    // Object.prototype is process-global. If a regression slips a property
    // through, scrub it after each test so other suites aren't poisoned.
    const sentinels = ['pollutionCanaryHover', 'pollutionCanaryValue', 'pollutionCanaryX', 'feature-1'];
    afterEach(() => {
        for (const sentinel of sentinels) {
            delete Object.prototype[sentinel];
        }
    });

    test('updateState with id "__proto__" does not pollute Object.prototype', () => {
        const state = new SourceFeatureState();
        state.updateState('default', '__proto__', {pollutionCanaryHover: true});

        expect({}.pollutionCanaryHover).toBeUndefined();
        expect(Object.hasOwn(Object.prototype, 'pollutionCanaryHover')).toBe(false);
    });

    test('updateState with sourceLayer "__proto__" does not pollute Object.prototype', () => {
        const state = new SourceFeatureState();
        // When the source layer name is "__proto__", a `{}` registry resolves
        // `stateChanges["__proto__"]` to Object.prototype and the next-level
        // write — `stateChanges["__proto__"]["feature-1"] = {}` — adds
        // "feature-1" as an own property of Object.prototype.
        state.updateState('__proto__', 'feature-1', {pollutionCanaryValue: 42});

        expect(Object.hasOwn(Object.prototype, 'feature-1')).toBe(false);
    });

    test('newState payload with a "__proto__" key does not pollute the target prototype chain', () => {
        const state = new SourceFeatureState();
        // Use JSON.parse so the "__proto__" key is an own property, mirroring
        // the realistic over-the-wire payload — an object literal `{__proto__: ...}`
        // would be treated as a prototype setter and skipped by Object.assign.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const hostilePayload = JSON.parse('{"__proto__":{"pollutionCanaryX":1}}');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        state.updateState('default', 'feature-1', hostilePayload);

        // Object.assign with an own "__proto__" key on the source rewrites the
        // target's [[Prototype]] via the inherited setter. The resulting
        // feature-state record looks legitimate but inherits attacker
        // properties, which then leak through `getState()`.
        const result = state.getState('default', 'feature-1');
        expect(result.pollutionCanaryX).toBeUndefined();
    });

    test('removeFeatureState with id "__proto__" does not pollute Object.prototype', () => {
        const state = new SourceFeatureState();
        // First populate so the remove path has something to mark as deleted.
        state.updateState('default', '__proto__', {pollutionCanaryHover: true});
        state.removeFeatureState('default', '__proto__');

        expect({}.pollutionCanaryHover).toBeUndefined();
    });

    test('coalesceChanges does not pollute Object.prototype when id is "__proto__"', () => {
        const state = new SourceFeatureState();
        state.updateState('default', '__proto__', {pollutionCanaryHover: true});
        // coalesceChanges runs `Object.assign(this.state[sourceLayer][feature], …)`
        // which is the second-stage pollution sink if the first stage missed.
        state.coalesceChanges({}, undefined);

        expect({}.pollutionCanaryHover).toBeUndefined();
    });

    test('getState returns the hostile feature state without leaking onto Object.prototype', () => {
        const state = new SourceFeatureState();
        state.updateState('default', '__proto__', {pollutionCanaryHover: true});
        const result = state.getState('default', '__proto__');

        expect(result.pollutionCanaryHover).toBe(true);
        expect({}.pollutionCanaryHover).toBeUndefined();
    });
});
