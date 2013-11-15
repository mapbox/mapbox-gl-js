function LayerView(layer, bucket) {
    var self = this;
    this.layer = layer;
    this.bucket = bucket;

    this.root = $('<li class="layer">').attr('data-id', layer.id);
    var header = $('<div class="header">').appendTo(this.root);
    this.body = $('<div class="body">').appendTo(this.root);
    var handle = $('<div class="icon handle-icon">');
    var type = $('<div>').addClass('icon').addClass(bucket.type + '-icon').attr('title', titlecase(bucket.type));
    var color = $('<div class="color">').css("background", layer.color);
    var name = $('<div class="name">');
    var count = this.count = $('<span class="feature-count">').text(0);
    var hide = $('<div class="icon hide-icon">');
    var remove = $('<div class="icon remove-icon">');

    if (bucket.type == 'background') {
        this.root.addClass('background');
        name.text('Background');
        header.append(type, color, name);
    } else if (bucket.type == 'fill' || bucket.type == 'line') {
        name.text(layer.bucket);
        header.append(handle, type, color, name, count, remove, hide);
    } else if (bucket.type == 'point') {
        name.text(layer.bucket);
        header.append(handle, type, name, count, remove, hide);
    }

    if (this.layer.hidden) {
        this.root.addClass('hidden');
    }

    this.addEffects();

    this.root.click(function() { return false; });
    header.click(this.activate.bind(this));
    remove.click(this.remove.bind(this));
    hide.click(this.hide.bind(this));
}

LayerView.prototype.addEffects = function() {
    var self = this;
    this.root.find('.name').hover(function(e) {
        bean.fire(self.layer, 'highlight', [e.type == 'mouseenter']);
    });
};

LayerView.prototype.setCount = function(count) {
    this.count.text(count);
};

LayerView.prototype.deactivate = function() {
    this.root.removeClass('active');
    bean.fire(this, 'deactivate');
    this.body.empty();
};

LayerView.prototype.activate = function() {
    var self = this;

    if (this.root.is('.active')) {
        this.deactivate();
        return;
    }
    this.root.addClass('active');
    bean.fire(this, 'activate');

    var bucket = this.bucket;
    var layer = this.layer;

    if (bucket.type === 'background' || bucket.type === 'fill' || bucket.type === 'line') {
        var picker = $("<div class='colorpicker'></div>");
        var hsv = Color.RGB_HSV(css2rgb(layer.color));
        new Color.Picker({
            hue: hsv.H,
            sat: hsv.S,
            val: hsv.V,
            element: picker[0],
            callback: function(hex) {
                layer.color = '#' + hex;
                bean.fire(layer, 'change', ['color']);
                self.root.find('.color').css('background', layer.color);
                bean.fire(self, 'update');
            }
        });
        this.body.append(picker);
    }

    if (bucket && bucket.type === 'line') {
        var stops = layer.width.slice(1);
        var widget = new LineWidthWidget(stops);
        widget.on('stops', function(stops) {
            layer.width = ['stops'].concat(stops);
            bean.fire(layer, 'change', ['width']);
            bean.fire(self, 'update');
        });

        // this.app.map.on('zoom', function(e) {
        //     widget.setPivot(self.app.map.transform.z + 1);
        // });

        // widget.setPivot(self.app.map.transform.z + 1);

        widget.canvas.appendTo(this.body[0]);
    }

    if (bucket && bucket.type === 'point') {
        // TODO: add list of icons here and change the icon when the user clicks
    }

    return false;
};

LayerView.prototype.hide = function() {
    this.layer.hidden = !this.layer.hidden;
    this.root.toggleClass('hidden', this.layer.hidden);
    bean.fire(this.layer, 'change', ['hidden']);
    bean.fire(this, 'update');
    return false;
};

LayerView.prototype.remove = function() {
    this.root.remove();
    bean.fire(this.layer, 'remove');
    bean.fire(this, 'remove');
};
