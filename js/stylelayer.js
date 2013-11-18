var evented = require('./evented.js');
var _ = require('./lib/lodash.js');

module.exports = StyleLayer;
function StyleLayer(data, style) {
    this.data = data;
    this.style = style;
    this.bucket = data.bucket;

    if (this.data.layers) {
        this.layers = this.data.layers.map(function(layer) {
            return new StyleLayer(layer, style);
        });
    }

    this.parse();
}

StyleLayer.prototype = {
    get id() {
        return this.data.bucket + '/' + (this.data.name || '');
    },

    get buckets() {
        var buckets = _(this.layers || []).pluck('buckets').flatten().push(this.bucket);
        return buckets.value();
    },

    remove: function() {
        this.fire('remove');
    },

    setColor: function(color) {
        this.data.color = color;
        this.parse();
        this.fire('change');
    },

    setWidth: function(width) {
        this.data.width = color;
        this.parse();
        this.fire('change');
    },

    setImage: function(image) {
        this.data.image = image;
        this.parse();
        this.fire('change');
    },

    setName: function(name) {
        this.data.name = name;
        this.fire('change');
    },

    parse: function() {
        var style = this.style, layer = this.data;
        var parsed = this.parsed = {};
        if ('hidden' in layer) parsed.hidden = style.parseFunction(layer.hidden);
        if ('opacity' in layer) parsed.opacity = style.parseFunction(layer.opacity);
        if ('pulsating' in layer) parsed.pulsating = layer.pulsating;
        if ('color' in layer) parsed.color = style.parseColor(layer.color);
        if ('stroke' in layer) parsed.stroke = style.parseColor(layer.stroke);
        if ('width' in layer) parsed.width = style.parseWidth(layer.width);
        if ('offset' in layer) parsed.offset = style.parseWidth(layer.offset);
        if ('antialias' in layer) parsed.antialias = layer.antialias;
        if ('image' in layer) parsed.image = layer.image;
        if ('alignment' in layer) parsed.alignment = layer.alignment;
        if ('dasharray' in layer) parsed.dasharray = [style.parseWidth(layer.dasharray[0]), style.parseWidth(layer.dasharray[1])];
        if (this.layers) this.layers.forEach(function(layer) { layer.parse(); });
    },

    zoom: function(z) {
        var style = this.style, layer = this.parsed;
        var zoomed = this.zoomed = {};
        if ('hidden' in layer) zoomed.hidden = style.parseValue(layer.hidden, z);
        if ('color' in layer) zoomed.color = layer.color;
        if ('stroke' in layer) zoomed.stroke = layer.stroke;
        if ('width' in layer) zoomed.width = style.parseValue(layer.width, z);
        if ('offset' in layer) zoomed.offset = style.parseValue(layer.offset, z);
        if ('opacity' in layer && zoomed.color) {
            zoomed.color.alpha(style.parseValue(layer.opacity, z));
            if (zoomed.stroke) {
                zoomed.stroke.alpha(zoomed.color.alpha());
                zoomed.stroke = zoomed.stroke.premultiply();
            }
            zoomed.color = zoomed.color.premultiply();
        } else if ('opacity' in layer) zoomed.opacity = style.parseValue(layer.opacity, z);
        if ('pulsating' in layer) zoomed.pulsating = layer.pulsating;
        if ('antialias' in layer) zoomed.antialias = layer.antialias;
        if ('image' in layer) zoomed.image = layer.image;
        if ('alignment' in layer) zoomed.alignment = layer.alignment;
        if ('dasharray' in layer) zoomed.dasharray = [style.parseWidth(layer.dasharray[0]), style.parseWidth(layer.dasharray[1])];
        if (this.layers) this.layers.forEach(function(layer) { layer.zoom(z); });
    },

    toJSON: function() {
        return this.data;
    }
};

evented(StyleLayer);
