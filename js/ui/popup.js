'use strict';

module.exports = Popup;

var util = require('../util/util');
var Evented = require('../util/evented');
var DOM = require('../util/dom');
var LngLat = require('../geo/lng_lat');

/**
 * Creates a popup component
 * @class Popup
 * @param {Object} options
 * @param {boolean} options.closeButton
 * @param {boolean} options.closeOnClick
 * @param {string} options.anchor - One of "top", "bottom", "left", "right", "top-left",
 * "top-right", "bottom-left", or "bottom-right", describing where the popup's anchor
 * relative to the coordinate set via `setLngLat`.
 * @example
 * var tooltip = new mapboxgl.Popup()
 *   .setLngLat(e.lngLat)
 *   .setHTML("<h1>Hello World!</h1>")
 *   .addTo(map);
 */
function Popup(options) {
    util.setOptions(this, options);
    util.bindAll([
        '_update',
        '_onClickClose'],
        this);
}

Popup.prototype = util.inherit(Evented, /** @lends Popup.prototype */{
    options: {
        closeButton: true,
        closeOnClick: true
    },

    /**
     * Attaches the popup to a map
     * @param {Map} map
     * @returns {Popup} `this`
     */
    addTo: function(map) {
        this._map = map;
        this._map.on('move', this._update);
        if (this.options.closeOnClick) {
            this._map.on('click', this._onClickClose);
        }
        this._update();
        return this;
    },

    /**
     * Removes the popup from the map
     * @example
     * var popup = new mapboxgl.Popup().addTo(map);
     * popup.remove();
     * @returns {Popup} `this`
     */
    remove: function() {
        if (this._closeButton) {
            this._closeButton.removeEventListener('click', this._onClickClose);
        }

        if (this._content && this._content.parentNode) {
            this._content.parentNode.removeChild(this._content);
        }

        if (this._container) {
            this._container.parentNode.removeChild(this._container);
            delete this._container;
        }

        if (this._map) {
            this._map.off('move', this._update);
            this._map.off('click', this._onClickClose);
            delete this._map;
        }

        return this;
    },

    /**
     * Get the current coordinates of popup element relative to map
     * @returns {LngLat}
     */
    getLngLat: function() {
        return this._lngLat;
    },

    /**
     * Set the coordinates of a popup element to a map
     * @param {LngLat} lnglat
     * @returns {Popup} `this`
     */
    setLngLat: function(lnglat) {
        this._lngLat = LngLat.convert(lnglat);
        this._update();
        return this;
    },

    /**
     * Fill a popup element with text only content
     * @param {string} text
     * @returns {Popup} `this`
     */
    setText: function(text) {
        this._createContent();
        this._content.appendChild(document.createTextNode(text));

        this._update();
        return this;
    },

    /**
     * Fill a popup element with HTML content
     * @param {string} html
     * @returns {Popup} `this`
     */
    setHTML: function(html) {
        this._createContent();

        var temp = document.createElement('body'), child;
        temp.innerHTML = html;
        while (true) {
            child = temp.firstChild;
            if (!child) break;
            this._content.appendChild(child);
        }

        this._update();
        return this;
    },

    _createContent: function() {
        if (this._closeButton) {
            this._closeButton.removeEventListener('click', this._onClickClose);
        }

        if (this._content && this._content.parentNode) {
            this._content.parentNode.removeChild(this._content);
        }

        this._content = DOM.create('div', 'mapboxgl-popup-content', this._container);

        if (this.options.closeButton) {
            this._closeButton = DOM.create('button', 'mapboxgl-popup-close-button', this._content);
            this._closeButton.innerHTML = '&#215;';
            this._closeButton.addEventListener('click', this._onClickClose);
        }
    },

    _update: function() {
        if (!this._map || !this._lngLat || !this._content) { return; }

        if (!this._container) {
            this._container = DOM.create('div', 'mapboxgl-popup', this._map.getContainer());
            this._tip       = DOM.create('div', 'mapboxgl-popup-tip', this._container);
            this._container.appendChild(this._content);
        }

        var pos = this._map.project(this._lngLat).round(),
            anchor = this.options.anchor;

        if (!anchor) {
            var width = this._container.offsetWidth,
                height = this._container.offsetHeight;

            if (pos.y < height) {
                anchor = ['top'];
            } else if (pos.y > this._map.transform.height - height) {
                anchor = ['bottom'];
            } else {
                anchor = [];
            }

            if (pos.x < width / 2) {
                anchor.push('left');
            } else if (pos.x > this._map.transform.width - width / 2) {
                anchor.push('right');
            }

            if (anchor.length === 0) {
                anchor = 'bottom';
            } else {
                anchor = anchor.join('-');
            }
        }

        var anchorTranslate = {
            'top': 'translate(-50%,0)',
            'top-left': 'translate(0,0)',
            'top-right': 'translate(-100%,0)',
            'bottom': 'translate(-50%,-100%)',
            'bottom-left': 'translate(0,-100%)',
            'bottom-right': 'translate(-100%,-100%)',
            'left': 'translate(0,-50%)',
            'right': 'translate(-100%,-50%)'
        };

        var classList = this._container.classList;
        for (var key in anchorTranslate) {
            classList.remove('mapboxgl-popup-anchor-' + key);
        }
        classList.add('mapboxgl-popup-anchor-' + anchor);

        DOM.setTransform(this._container, anchorTranslate[anchor] + ' translate(' + pos.x + 'px,' + pos.y + 'px)');
    },

    _onClickClose: function() {
        this.remove();
    }
});
