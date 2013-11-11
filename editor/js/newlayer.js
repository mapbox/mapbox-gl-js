function NewLayer(layer, bucket, app) {
    Layer.apply(this, arguments);
    this.highlight = true;
}

NewLayer.prototype = Object.create(Layer.prototype);

NewLayer.prototype.addEffects = function() {};

NewLayer.prototype.activate = function() {
    var self = this;
    if (this.root.is('.active')) {
        return;
    }

    this.root.addClass('active');

    var bucket = this.bucket;
    var layer = this.layer;
    var bucket_select;
    self.body.append($('<label>Data: </label>').append(bucket_select = $('<select>')));
    for (var name in this.app.map.style.buckets) {
        bucket_select.append($('<option>').attr('value', name).text(name));
    }

    bucket_select.change(function() {
        layer.bucket = bucket_select.val();
        $(self).trigger('update');
    }).change();

    self.body.append($('<div class="icon add-icon">').click(function() {
        var layer = {
            bucket: bucket = bucket_select.val(),
            color: '#FF0000'
        };

        var bucket = self.app.map.style.buckets[layer.bucket];
        switch (bucket.type) {
            case 'fill': layer.antialias = true; break;
            case 'line': layer.width = ["stops"]; break;
        }

        var item = self.app.createLayer(layer, bucket);
        self.root.after(item.root);
        self.remove();
        item.activate();
        return false;
    }));
};
