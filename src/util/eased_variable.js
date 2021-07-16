// @flow

import {easeCubicInOut} from './util.js';

/**
 * An object for maintaining just enough state to ease a variable.
 *
 * @private
 */
class EasedVariable {
    _start: number;
    _end: number;
    _startTime: number;
    _endTime: number;

    constructor(initialValue: number) {
        this.jumpTo(initialValue);
    }

    /**
     * Evaluate the current value, given a timestamp.
     *
     * @param timeStamp {number} Time at which to evaluate.
     *
     * @returns {number} Evaluated value.
     */
    getValue(timeStamp: number): number {
        if (timeStamp <= this._startTime) return this._start;
        if (timeStamp >= this._endTime) return this._end;

        const t = easeCubicInOut((timeStamp - this._startTime) / (this._endTime - this._startTime));
        return this._start * (1 - t) + this._end * t;
    }

    /**
     * Check if an ease is in progress.
     *
     * @param timeStamp {number} Current time stamp.
     *
     * @returns {boolean} Returns `true` if ease is in progress.
     */
    isEasing(timeStamp: number): boolean {
        return timeStamp >= this._startTime && timeStamp <= this._endTime;
    }

    /**
     * Set the value without easing and cancel any in progress ease.
     *
     * @param value {number} New value.
     */
    jumpTo(value: number) {
        this._startTime = -Infinity;
        this._endTime = -Infinity;

        this._start = value;
        this._end = value;
    }

    /**
     * Cancel any in-progress ease and begin a new ease.
     *
     * @param value {number} New value to which to ease.
     * @param timeStamp {number} Current time stamp.
     * @param duration {number} Ease duration, in same units as timeStamp.
     */
    easeTo(value: number, timeStamp: number, duration: number) {
        this._start = this.getValue(timeStamp);
        this._end = value;

        this._startTime = timeStamp;
        this._endTime = timeStamp + duration;
    }
}

export default EasedVariable;
