'use strict';

module.exports = {
    on: function(evt, fn) {
        if (typeof evt !== 'string' || /\s/.test(evt)) {
            throw new Error('can only bind single string events, got ' + JSON.stringify(evt));
        }

        this._events = this._events || {};
        this._events[evt] = this._events[evt] || [];
        this._events[evt].push(fn);

        return this;
    },

    off: function(evt, fn) {
        if (!this._events) return this;

        if (this._events[evt]) {
            if (fn) {
                var idx = this._events[evt].indexOf(fn);
                if (idx >= 0) { this._events[evt].splice(idx, 1); }
            } else {
                delete this._events[evt];
            }

        } else if (!evt) {
            this._events = {};
        }

        return this;
    },

    fire: function(evt, args) {
        if (this._events) {
            if (!Array.isArray(args)) args = [];
            for (var i = 0; this._events[evt] && i < this._events[evt].length; i++) {
                this._events[evt][i].apply(this, args);
            }
        }
        return this;
    }
};
