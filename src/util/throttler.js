
const browser = require('./browser');

/**
 * Throttles the provided function to run at most every
 * 'frequency' milliseconds
 *
 * @interface Throttler
 * @private
 */
class Throttler {

    constructor(frequency, throttledFunction) {
        this.frequency = frequency;
        this.throttledFunction = throttledFunction;
        this.lastInvocation = 0;
    }

    /**
     * Request an invocation of the throttled function.
     *
     * @memberof Throttler
     * @instance
     */
    invoke() {
        if (this.pendingInvocation) {
            return;
        }

        const timeToNextInvocation = this.lastInvocation === 0 ?
            0 :
            (this.lastInvocation + this.frequency) - browser.now();

        if (timeToNextInvocation <= 0) {
            this.lastInvocation = browser.now();
            this.throttledFunction();
        } else {
            this.pendingInvocation = setTimeout(() => {
                this.pendingInvocation = undefined;
                this.lastInvocation = browser.now();
                this.throttledFunction();
            }, timeToNextInvocation);
        }
    }

    stop() {
        if (this.pendingInvocation) {
            clearTimeout(this.pendingInvocation);
            this.pendingInvocation = undefined;
        }
    }
}

module.exports = Throttler;
