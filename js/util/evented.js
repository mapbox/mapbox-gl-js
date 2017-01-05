'use strict';

const util = require('./util');

/**
 * Methods mixed in to other classes for event capabilities.
 *
 * @mixin Evented
 */
class Evented {

    /**
     * Adds a listener to a specified event type.
     *
     * @param {string} type The event type to add a listen for.
     * @param {Function} listener The function to be called when the event is fired.
     *   The listener function is called with the data object passed to `fire`,
     *   extended with `target` and `type` properties.
     * @returns {Object} `this`
     */
    on(type, listener) {
        this._listeners = this._listeners || {};
        this._listeners[type] = this._listeners[type] || [];
        this._listeners[type].push(listener);

        return this;
    }

    /**
     * Removes a previously registered event listener.
     *
     * @param {string} type The event type to remove listeners for.
     * @param {Function} listener The listener function to remove.
     * @returns {Object} `this`
     */
    off(type, listener) {
        if (this._listeners && this._listeners[type]) {
            const index = this._listeners[type].indexOf(listener);
            if (index !== -1) {
                this._listeners[type].splice(index, 1);
            }
        }

        return this;
    }

    /**
     * Adds a listener that will be called only once to a specified event type.
     *
     * The listener will be called first time the event fires after the listener is registered.
     *
     * @param {string} type The event type to listen for.
     * @param {Function} listener The function to be called when the event is fired the first time.
     * @returns {Object} `this`
     */
    once(type, listener) {
        const wrapper = (data) => {
            this.off(type, wrapper);
            listener.call(this, data);
        };
        this.on(type, wrapper);
        return this;
    }

    /**
     * Fires an event of the specified type.
     *
     * @param {string} type The type of event to fire.
     * @param {Object} [data] Data to be passed to any listeners.
     * @returns {Object} `this`
     */
    fire(type, data) {
        if (this.listens(type)) {

            data = util.extend({}, data, {type: type, target: this});

            // make sure adding or removing listeners inside other listeners won't cause an infinite loop
            const listeners = this._listeners && this._listeners[type] ? this._listeners[type].slice() : [];

            for (let i = 0; i < listeners.length; i++) {
                listeners[i].call(this, data);
            }

            if (this._eventedParent) {
                this._eventedParent.fire(type, util.extend({}, data, this._eventedParentData));
            }

        // To ensure that no error events are dropped, print them to the
        // console if they have no listeners.
        } else if (util.endsWith(type, 'error')) {
            console.error((data && data.error) || data || 'Empty error event');
        }

        return this;
    }

    /**
     * Returns a true if this instance of Evented or any forwardeed instances of Evented have a listener for the specified type.
     *
     * @param {string} type The event type
     * @returns {boolean} `true` if there is at least one registered listener for specified event type, `false` otherwise
     */
    listens(type) {
        return (
            (this._listeners && this._listeners[type]) ||
            (this._eventedParent && this._eventedParent.listens(type))
        );
    }

    /**
     * Bubble all events fired by this instance of Evented to this parent instance of Evented.
     *
     * @private
     * @param {parent}
     * @param {data}
     * @returns {Object} `this`
     */
    setEventedParent(parent, data) {
        this._eventedParent = parent;
        this._eventedParentData = typeof data === 'function' ? data() : data;

        return this;
    }
}

module.exports = Evented;
