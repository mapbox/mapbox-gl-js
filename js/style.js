var evented = require('./evented.js');
var chroma = require('./lib/chroma.js');

var util = require('./util.js');
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
evented(Style);
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

    (data.layers || []).forEach(function(data) {
        this.addLayer(data);
    }, this);

    this.cleanup();
}


Style.prototype.setSprite = function(sprite) {
    var style = this;
    this.sprite = new ImageSprite(sprite);
    this.sprite.on('loaded', function() {
        style.fire('change');
        style.fire('change:sprite');
    });
};

Style.prototype.zoom = function(z) {
    for (var i = 0; i < this.layers.length; i++) {
        this.layers[i].zoom(z);
    }
    if (this.highlightLayer) {
        this.highlightLayer.zoom(z);
    }
};

Style.prototype.cleanup = function() {
    // Finds unused buckets and removes them.
    var buckets = [];
    this.layers.forEach(function(layer) {
        buckets.push.apply(buckets, layer.buckets);
    });

    var unused = util.difference(Object.keys(this.buckets), buckets);
    unused.forEach(function(name) { delete this.buckets[name]; }, this);
    this.fire('change');
};

Style.prototype.presentationLayers = function() {
    var layers = this.layers.slice();
    if (this.highlightLayer) {
        layers.push(this.highlightLayer);
    }
    return layers;
};

Style.prototype.presentationBuckets = function() {
    var buckets = {};
    for (var key in this.buckets) {
        buckets[key] = this.buckets[key];
    }

    if (this.highlightBucket) {
        buckets['__highlight__'] = this.highlightBucket;
    }
    return buckets;
};

Style.prototype.setLayerOrder = function(order) {
    this.layers.sort(function(a, b) {
        return order.indexOf(a.id) - order.indexOf(b.id);
    });
    this.fire('change');
};

Style.prototype.addBucket = function(name, bucket) {
    this.buckets[name] = bucket;
    this.fire('buckets');
    return this.buckets[name];
};


Style.prototype.setBackgroundColor = function(color) {
    this.background = this.parseColor(color || '#FFFFFF');
    this.fire('change');
};

Style.prototype.addLayer = function(layer) {
    var style = this;

    if (!(layer instanceof StyleLayer)) {
        layer = new StyleLayer(layer, this);
    } else {
        layer.style = this;
    }

    this.layers.push(layer);
    layer.on('change', function() { style.fire('change'); });
    layer.on('remove', function() { style.removeLayer(layer.id); });
    layer.on('highlight', function(state) {
        var newLayer = null, newBucket = null;
        if (state) {
            var data = {
                bucket: layer.data.bucket,
                color: '#FF0000',
                pulsating: 1000,
                width: layer.data.width,
                antialias: layer.data.antialias
            };
            newLayer = new StyleLayer(data, style);
        }

        if (newBucket !== style.highlightBucket) {
            style.highlightBucket = newBucket;
            style.fire('buckets');
        }
        if (newLayer !== style.highlightLayer) {
            style.highlightLayer = newLayer;
            style.fire('change');
        }
    });

    this.fire('layer.add', layer);
    this.fire('change');

    return layer;
};


Style.prototype.removeLayer = function(id) {
    var style = this;

    var buckets = [];
    for (var i = 0; i < this.layers.length; i++) {
        if (this.layers[i].id == id) {
            buckets.push.apply(buckets, this.layers[i].buckets);
            this.layers.splice(i--, 1);
        }
    }

    var removedBuckets = 0;
    util.unique(buckets).forEach(function(bucket) {
        // Remove the bucket if it is empty.
        if (style.layers.filter(function(layer) { return layer.bucket == bucket; }).length == 0) {
            delete style.buckets[bucket];
            removedBuckets++;
        }
    });

    this.fire('change');
    if (removedBuckets) {
        this.fire('buckets');
    }
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
