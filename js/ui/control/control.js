'use strict';

module.exports = Control;

function Control() {}

Control.prototype = {
	addTo: function(map) {
		this._map = map;
		this._container = this.onAdd(map);
		if (this.options && this.options.position) this._container.className += ' mapboxgl-ctrl-' + this.options.position;
		return this;
	},

	remove: function() {
		this._container.parentNode.removeChild(this._container);
		if (this.onRemove) this.onRemove(this._map);
		this._map = null;
		return this;
	}
};
