// @flow

/**
 * Invokes the wrapped function in a non-blocking way when trigger() is called. Invocation requests
 * are ignored until the function was actually invoked.
 *
 * @private
 */
class ThrottledInvoker {
    _channel: MessageChannel;
    _triggered: boolean;
    _callback: Function

    constructor(callback: Function) {
        this._callback = callback;
        this._triggered = false;
        if (typeof MessageChannel !== 'undefined') {
            this._channel = new MessageChannel();
            this._channel.port2.onmessage = () => {
                this._triggered = false;
                this._callback();
            };
        }
    }

    trigger() {
        if (!this._triggered) {
            this._triggered = true;
            if (this._channel) {
                this._channel.port1.postMessage(true);
            } else {
                setTimeout(() => {
                    this._triggered = false;
                    this._callback();
                }, 0);
            }
        }
    }
}

export default ThrottledInvoker;
