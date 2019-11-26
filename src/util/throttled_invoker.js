// @flow
import window from './window';
import {isWorker} from './util';

const raf = window.requestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.msRequestAnimationFrame;
/**
 * Invokes the wrapped function in a non-blocking way when trigger() is called. Invocation requests
 * are ignored until the function was actually invoked.
 *
 * On the main thread, this uses requestAnimationFrame so the deferral of tasks is as low-latency with the render loop as possible.
 * In the WebWorker context, we use a `MessageChannel` to send a message back to the same context, with a fallback to `setTimeout(..,0)`.
 *
 * @private
 */
class ThrottledInvoker {
    _channel: ?MessageChannel;
    _triggered: boolean;
    _callback: Function;
    _bindFunc: Function;
    _isWorker: boolean;

    constructor(callback: Function) {
        this._callback = callback;
        this._triggered = false;
        // The function actually bound to the callback runner.
        this._bindFunc = () => {
            this._triggered = false;
            this._callback();
        };
        this._isWorker = isWorker();
        if(this._isWorker){
            if (typeof MessageChannel !== 'undefined') {
                this._channel = new MessageChannel();
                this._channel.port2.onmessage = this._bindFunc;
            }
        }
    }

    trigger() {
        if (!this._triggered) {
            this._triggered = true;
            //Invoker is MessageChannel/setTimeout on worker side
            if(this._isWorker){
                if (this._channel) {
                    this._channel.port1.postMessage(true);
                } else {
                    setTimeout(this._bindFunc, 0);
                }
            // requestAnimationFrame on the Main Thread.
            }else{
                raf(this._bindFunc);
            }
        }
    }

    remove() {
        this._callback = () => {};
        this._bindFunc = () => {};
    }
}

export default ThrottledInvoker;
