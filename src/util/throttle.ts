/**
 * Throttle the given function to run at most every `period` milliseconds.
 * @private
 */
export default function throttle(fn: () => void, time: number): () => number | null | undefined {
    let pending = false;
    let timerId: number | null | undefined = null;

    const later = () => {
        timerId = null;
        if (pending) {
            fn();
            // @ts-expect-error - TS2322 - Type 'Timeout' is not assignable to type 'number'.
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
