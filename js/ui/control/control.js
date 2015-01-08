'use strict';

module.exports = Control;

function Control() {}

Control.prototype = {
	addTo(map) {
		this._map = map;
		this._container = this.onAdd(map);
		if (this.opts && this.opts.position) this._container.className += ' mapboxgl-ctrl-' + this.opts.position;
		return this;
	},

	remove() {
		this._container.parentNode.removeChild(this._container);
		if (this.onRemove) this.onRemove(this._map);
		this._map = null;
		return this;
	}
};
