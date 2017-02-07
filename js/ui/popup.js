'use strict';

module.exports = Popup;

var util = require('../util/util');
var Evented = require('../util/evented');
var DOM = require('../util/dom');
var LngLat = require('../geo/lng_lat');
var Point = require('point-geometry');
var window = require('../util/window');

/**
 * A popup component.
 *
 * @class Popup
 * @param {Object} [options]
 * @param {boolean} [options.closeButton=true] If `true`, a close button will appear in the
 *   top right corner of the popup.
 * @param {boolean} [options.closeOnClick=true] If `true`, the popup will closed when the
 *   map is clicked.
 * @param {string} [options.anchor] - A string indicating the popup's location relative to
 *   the coordinate set via [Popup#setLngLat](#Popup#setLngLat).
 *   Options are `'top'`, `'bottom'`, `'left'`, `'right'`, `'top-left'`,
 *   `'top-right'`, `'bottom-left'`, and `'bottom-right'`. If unset the anchor will be
 *   dynamically set to ensure the popup falls within the map container with a preference
 *   for `'bottom'`.
 * @param {number|PointLike|Object} [options.offset] -
 *  A pixel offset applied to the popup's location specified as:
 *   - a single number specifying a distance from the popup's location
 *   - a [`PointLike`](#PointLike) specifying a constant offset
 *   - an object of [`PointLike`](#PointLike)s specifing an offset for each anchor position
 *  Negative offsets indicate left and up.
 * @example
 * var markerHeight = 50, markerRadius = 10, linearOffset = 25;
 * var popupOffsets = {
 *  'top': [0, 0],
 *  'top-left': [0,0],
 *  'top-right': [0,0],
 *  'bottom': [0, -markerHeight],
 *  'bottom-left': [linearOffset, (markerHeight - markerRadius + linearOffset) * -1],
 *  'bottom-right': [-linearOffset, (markerHeight - markerRadius + linearOffset) * -1],
 *  'left': [markerRadius, (markerHeight - markerRadius) * -1],
 *  'right': [-markerRadius, (markerHeight - markerRadius) * -1]
 *  };
 * var popup = new mapboxgl.Popup({offset:popupOffsets})
 *   .setLngLat(e.lngLat)
 *   .setHTML("<h1>Hello World!</h1>")
 *   .addTo(map);
 * @see [Display a popup](https://www.mapbox.com/mapbox-gl-js/example/popup/)
 * @see [Display a popup on hover](https://www.mapbox.com/mapbox-gl-js/example/popup-on-hover/)
 * @see [Display a popup on click](https://www.mapbox.com/mapbox-gl-js/example/popup-on-click/)
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
     * Adds the popup to a map.
     *
     * @param {Map} map The Mapbox GL JS map to add the popup to.
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
     * @returns {boolean} `true` if the popup is open, `false` if it is closed.
     */
    isOpen: function() {
        return !!this._map;
    },

    /**
     * Removes the popup from the map it has been added to.
     *
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

        /**
         * Fired when the popup is closed manually or programatically.
         *
         * @event close
         * @memberof Popup
         * @instance
         * @type {Object}
         * @property {Popup} popup object that was closed
         */
        this.fire('close');

        return this;
    },

    /**
     * Returns the geographical location of the popup's anchor.
     *
     * @returns {LngLat} The geographical location of the popup's anchor.
     */
    getLngLat: function() {
        return this._lngLat;
    },

    /**
     * Sets the geographical location of the popup's anchor, and moves the popup to it.
     *
     * @param {LngLatLike} lnglat The geographical location to set as the popup's anchor.
     * @returns {Popup} `this`
     */
    setLngLat: function(lnglat) {
        this._lngLat = LngLat.convert(lnglat);
        this._update();
        return this;
    },

    /**
     * Sets the popup's content to a string of text.
     *
     * This function creates a [Text](https://developer.mozilla.org/en-US/docs/Web/API/Text) node in the DOM,
     * so it cannot insert raw HTML. Use this method for security against XSS
     * if the popup content is user-provided.
     *
     * @param {string} text Textual content for the popup.
     * @returns {Popup} `this`
     * @example
     * var popup = new mapboxgl.Popup()
     *   .setLngLat(e.lngLat)
     *   .setText('Hello, world!')
     *   .addTo(map);
     */
    setText: function(text) {
        return this.setDOMContent(window.document.createTextNode(text));
    },

    /**
     * Sets the popup's content to the HTML provided as a string.
     *
     * @param {string} html A string representing HTML content for the popup.
     * @returns {Popup} `this`
     */
    setHTML: function(html) {
        var frag = window.document.createDocumentFragment();
        var temp = window.document.createElement('body'), child;
        temp.innerHTML = html;
        while (true) {
            child = temp.firstChild;
            if (!child) break;
            frag.appendChild(child);
        }

        return this.setDOMContent(frag);
    },

    /**
     * Sets the popup's content to the element provided as a DOM node.
     *
     * @param {Node} htmlNode A DOM node to be used as content for the popup.
     * @returns {Popup} `this`
     * @example
     * // create an element with the popup content
     * var div = window.document.createElement('div');
     * div.innerHTML = 'Hello, world!';
     * var popup = new mapboxgl.Popup()
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
            this._closeButton.type = 'button';
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

        var anchor = this.options.anchor;
        var offset = normalizeOffset(this.options.offset);
        var pos = this._map.project(this._lngLat).round();

        if (!anchor) {
            var width = this._container.offsetWidth,
                height = this._container.offsetHeight;

            if (pos.y + offset.bottom.y < height) {
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

        var offsetedPos = pos.add(offset[anchor]);

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

        DOM.setTransform(this._container, anchorTranslate[anchor] + ' translate(' + offsetedPos.x + 'px,' + offsetedPos.y + 'px)');
    },

    _onClickClose: function() {
        this.remove();
    }
});

function normalizeOffset(offset) {

    if (!offset) {
        return normalizeOffset(new Point(0, 0));

    } else if (typeof offset === 'number') {
        // input specifies a radius from which to calculate offsets at all positions
        var cornerOffset = Math.round(Math.sqrt(0.5 * Math.pow(offset, 2)));
        return {
            'top': new Point(0, offset),
            'top-left': new Point(cornerOffset, cornerOffset),
            'top-right': new Point(-cornerOffset, cornerOffset),
            'bottom': new Point(0, -offset),
            'bottom-left': new Point(cornerOffset, -cornerOffset),
            'bottom-right': new Point(-cornerOffset, -cornerOffset),
            'left': new Point(offset, 0),
            'right': new Point(-offset, 0)
        };

    } else if (isPointLike(offset)) {
        // input specifies a single offset to be applied to all positions
        var convertedOffset = Point.convert(offset);
        return {
            'top': convertedOffset,
            'top-left': convertedOffset,
            'top-right': convertedOffset,
            'bottom': convertedOffset,
            'bottom-left': convertedOffset,
            'bottom-right': convertedOffset,
            'left': convertedOffset,
            'right': convertedOffset
        };

    } else {
        // input specifies an offset per position
        return {
            'top': Point.convert(offset['top']),
            'top-left': Point.convert(offset['top-left']),
            'top-right': Point.convert(offset['top-right']),
            'bottom': Point.convert(offset['bottom']),
            'bottom-left': Point.convert(offset['bottom-left']),
            'bottom-right': Point.convert(offset['bottom-right']),
            'left': Point.convert(offset['left']),
            'right': Point.convert(offset['right'])
        };
    }
}

function isPointLike(input) {
    return input instanceof Point || Array.isArray(input);
}
