'use strict';

module.exports = evented;
function evented(obj) {
    obj.prototype.on = evented.on;
    obj.prototype.off = evented.off;
    obj.prototype.fire = evented.fire;
};

evented.on = function(evt, fn) {
    if (typeof evt !== 'string' || /\s/.test(evt)) throw new Error('can only bind single string events, got ' + JSON.stringify(evt));
    if (!this._events) Object.defineProperty(this, "_events", { value: {} });
    if (!this._events[evt]) this._events[evt] = [];
    this._events[evt].push(fn);
    return this;
};

evented.off = function(evt, fn) {
    if (this._events && this._events[evt]) {
        if (fn) {
            var idx = this._events[evt].indexOf(fn);
            if (idx >= 0) { this._events[evt].splice(idx, 1); }
        } else {
            delete this._events[evt];
        }
    } else if (this._events && !evt) {
        for (evt in this._events) {
            delete this._events[evt];
        }
    }
    return this;
};

evented.fire = function(evt, args) {
    if (this._events) {
        if (!Array.isArray(args)) args = [];
        for (var i = 0; this._events[evt] && i < this._events[evt].length; i++) {
            this._events[evt][i].apply(this, args);
        }
    }
};
