'use strict';

var util = require('./util');

module.exports = {
    on: function(type, fn) {
        this._events = this._events || {};
        this._events[type] = this._events[type] || [];
        this._events[type].push(fn);

        return this;
    },

    off: function(type, fn) {
        if (!type) {
            // clear all listeners if no arguments specified
            delete this._events;
            return this;
        }

        if (!this.listens(type)) return this;

        if (fn) {
            var idx = this._events[type].indexOf(fn);
            if (idx >= 0) {
                this._events[type].splice(idx, 1);
            }
            if (!this._events[type].length) {
                delete this._events[type];
            }
        } else {
            delete this._events[type];
        }

        return this;
    },

    once: function(type, fn) {
        var wrapper = function(data) {
            this.off(type, wrapper);
            fn.call(this, data);
        }.bind(this);
        this.on(type, wrapper);
        return this;
    },

    fire: function(type, data) {
        if (!this.listens(type)) return this;

        data = util.extend({}, data);
        util.extend(data, {type: type, target: this});

        // make sure adding/removing listeners inside other listeners won't cause infinite loop
        var listeners = this._events[type].slice();

        for (var i = 0; i < listeners.length; i++) {
            listeners[i].call(this, data);
        }

        return this;
    },

    listens: function(type) {
        return !!(this._events && this._events[type]);
    }
};
