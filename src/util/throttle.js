// @flow

/**
 * Throttle the given function to run at most every `period` milliseconds.
 */
module.exports = function throttle(fn: () => void, time: number): () => number {
    let pending = false;
    let timerId = 0;

    const later = () => {
        timerId = 0;
        if (pending) {
            fn();
            timerId = setTimeout(later, time);
            pending = false;
        }
    };

    return () => {
        pending = true;
        if (!timerId) {
            later();
        }
        return timerId;
    };
};
