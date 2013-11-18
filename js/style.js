var bean = require('./lib/bean.js');
var _ = require('./lib/lodash.js');
var chroma = require('./lib/chroma.js');

var StyleLayer = require('./stylelayer.js');
var ImageSprite = require('./imagesprite.js');




var fns = Style.fns = {};

fns.linear = function(z_base, val, slope, min, max) {
    z_base = +z_base || 0;
    val = +val || 0;
    slope = +slope || 0;
    min = +min || 0;
    max = +max || Infinity;
    return function(z) {
        return Math.min(Math.max(min, val + (z - z_base) * slope), max);
    };
};


fns.exponential = function(z_base, val, slope, min, max) {
    z_base = +z_base || 0;
    val = +val || 0;
    slope = +slope || 0;
    min = +min || 0;
    max = +max || Infinity;
    return function(z) {
        return Math.min(Math.max(min, val + Math.pow(1.75, (z - z_base)) * slope), max);
    };
};


fns.min = function(min_z) {
    min_z = +min_z || 0;
    return function(z) {
        return z >= min_z;
    };
};

fns.stops = function() {
    var stops = Array.prototype.slice.call(arguments);
    return function(z) {
        z += 1;

        var smaller = null;
        var larger = null;

        for (var i = 0; i < stops.length; i++) {
            var stop = stops[i];
            if (stop.z <= z && (!smaller || smaller.z < stop.z)) smaller = stop;
            if (stop.z >= z && (!larger || larger.z > stop.z)) larger = stop;
        }

        if (smaller && larger) {
            // Exponential interpolation between the values
            if (larger.z == smaller.z) return smaller.val;
            return smaller.val * Math.pow(larger.val / smaller.val, (z - smaller.z) / (larger.z - smaller.z));
        } else if (larger || smaller) {
            // Do not draw a line.
            return null;

            // Exponential extrapolation of the smaller or larger value
            var edge = larger || smaller;
            return Math.pow(2, z) * (edge.val / Math.pow(2, edge.z));
        } else {
            // No stop defined.
            return 1;
        }
    };
};




module.exports = Style;
function Style(data) {
    var style = this;

    if (!data) data = {};
    this.constants = data.constants || {};
    this.buckets = data.buckets || {};
    this.layers = [];
    this.sprite = null;
    this.highlightLayer = null;
    this.highlightBucket = null;


    this.setBackgroundColor(data.background);

    if (data.sprite) {
        this.setSprite(data.sprite);
    }

    // Initialize layers.
    _.each(data.layers || [], function(data) {
        this.addLayer(data);
    }, this);

    this.cleanup();
}

Style.prototype.setSprite = function(sprite) {
    var style = this;
    this.sprite = new ImageSprite(sprite, function() { bean.fire(style, 'change'); });
};

Style.prototype.zoom = function(z) {
    for (var i = 0; i < this.layers.length; i++) {
        this.layers[i].zoom(z);
    }
};

Style.prototype.cleanup = function() {
    // Finds unused buckets and removes them.
    var buckets = _(this.layers).pluck('buckets').flatten().value();
    var unused = _.difference(Object.keys(this.buckets), buckets);
    _.each(unused, function(name) { delete this.buckets[name]; }, this);
    bean.fire(this, 'change');
};

Style.prototype.presentationLayers = function() {
    var layers = _.clone(this.layers);
    if (this.highlightLayer) {
        layers.push(this.highlightLayer);
    }
    return layers;
};

Style.prototype.presentationBuckets = function() {
    var buckets = _.clone(this.buckets);
    if (this.highlightBucket) {
        buckets['__highlight__'] = this.highlightBucket;
    }
    return buckets;
};

Style.prototype.setLayerOrder = function(order) {
    this.layers.sort(function(a, b) {
        return order.indexOf(a.id) - order.indexOf(b.id);
    });
    bean.fire(this, 'change');
};

Style.prototype.addBucket = function(name, bucket) {
    this.buckets[name] = bucket;
    bean.fire(this, 'buckets');
};


Style.prototype.setBackgroundColor = function(color) {
    this.background = this.parseColor(color || '#FFFFFF');
    bean.fire(this, 'change');
};

Style.prototype.addLayer = function(layer) {
    var style = this;

    if (!(layer instanceof StyleLayer)) {
        layer = new StyleLayer(layer, this);
    } else {
        layer.style = this;
    }

    this.layers.push(layer);
    bean.on(layer, 'change', function() {
        bean.fire(style, 'change');
    });
    bean.on(layer, 'remove', function() { style.removeLayer(layer.id); });
    bean.fire(this, 'layer.add', layer);
    bean.fire(this, 'change');
};


Style.prototype.removeLayer = function(id) {
    var style = this;

    // Remove all layers with the id.
    _(this.layers).remove({ id: id }).pluck('bucket').unique().each(function(bucket) {
        // Remove the bucket if it is empty.
        if (_(style.layers).filter({ bucket: bucket }).isEmpty()) {
            delete style.buckets[bucket];
        }
    });

    bean.fire(this, 'change');
};



Style.prototype.parseColor = function(value) {
    if (value in this.constants) {
        value = this.constants[value];
    }

    if (Array.isArray(value)) {
        return chroma(value, 'gl').premultiply();
    } else {
        return chroma(value).premultiply();
    }
};

Style.prototype.parseFunction = function(fn) {
    if (Array.isArray(fn)) {
        if (!fns[fn[0]]) {
            throw new Error('The function "' + fn[0] + '" does not exist');
        }
        return fns[fn[0]].apply(null, fn.slice(1));
    } else {
        return fn;
    }
};

Style.prototype.parseWidth = function(width) {
    width = this.parseFunction(width);
    var value = +width;
    return !isNaN(value) ? value : width;
};

Style.prototype.parseValue = function(value, z) {
    if (typeof value === 'function') {
        return value(z, this.constants);
    } else if (typeof value === 'string' && value in this.constants) {
        return this.constants[value];
    } else {
        return value;
    }
}
