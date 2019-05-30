// @flow strict

/**
 * Throttle the given function to run at most every `period` milliseconds.
 Throttle the given function to run at most every period milliseconds.
 * @private
 */
export default function throttle(fn: () => void, time: number): () => ?TimeoutID {
    let pending = false;
    let timerId: ?TimeoutID = null;

    const later = () => {
        timerId = null;
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
}
