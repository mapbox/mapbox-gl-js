'use strict';

module.exports = Popup;

var util = require('../util/util');
var Evented = require('../util/evented');
var DOM = require('../util/dom');
var LatLng = require('../geo/lat_lng');

function Popup(options) {
    util.setOptions(this, options);
    util.bindAll([
        '_updatePosition',
        '_onClickClose'],
        this);
}

/**
 * Creates a tooltip component
 * @class mapboxgl.Popup
 * @returns div Attribution element
 * @param {Object} options
 * @param {Boolean} options.closeButton
 * @param {Boolean} options.closeOnClick
 * @example
 * var tooltip = new mapboxgl.Popup()
 *   .setLatLng(map.unproject(e.point))
 *   .setHTML("<h1>Hello World!</h1>")
 *   .addTo(map);
 */
Popup.prototype = util.inherit(Evented, {
    options: {
        closeButton: true,
        closeOnClick: true
    },

    /** Attaches popup to map element
     *
     * @param {Object} map
     * @returns {Popup} `this`
     */
    addTo: function(map) {
        this._map = map;
        this._map.on('move', this._updatePosition);
        if (this.options.closeOnClick) {
            this._map.on('click', this._onClickClose);
        }
        this._update();
        return this;
    },

    /** Removes popup element from map
     *
     * @example
     * var popup = new mapboxgl.Popup().addTo(map);
     * popup.remove();
     * @returns {Popup} `this`
     */
    remove: function() {
        if (this._container) {
            this._container.parentNode.removeChild(this._container);
        }

        if (this._map) {
            this._map.off('move', this._updatePosition);
            this._map.off('click', this._onClickClose);
            delete this._map;
        }

        return this;
    },

    /** Get the current coordinates of popup element relative to map
     *
     * @returns {Popup} `this`
     */
    getLatLng: function() {
        return this._latLng;
    },

    /** Set the coordinates of a popup element to a map
     *
     * @param {Object} latlng a LatLng object
     * @returns {Popup} `this`
     */
    setLatLng: function(latlng) {
        this._latLng = LatLng.convert(latlng);
        this._update();
        return this;
    },

    /** Popuplate a popup element with text only content
     *
     * @param {String} text
     * @returns {Popup} `this`
     */
    setText: function(text) {
        this._content = document.createTextNode(text);
        this._updateContent();
        return this;
    },

    /** Popuplate a popup element with HTML content
     *
     * @param {String} html
     * @returns {Popup} `this`
     */
    setHTML: function(html) {
        this._content = document.createDocumentFragment();

        var temp = document.createElement('body'), child;
        temp.innerHTML = html;
        while (true) {
            child = temp.firstChild;
            if (!child) break;
            this._content.appendChild(child);
        }

        this._updateContent();
        return this;
    },

    _update: function() {
        if (!this._map) { return; }

        if (!this._container) {
            this._container = DOM.create('div', 'mapboxgl-popup', this._map.getContainer());

            this._tip     = DOM.create('div', 'mapboxgl-popup-tip',     this._container);
            this._wrapper = DOM.create('div', 'mapboxgl-popup-content', this._container);

            if (this.options.closeButton) {
                this._closeButton = DOM.create('button', 'mapboxgl-popup-close-button', this._wrapper);
                this._closeButton.innerHTML = '&#215;';
                this._closeButton.addEventListener('click', this._onClickClose);
            }
        }

        this._updateContent();
        this._updatePosition();
    },

    _updateContent: function() {
        if (!this._content || !this._container) { return; }

        var node = this._wrapper;

        while (node.hasChildNodes()) {
            node.removeChild(node.firstChild);
        }

        node.appendChild(this._closeButton);
        node.appendChild(this._content);
    },

    _updatePosition: function() {
        if (!this._latLng || !this._container) { return; }

        var pos = this._map.project(this._latLng).round(),
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

            this.options.anchor = anchor;
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
