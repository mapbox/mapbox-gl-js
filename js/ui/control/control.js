'use strict';

var Map = require('../map.js');

module.exports = Control;

function Control() {}

Control.prototype = {
	addTo: function(map) {
		this._map = map;
		this._container = this.onAdd(map);
		return this;
	},

	remove: function () {
		this._container.parentNode.removeChild(this._container);
		if (this.onRemove) this.onRemove(this._map);
		this._map = null;
		return this;
	}
};

Map.prototype.addControl = function(control) {
	control.addTo(this);
	return this;
};
