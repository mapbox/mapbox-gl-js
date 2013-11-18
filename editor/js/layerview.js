function LayerView(layer, bucket, style) {
    var self = this;
    this.layer = layer;
    this.bucket = bucket;
    this.style = style;


    this.root = $('<li class="layer">').attr('data-id', layer.id);
    var header = $('<div class="header">').appendTo(this.root);
    this.body = $('<div class="body">').appendTo(this.root);
    var handle = $('<div class="icon handle-icon">');
    var type = $('<div class="tab tab-type"><div class="type">');
    var color = $('<div class="tab tab-color"><div class="color">');
    var name = $('<div class="tab tab-name"><div class="name">');
    var symbol = $('<div class="tab tab-symbol"><div class="icon symbol">');
    var count = this.count = $('<span class="feature-count">').text(0);
    var hide = $('<div class="icon hide-icon">');
    var remove = $('<div class="icon remove-icon">');

    color.find('.color').css("background", layer.data.color);
    type.find('.type').addClass('icon').addClass(bucket.type + '-icon').attr('title', titlecase(bucket.type));

    if (bucket.type == 'background') {
        this.root.addClass('background');
        name.find('.name').text('Background');
        header.append(type, color, name);
    } else if (bucket.type == 'fill' || bucket.type == 'line') {
        name.find('.name').text(layer.data.bucket + (layer.data.name ? ('/' + layer.data.name) : ''));
        header.append(handle, type, color, name, count, remove, hide);
    } else if (bucket.type == 'point') {
        name.find('.name').text(layer.data.bucket + (layer.data.name ? ('/' + layer.data.name) : ''));
        header.append(handle, type, symbol, name, count, remove, hide);
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
    var layer = this.layer;
    this.root.find('.name').hover(function(e) {
        layer.fire('highlight', [e.type == 'mouseenter']);
    });
};

LayerView.prototype.setCount = function(count) {
    this.count.text(count);
};

LayerView.prototype.deactivate = function() {
    this.root.removeClass('active');
    this.root.removeClass('tab-color tab-name tab-type tab-symbol');
    this.fire('deactivate');
    this.tab = null;
    this.body.empty();
};

LayerView.prototype.activate = function(e) {
    var self = this;

    var tab = null;
    var target = $(e.toElement);
    if (target.is('.color')) { tab = 'color'; }
    else if (target.is('.name')) { tab = 'name'; }
    else if (target.is('.type')) { tab = 'type'; }
    else if (target.is('.symbol')) { tab = 'symbol'; }

    if (tab === this.tab || !tab) {
        if (this.root.is('.active')) {
            this.deactivate();
        }
        return;
    }


    this.tab = tab;
    this.body.empty();
    this.root.addClass('active');
    if (tab) {
        this.root.removeClass('tab-color tab-name tab-type tab-symbol').addClass('tab-' + tab);
    }
    this.fire('activate');

    var bucket = this.bucket;
    var layer = this.layer;

    if (tab === 'color') {
        var picker = $("<div class='colorpicker'></div>");
        var hsv = Color.RGB_HSV(css2rgb(layer.data.color));
        console.warn(hsv);
        new Color.Picker({
            hue: hsv.H,
            sat: hsv.S,
            val: hsv.V,
            element: picker[0],
            callback: function(hex) {
                layer.setColor('#' + hex);
                self.root.find('.color').css('background', layer.data.color);
                self.fire('update');
            }
        });
        this.body.append(picker);
    }
    else if (tab === 'width') {
        var stops = layer.width.slice(1);
        var widget = new LineWidthWidget(stops);
        widget.on('stops', function(stops) {
            layer.setWidth(['stops'].concat(stops));
            self.fire('update');
        });

        // this.app.map.on('zoom', function(e) {
        //     widget.setPivot(self.app.map.transform.z + 1);
        // });

        // widget.setPivot(self.app.map.transform.z + 1);

        widget.canvas.appendTo(this.body[0]);
    }
    else if (tab === 'type') {
        this.body.append($('<div>').text("TODO: select type"));
    }
    else if (tab === 'symbol') {
        var layer = this.layer;
        var sprite = this.style.sprite;
        var position = sprite.position[layer.image];

        this.root.find('.symbol').css({
            backgroundPosition: -position.x + 'px ' + -position.y + 'px',
            backgroundImage: 'url(' + sprite.img.src + ')',
            backgroundSize: sprite.dimensions.x + 'px ' + sprite.dimensions.y + 'px'
        });

        _.each(sprite.position, function(icon, key) {
            var margin = (24 - icon.height) / 2;
            $('<div>')
                .css({
                    width: icon.width + 'px',
                    height: icon.height + 'px',
                    backgroundPosition: -icon.x + 'px ' + -icon.y + 'px',
                    backgroundImage: 'url(' + sprite.img.src + ')',
                    backgroundSize: sprite.dimensions.x + 'px ' + sprite.dimensions.y + 'px',
                    float: 'left',
                    margin: (2 + margin) + 'px 2px'
                })
                .appendTo(self.body)
                .click(function() {
                    layer.image = key;
                    layer.fire('change', ['image']);

                    var position = sprite.position[layer.image];
                    self.root.find('.symbol').css({
                        backgroundPosition: -position.x + 'px ' + -position.y + 'px',
                    });
                });
        });
    }
    else if (tab === 'name') {
        var view = this;
        var input = $('<input type="text" placeholder="Name">');
        input.val(view.layer.data.name || '');
        input.keyup(function() {
            view.layer.setName(input.val());
            view.layer.name = input.val();
            view.root.find('.name').text(view.layer.data.bucket + (view.layer.data.name ? ('/' + view.layer.data.name) : ''));
        });
        this.body.append(input);
        input.wrap('<div class="border"><label> Name: </label></div>');
    }

    return false;
};

llmr.util.evented(LayerView);

LayerView.prototype.hide = function() {
    this.layer.hidden = !this.layer.hidden;
    this.root.toggleClass('hidden', this.layer.hidden);
    this.layer.fire('change', ['hidden']);
    this.fire('update');
    return false;
};

LayerView.prototype.remove = function() {
    this.root.remove();
    this.layer.fire('remove');
    this.fire('remove');
};
