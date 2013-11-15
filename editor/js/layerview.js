function LayerView(layer, bucket) {
    var self = this;
    this.layer = layer;
    this.bucket = bucket;

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

    color.find('.color').css("background", layer.color);
    type.find('.type').addClass('icon').addClass(bucket.type + '-icon').attr('title', titlecase(bucket.type));

    if (bucket.type == 'background') {
        this.root.addClass('background');
        name.find('.name').text('Background');
        header.append(type, color, name);
    } else if (bucket.type == 'fill' || bucket.type == 'line') {
        name.find('.name').text(layer.bucket + (layer.name ? ('/' + layer.name) : ''));
        header.append(handle, type, color, name, count, remove, hide);
    } else if (bucket.type == 'point') {
        name.find('.name').text(layer.bucket + (layer.name ? ('/' + layer.name) : ''));
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
    this.root.removeClass('tab-color tab-name tab-type tab-symbol');
    bean.fire(this, 'deactivate');
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
    bean.fire(this, 'activate');

    var bucket = this.bucket;
    var layer = this.layer;

    if (tab === 'color') {
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
    else if (tab === 'width') {
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
    else if (tab === 'type') {
        this.body.append($('<div>').text("TODO: select type"));
    }
    else if (tab === 'symbol') {
        // TODO: add list of icons here and change the icon when the user clicks
        this.body.append($('<div>').text("TODO: select icon"));
    }
    else if (tab === 'name') {
        var view = this;
        var input = $('<input type="text" placeholder="Name">');
        input.val(view.layer.name || '');
        input.keyup(function() {
            view.layer.name = input.val();
            view.root.find('.name').text(view.layer.bucket + (view.layer.name ? ('/' + view.layer.name) : ''));
        });
        this.body.append(input);
        input.wrap('<div class="border"><label> Name: </label></div>');
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
