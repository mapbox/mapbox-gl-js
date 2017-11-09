// @flow

/**
 * Throttle the given function to run at most every `period` milliseconds.
 */
module.exports = function(unthrottledFunction: () => void, period: number): () => void {

    // The next time (unix epoch) that the function is allowed to execute
    let nextTime = 0;

    // `true` if there is a pending "setTimeout" operation that'll invoke the
    // function at a later time. `false` if there is not.
    let pending = false;

    const throttledFunction = () => {
        const time = Date.now();

        if (nextTime <= time && !pending) {
            nextTime = time + period;
            unthrottledFunction();
        } else if (!pending) {
            pending = true;
            // eslint-disable-next-line no-use-before-define
            setTimeout(_throttledFunction, nextTime - time);
        }
    };

    // This callback to `setTimeout` is written outside `throttledFunction` to
    // reduce the number of closures created.
    const _throttledFunction = () => {
        pending = false;
        throttledFunction();
    };

    return throttledFunction;
};
