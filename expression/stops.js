// @flow

import RuntimeError from './runtime_error.js';

import type {Expression} from './expression.js';

export type Stops = Array<[number, Expression]>;

/**
 * Returns the index of the last stop <= input, or 0 if it doesn't exist.
 * @private
 */
export function findStopLessThanOrEqualTo(stops: Array<number>, input: number): number {
    const lastIndex = stops.length - 1;
    let lowerIndex = 0;
    let upperIndex = lastIndex;
    let currentIndex = 0;
    let currentValue, nextValue;

    while (lowerIndex <= upperIndex) {
        currentIndex = Math.floor((lowerIndex + upperIndex) / 2);
        currentValue = stops[currentIndex];
        nextValue = stops[currentIndex + 1];

        if (currentValue <= input) {
            if (currentIndex === lastIndex || input < nextValue) { // Search complete
                return currentIndex;
            }

            lowerIndex = currentIndex + 1;
        } else if (currentValue > input) {
            upperIndex = currentIndex - 1;
        } else {
            throw new RuntimeError('Input is not a number.');
        }
    }

    return 0;
}
