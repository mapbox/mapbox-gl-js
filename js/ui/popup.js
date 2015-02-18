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

Popup.prototype = util.inherit(Evented, {
    options: {
        closeButton: true,
        closeOnClick: true
    },

    addTo: function(map) {
        this._map = map;
        this._map.on('move', this._updatePosition);
        if (this.options.closeOnClick) {
            this._map.on('click', this._onClickClose);
        }
        this._update();
        return this;
    },

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

    getLatLng: function() {
        return this._latLng;
    },

    setLatLng: function(latlng) {
        this._latLng = LatLng.convert(latlng);
        this._update();
        return this;
    },

    setText: function(text) {
        this._content = document.createTextNode(text);
        this._updateContent();
        return this;
    },

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

            if (this.options.closeButton) {
                this._closeButton = DOM.create('button', 'mapboxgl-popup-close-button', this._container);
                this._closeButton.innerHTML = '&#215;';
                this._closeButton.addEventListener('click', this._onClickClose);
            }

            this._wrapper = DOM.create('div', 'mapboxgl-popup-content', this._container);
            this._tip     = DOM.create('div', 'mapboxgl-popup-tip',     this._container);
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

        node.appendChild(this._content);
    },

    _updatePosition: function() {
        if (!this._latLng || !this._container) { return; }

        var pos = this._map.project(this._latLng).round();
        DOM.setTransform(this._container, 'translate(-50%,-100%) translate(' + pos.x + 'px,' + pos.y + 'px)');
    },

    _onClickClose: function() {
        this.remove();
    }
});
