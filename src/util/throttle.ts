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
            timerId = setTimeout(later, time) as unknown as number;
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
