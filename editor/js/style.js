function Style(style) {
    var self = this;

    this.buckets = style.buckets || {};
    this.layers = [];
    this.background = style.background || '#FFFFFF';
    this.highlightLayer = null;
    this.highlightBucket = null;

    // Initialize layers.
    _.each(style.layers, function(layer) {
        layer.id = layer.bucket + '/' + (layer.name || '');
        self.addLayer(layer);
    });

    this.cleanup();
}

Style.prototype.cleanup = function() {
    // Finds unused buckets and removes them.
    var buckets = _.pluck(this.layers, 'bucket');
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
        buckets['__highlight__'] = this.hightlightBucket;
    }
    return buckets;
};

Style.prototype.setLayerOrder = function(order) {
    this.layers.sort(function(a, b) {
        return order.indexOf(a.id) - order.indexOf(b.id);
    });
    bean.fire(this, 'change');
};

// Style.prototype.save = function() {
//     bean.fire(this, 'change');
// };



Style.prototype.addBucket = function(name, bucket) {
    this.buckets[name] = bucket;
    bean.fire(this, 'buckets');
};

Style.prototype.addLayer = function(layer) {
    var self = this;

    this.layers.push(layer);

    bean.on(layer, 'change', function() { bean.fire(self, 'change'); });
    bean.on(layer, 'remove', function() { self.removeLayer(layer.id); });
    bean.on(layer, 'highlight', function(state) {
        if (state) {
            self.highlightLayer = { bucket: layer.bucket, color: [1, 0, 0, 0.75], antialias: true, width: layer.width, pulsating: 1000 };
        } else {
            self.highlightLayer = null;
        }
        bean.fire(self, 'change');
    });

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
