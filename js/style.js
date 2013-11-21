var evented = require('./evented.js');
var chroma = require('./lib/chroma.js');

var util = require('./util.js');
var StyleLayer = require('./stylelayer.js');
var StyleRule = require('./stylerule.js');
var ImageSprite = require('./imagesprite.js');

module.exports = Style;

evented(Style);

function Style(data) {
    var style = this;

    if (!data) data = {};
    this.constants = data.constants || {};
    this.buckets = data.buckets || {};
    this.layers = [];
    this.sprite = null;
    this.temporaryLayers = [];
    this.temporaryBuckets = {};

    this.highlightLayer = null;


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
    var i;
    for (i = 0; i < this.layers.length; i++) {
        this.layers[i].zoom(z);
    }
    for (i = 0; i < this.temporaryLayers.length; i++) {
        this.temporaryLayers[i].zoom(z);
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
    return this.layers.concat(this.temporaryLayers);
};

Style.prototype.presentationBuckets = function() {
    var buckets = {};
    var key;
    for (key in this.buckets) {
        buckets[key] = this.buckets[key];
    }

    for (key in this.temporaryBuckets) {
        if (this.temporaryBuckets[key]) {
            buckets[key] = this.temporaryBuckets[key];
        }
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
    this.background = StyleRule.prototype.parsers.color(color || '#FFFFFF', this.constants);
    this.fire('change');
};

Style.prototype.addLayer = function(layer) {
    var style = this;

    if (!(layer instanceof StyleLayer)) {
        layer = new StyleLayer(layer, this, this.constants);
    } else {
        layer.style = this;
    }

    this.layers.push(layer);
    layer.on('change', function() { style.fire('change'); });
    layer.on('remove', function() { style.removeLayer(layer.id); });
    this.fire('layer.add', layer);
    this.fire('change');

    return layer;
};

Style.prototype.highlight = function(newLayer, newBucket) {
    var style = this;
    if ((newBucket || null) !== style.temporaryBuckets.__highlight__) {
        style.temporaryBuckets.__highlight__ = newBucket;
        style.fire('buckets');
    }

    if ((newLayer || null) !== style.highlightLayer) {
        // Remove the old layer from the list of temporary layers
        var index = style.temporaryLayers.indexOf(style.highlightLayer);
        if (index >= 0) style.temporaryLayers.splice(index, 1);

        // Add the new layer (if it's not null)
        style.highlightLayer = newLayer;
        if (newLayer) {
            style.temporaryLayers.push(newLayer);
        }
        style.fire('change');
    }
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
        if (style.layers.filter(function(layer) { return layer.bucket == bucket; }).length === 0) {
            delete style.buckets[bucket];
            removedBuckets++;
        }
    });

    this.fire('change');
    if (removedBuckets) {
        this.fire('buckets');
    }
};
