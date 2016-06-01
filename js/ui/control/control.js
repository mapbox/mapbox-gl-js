'use strict';

var util = require('../../util/util');
var Evented = require('../../util/evented');
module.exports = Control;

/**
 * A base class for map-related interface elements.
 *
 * @class Control
 */
function Control() {}

Control.prototype = {
    /**
     * Add this control to the map, returning the control itself
     * for chaining. This will insert the control's DOM element into
     * the map's DOM element if the control has a `position` specified.
     *
     * @param {Map} map
     * @returns {Control} `this`
     */
    addTo: function(map) {
        this._map = map;
        var container = this._container = this.onAdd(map);
        if (this.options && this.options.position) {
            var pos = this.options.position;
            var corner = map._controlCorners[pos];
            container.className += ' mapboxgl-ctrl';
            if (pos.indexOf('bottom') !== -1) {
                corner.insertBefore(container, corner.firstChild);
            } else {
                corner.appendChild(container);
            }
        }

        return this;
    },

    /**
     * Remove this control from the map it has been added to.
     *
     * @returns {Control} `this`
     */
    remove: function() {
        this._container.parentNode.removeChild(this._container);
        if (this.onRemove) this.onRemove(this._map);
        this._map = null;
        return this;
    }
};

util.extend(Control.prototype, Evented);
