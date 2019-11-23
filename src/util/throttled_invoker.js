// @flow
import window from './window';

const raf = window.requestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.msRequestAnimationFrame;
/**
 * Invokes the wrapped function in a non-blocking way when trigger() is called. Invocation requests
 * are ignored until the function was actually invoked.
 *
 * @private
 */
class ThrottledInvoker {
    _triggered: boolean;
    _callback: Function

    constructor(callback: Function) {
        this._callback = callback;
        this._triggered = false;
    }

    trigger() {
        if (!this._triggered) {
            raf(() => {
                this._triggered = false;
                this._callback();
            });
            this._triggered = true;
        }
    }

    remove() {
        this._callback = () => {};
    }
}

export default ThrottledInvoker;
