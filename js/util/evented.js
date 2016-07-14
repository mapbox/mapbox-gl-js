'use strict';

var util = require('./util');

/**
 * Methods mixed in to other classes for event capabilities.
 *
 * @mixin Evented
 */
var Evented = {

    /**
     * Adds a listener to a specified event type.
     *
     * @param {string} type The event type to add a listen for.
     * @param {Function} listener The function to be called when the event is fired.
     *   The listener function is called with the data object passed to `fire`,
     *   extended with `target` and `type` properties.
     * @returns {Object} `this`
     */
    on: function(type, listener) {
        this._events = this._events || {};
        this._events[type] = this._events[type] || [];
        this._events[type].push(listener);

        return this;
    },

    /**
     * Removes a previously registered event listener.
     *
     * @param {string} [type] The event type to remove listeners for.
     *   If none is specified, listeners will be removed for all event types.
     * @param {Function} [listener] The listener function to remove.
     *   If none is specified, all listeners will be removed for the event type.
     * @returns {Object} `this`
     */
    off: function(type, listener) {
        if (!type) {
            // clear all listeners if no arguments specified
            delete this._events;
            return this;
        }

        if (!this.listens(type)) return this;

        if (listener) {
            var idx = this._events[type].indexOf(listener);
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
     * Adds a listener that will be called only once to a specified event type.
     *
     * The listener will be called first time the event fires after the listener is registered.
     *
     * @param {string} type The event type to listen for.
     * @param {Function} listener The function to be called when the event is fired the first time.
     * @returns {Object} `this`
     */
    once: function(type, listener) {
        var wrapper = function(data) {
            this.off(type, wrapper);
            listener.call(this, data);
        }.bind(this);
        this.on(type, wrapper);
        return this;
    },

    /**
     * Fires an event of the specified type.
     *
     * @param {string} type The type of event to fire.
     * @param {Object} [data] Data to be passed to any listeners.
     * @returns {Object} `this`
     */
    fire: function(type, data) {
        if (!this.listens(type)) {
            // To ensure that no error events are dropped, print them to the
            // console if they have no listeners.
            if (util.endsWith(type, 'error')) {
                console.error((data && data.error) || data || 'Empty error event');
            }
            return this;
        }

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
     * Returns a Boolean indicating whether any listeners are registered for a specified event type.
     *
     * @param {string} type The event type to check.
     * @returns {boolean} `true` if there is at least one registered listener for specified event type.
     */
    listens: function(type) {
        return !!(this._events && this._events[type]);
    }
};

module.exports = Evented;
