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
 * @param {boolean} options.closeButton whether to show a close button in the
 * top right corner of the popup.
 * @param {boolean} options.closeOnClick whether to close the popup when the
 * map is clicked.
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
     * Removes the popup from a map
     * @example
     * var popup = new mapboxgl.Popup().addTo(map);
     * popup.remove();
     * @returns {Popup} `this`
     */
    remove: function() {
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
     * Get the popup's geographical location
     * @returns {LngLat}
     */
    getLngLat: function() {
        return this._lngLat;
    },

    /**
     * Set the popup's geographical position and move it.
     * @param {LngLat} lnglat
     * @returns {Popup} `this`
     */
    setLngLat: function(lnglat) {
        this._lngLat = LngLat.convert(lnglat);
        this._update();
        return this;
    },

    /**
     * Fill a popup element with text only content. This creates a text node
     * in the DOM, so it cannot end up appending raw HTML. Use this method
     * if you want an added level of security against XSS if the popup
     * content is user-provided.
     * @param {string} text
     * @returns {Popup} `this`
     * @example
     * var tooltip = new mapboxgl.Popup()
     *   .setLngLat(e.lngLat)
     *   .setText('Hello, world!')
     *   .addTo(map);
     */
    setText: function(text) {
        return this.setDOMContent(document.createTextNode(text));
    },

    /**
     * Fill a popup element with HTML content, provided as a string.
     * @param {string} html
     * @returns {Popup} `this`
     */
    setHTML: function(html) {
        var frag = document.createDocumentFragment();
        var temp = document.createElement('body'), child;
        temp.innerHTML = html;
        while (true) {
            child = temp.firstChild;
            if (!child) break;
            frag.appendChild(child);
        }

        return this.setDOMContent(frag);
    },

    /**
     * Fill a popup element with DOM content
     * @param {Node} htmlNode Popup content as a DOM node
     * @returns {Popup} `this`
     * @example
     * // create an element with the popup content
     * var div = document.createElement('div');
     * div.innerHTML = 'Hello, world!';
     * var tooltip = new mapboxgl.Popup()
     *   .setLngLat(e.lngLat)
     *   .setDOMContent(div)
     *   .addTo(map);
     */
    setDOMContent: function(htmlNode) {
        this._createContent();
        this._content.appendChild(htmlNode);
        this._update();
        return this;
    },

    _createContent: function() {
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
