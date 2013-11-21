var evented = require('./evented.js');
var StyleRule = require('./stylerule.js');

module.exports = StyleLayer;

function StyleLayer(data, style, constants) {
    this.data = data;
    this.style = style;
    this.constants = constants;

    if (this.data.layers) {
        this.layers = this.data.layers.map(function(layer) {
            return new StyleLayer(layer, style, constants);
        });
    }

    this.parse();
}

StyleLayer.prototype = {
    get id() {
        return this.data.bucket + '/' + (this.data.name || '');
    },

    get bucket() {
        return this.data.bucket;
    },

    get buckets() {
        var buckets = [this.bucket];
        (this.layers || []).forEach(function(layer) {
            buckets.push.apply(buckets, layer.buckets);
        });
        return buckets;
    },

    remove: function() {
        this.fire('remove');
        if (this.layers) this.layers.forEach(function(layer) {
            layer.fire('remove');
        });
    },

    setType: function(type) {
        switch (type) {
            case 'point':
                delete this.data.color;
                delete this.data.width;
                delete this.data.antialias;
                this.data.image = 'triangle';
                break;
            case 'line':
                delete this.data.image;
                delete this.data.imageSize;
                delete this.data.antialias;
                this.data.width = ['stops'];
                if (!this.data.color) this.data.color = '#FF0000';
                break;
            case 'fill':
                delete this.data.image;
                delete this.data.imageSize;
                delete this.data.width;
                this.data.antialias = true;
                if (!this.data.color) this.data.color = '#FF0000';
                break;
        }
        this.parse();
        this.fire('change');
    },

    setProperty: function(prop, value) {
        this.data[prop] = value;
        this.parse();
        this.fire('change');
    },

    parse: function() {
        var style = this.style, layer = this.data;

        var parsed = this.parsed = {};

        for (var s in layer) {
            var rule = new StyleRule(s, layer[s], this.constants);
            if (rule) parsed[s] = rule;
        }

        if (this.layers) this.layers.forEach(function(layer) { layer.parse(); });
    },

    zoom: function(z) {
        var style = this.style, layer = this.parsed;
        var zoomed = this.zoomed = {};


        for (var prop in this.parsed) {
            zoomed[prop] = this.parsed[prop].getAppliedValue(z);
        }

        // Some rules influence others
        if (zoomed.opacity && zoomed.color) {
            zoomed.color.alpha(zoomed.opacity);
            zoomed.color = zoomed.color.premultiply();
        }
        if (zoomed.opacity && zoomed.stroke) {
            zoomed.stroke.alpha(zoomed.opacity);
            zoomed.stroke = zoomed.stroke.premultiply();
        }
        if (zoomed.opacity === 0) {
            zoomed.hidden = true;
        }

        if (this.layers) this.layers.forEach(function(layer) { layer.zoom(z); });

        this.z = z;
        this.fire('zoom');
    },

    toJSON: function() {
        return this.data;
    }
};

evented(StyleLayer);
