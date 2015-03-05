'use strict';

var util = require('./util');

/**
 * A class inherited by other classes to get event capabilities.
 * @class mapboxgl.Evented
 * @extends mapboxgl.Map
 */
module.exports = {

    /**
     * Subscribe to a specified event with a listener function the latter gets the data object that was passed to `fire` and additionally `target` and `type` properties
     *
     * @param {String} type Event type
     * @param {Function} listener Function to be called when the event is fired
     */
    on: function(type, fn) {
        this._events = this._events || {};
        this._events[type] = this._events[type] || [];
        this._events[type].push(fn);

        return this;
    },

    /**
     * Remove a event listener
     *
     * @param {String} [type] Event type. If none is specified, remove all listeners
     * @param {Function} [listener] Function to be called when the event is fired. If none is specified all listeners are removed
     */
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

    /**
     * Call a function once when an event has fired
     *
     * @param {String} type Event type.
     * @param {Function} listener Function to be called once when the event is fired
     */
    once: function(type, fn) {
        var wrapper = function(data) {
            this.off(type, wrapper);
            fn.call(this, data);
        }.bind(this);
        this.on(type, wrapper);
        return this;
    },

    /**
     * Fire event of a given string type with the given data object
     *
     * @param {String} type The event name
     * @param {Object} [data] Optional data passed down to the event object
     * @returns {Boolean} Returns true if the object listens to an event of a particular type
     */
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

    /**
     * Check if an event is registered to a type
     * @returns {Boolean} Returns true if the object listens to an event of a particular type
     */
    listens: function(type) {
        return !!(this._events && this._events[type]);
    }
};
