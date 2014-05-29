L.GLLayer = L.Class.extend({

    options: {
        maxZoom: 20,
        minZoom: 0,
    },

    initialize: function (options) {
        L.setOptions(this, options);
    },

    onAdd: function (map) {
        this._map = map;

        if (!this._glContainer) {
            this._initContainer();
        }

        map._panes.overlayPane.appendChild(this._glContainer);
        map.on('zoomanim', this._animateZoom, this);
        map.on('move', this._update, this);

        this._initGL();
    },

    onRemove: function (map) {
        map.getPanes().overlayPane.removeChild(this._glContainer);
        map.off('zoomanim', this._animateZoom, this);
        map.off('move', this._update, this);
    },

    addTo: function (map) {
        map.addLayer(this);
        return this;
    },

    _initContainer: function () {
        var container = this._glContainer = L.DomUtil.create('div', 'leaflet-gl-layer');

        var size = this._map.getSize();
        container.style.width  = size.x + 'px';
        container.style.height = size.y + 'px';
    },

    _initGL: function () {
        var center = this._map.getCenter();

        this._glMap = new llmr.Map({
            container: this._glContainer,
            interactive: false,
            sources: {
                "mapbox streets": {
                    type: 'vector',
                    urls: ['http://a.gl-api-us-east-1.tilestream.net/v3/mapbox.mapbox-streets-v4/{z}/{x}/{y}.vector.pbf'],
                    tileSize: 512,
                    zooms: [0, 2, 3, 4, 5, 6, 7, 8, 10, 12, 13, 14],
                }
            },
            center: [center.lat, center.lng],
            zoom: this._map.getZoom(),
            maxZoom: 20,
            style: style_json
        });
    },

    _update: function () {
        var size = this._map.getSize(),
            container = this._glContainer,
            gl = this._glMap,
            topLeft = this._map.containerPointToLayerPoint([0, 0]);

        L.DomUtil.setPosition(container, topLeft);

        if (gl.transform.width !== size.x || gl.transform.width !== size.y) {
            container.style.width  = size.x + 'px';
            container.style.height = size.y + 'px';
            gl.resize();
        }

        var center = this._map.getCenter();

        gl.setPosition([center.lat, center.lng], this._map.getZoom());
    },

    _animateZoom: function (e) {
        var origin = e.origin.add(this._map._getMapPanePos());
        this._glMap.zoomTo(e.zoom, 250, [origin.x, origin.y], [0, 0, 0.25, 1]);
    }
});

L.glLayer = function (options) {
    return new L.GLLayer(options);
};
