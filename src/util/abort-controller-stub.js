// @flow
import window from './window';

export class AbortControllerStub {
    abort() {

    }
}

const _abortControllerCache = window.AbortController;

export function stubAbortController() {
    window.AbortController = AbortControllerStub;
}

export function restoreAbortController() {
    window.AbortController = _abortControllerCache;
}
