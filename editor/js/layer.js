function Layer(layer, bucket, app) {
    var self = this;
    this.layer = layer;
    this.bucket = bucket;
    this.app = app;

    this.root = $('<li class="layer">').data('layer', this);
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
    } else {
        name.text(layer.bucket);
        header.append(handle, type, color, name, count, remove, hide);
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

Layer.prototype.addEffects = function() {
    var self = this;
    this.root.find('.name')
        .mouseenter(function() {
            self.highlight = true;
            $(self).trigger('update');
        })
        .mouseleave(function() {
            self.highlight = false;
            $(self).trigger('update');
        });
};

Layer.prototype.setCount = function(count) {
    this.count.text(count);
};

Layer.prototype.deactivate = function() {
    this.root.removeClass('active');
    this.body.empty();
};

Layer.prototype.activate = function() {
    var self = this;

    if (this.root.is('.active')) {
        this.deactivate();
        return;
    }
    this.root.addClass('active');

    var bucket = this.bucket;
    var layer = this.layer;

    // disable all other layers
    this.root.siblings('.layer.active').each(function(i, item) {
        $(item).data('layer').deactivate();
    });


    var picker = $("<div class='colorpicker'></div>");
    var hsv = Color.RGB_HSV(css2rgb(layer.color));
    new Color.Picker({
        hue: hsv.H,
        sat: hsv.S,
        val: hsv.V,
        element: picker[0],
        callback: function(hex) {
            layer.color = '#' + hex;
            self.root.find('.color').css('background', layer.color);
            $(self).trigger('update');
        }
    });
    this.body.append(picker);

    if (bucket && bucket.type === 'line') {
        var stops = layer.width.slice(1);
        var widget = new LineWidthWidget(stops);
        widget.on('stops', function(stops) {
            layer.width = ['stops'].concat(stops);
            $(self).trigger('update');
        });

        this.app.map.on('zoom', function(e) {
            widget.setPivot(self.app.map.transform.z + 1);
        });

        widget.setPivot(self.app.map.transform.z + 1);

        widget.canvas.appendTo(this.body[0]);
    }


    return false;
};

Layer.prototype.hide = function() {
    this.layer.hidden = !this.layer.hidden;
    this.root.toggleClass('hidden', this.layer.hidden);
    $(this).trigger('update');
    return false;
};

Layer.prototype.remove = function() {
    this.root.remove();
    $(this).trigger('remove');
};
