'use strict';

module.exports = ZoomTransition;

function ZoomTransition(duration) {
    this.duration = duration;
    this.start = 0;

    this.middle = 0;

    this.oldFromValue = null;
    this.fromValue = null;
    this.toValue = null;

    this.interuptedT = null;

    this.result = {};
}

ZoomTransition.prototype.get = function(value) {
    var time = Date.now() - this.start;
    var t = time / this.duration;

    if (value !== this.toValue) {
        this.start = Date.now();
        if (t > this.middle) {
            this.oldFromValue = this.fromValue;
            this.fromValue = this.toValue;
            this.interuptedT = Math.min(1, (t - this.middle) / (1 - this.middle));
        } else {
            this.interuptedT = t / this.middle;
        }
        this.middle = Math.min(0.25, 1 - 1 / (1 + (1 - this.interuptedT)));
        this.toValue = value;
        t = 0;

        if (!this.fromValue) this.fromValue = value;
    }

    var result = this.result;
    if (t >= this.middle) {
        result.from = this.fromValue;
        result.to = this.toValue;
        result.t = Math.min(1, (t - this.middle) / (1 - this.middle));
    } else {
        result.from = this.oldFromValue;
        result.to = this.fromValue;
        result.t = Math.min(1, t / this.middle);
    }
    return result;
};
