var util = require('./util.js');
var assert = llmr.assert;

var LineWidthWidget = require('./linewidthwidget.js');

module.exports = LayerView;
function LayerView(layer_name, bucket_name, style) {
    if (assert) assert.ok(style instanceof llmr.Style, 'style is a Style object');


    var view = this;
    this.layer_name = layer_name;
    this.bucket_name = bucket_name;
    this.style = style;

    var layerClass = this.getLayerStyle();

    var bucket = style.stylesheet.buckets[bucket_name];
    if (assert) assert.ok(typeof bucket === 'object', 'Bucket exists');


    // Store all functionst that are attached to the layer object so that we can
    // remove them to be GCed.
    this.watchers = [];

    this.root = $('<li class="layer">'); //.attr('data-id', layer.id);
    var header = $('<div class="header">').appendTo(this.root);
    this.body = $('<div class="body">').appendTo(this.root);
    var handle = $('<div class="icon handle-icon">');
    var type = $('<div class="tab tab-type"><div class="type">');
    var color = $('<div class="tab tab-color"><div class="color">');
    var name = $('<div class="tab tab-name"><div class="name">');
    var symbol = $('<div class="tab tab-symbol"><div class="sprite-icon symbol">');
    var count = this.count = $('<span class="feature-count">').text(0);
    var hide = $('<div class="icon hide-icon">');
    var remove = $('<div class="icon remove-icon">');

    // if (bucket.type == 'background') {
    //     this.root.addClass('background');
    //     name.find('.name').text('Background');
    //     header.append(type.find('.type'), color, name);
    // } else {
        header.append(handle, type, symbol, color, name, count, remove, hide);
        this.setDisplayName();
    // }

    // style.on('change:sprite', function() {
    //     view.updateImage();
    // });

    function update() {
        var layer = style.computed[layer_name];
        if (assert) assert.ok(typeof bucket === 'object', 'Layer exists');

        view.updateType();
        if (layer.color) view.updateColor();
        if (layer.image) view.updateImage();
    }

    style.on('change', update);
    update();

    if (layerClass.hidden) {
        this.root.addClass('hidden');
    }

    this.root.addClass('type-' + bucket.type);

    // this.addEffects();

    header.click(this.activate.bind(this));
    // remove.click(this.remove.bind(this));
    hide.click(this.hide.bind(this));
}

llmr.evented(LayerView);

LayerView.prototype.setDisplayName = function() {
    'use strict';
    var display_name = this.layer_name + (this.layer_name === this.bucket_name ? '' : '&nbsp;(' + this.bucket_name +')');
    this.root.find('.name').html(display_name);
};

LayerView.prototype.addEffects = function() {
    var view = this;
    this.root.find('.name').hover(function(e) {
        var newLayer = null;
        if (e.type == 'mouseenter') {
            var data = llmr.util.clone(view.layer.data);
            data.color = '#FF0000';
            data.pulsating = 1000;
            data.hidden = false;
            newLayer = new llmr.StyleLayer(data, view.style);
        }

        view.style.highlight(newLayer, null);
    });
};

LayerView.prototype.setCount = function(count) {
    this.count.text(count);
    this.root.toggleClass('empty', count === 0);
};

LayerView.prototype.deactivate = function() {
    this.root.removeClass('active');
    this.root.removeClass('tab-color tab-name tab-type tab-symbol');
    this.fire('deactivate');
    this.tab = null;
    this.body.empty();

    var watcher;
    while (watcher = this.watchers.pop()) {
        this.layer.off(watcher);
    }
};

LayerView.prototype.updateType = function() {
    'use strict';
    var bucket = this.style.stylesheet.buckets[this.bucket_name];
    if (assert) assert.ok(typeof bucket === 'object', 'Bucket exists');
    this.root.find('.type').addClass('icon').addClass(bucket.type + '-icon').attr('title', util.titlecase(bucket.type));
};

LayerView.prototype.updateColor = function() {
    'use strict';
    var layer = this.style.computed[this.layer_name];
    if (assert) assert.ok(typeof layer === 'object', 'Layer exists');

    this.root.find('.color')
        .css('background', layer.color)
        .toggleClass('dark', llmr.chroma(layer.color).luminance() < 0.075);
};

LayerView.prototype.updateImage = function() {
    'use strict';
    var layer = this.style.computed[this.layer_name];
    if (assert) assert.ok(typeof layer === 'object', 'Layer exists');

    var sprite = this.style.sprite;
    if (assert) assert.ok(typeof sprite === 'object', 'Sprite exists');

    if (sprite.loaded && layer.image && sprite.data[layer.image]) {
        this.root.find('.symbol')
            .removeClass(function (i, css) { return (css.match(/\bsprite-icon-\S+\b/g) || []).join(' '); })
            .addClass('sprite-icon-' + layer.image + '-18');
    }
};

LayerView.prototype.activate = function(e) {
    'use strict';
    var bucket = this.style.stylesheet.buckets[this.bucket_name];
    if (assert) assert.ok(typeof bucket === 'object', 'Bucket exists');



    // Find out what tab the user clicked on.
    var tab = null;
    if (typeof e === 'object' && e.toElement) {
        var target = $(e.toElement);
        if (target.is('.color')) { tab = 'color'; }
        else if (target.is('.name') && bucket.type != 'background') { tab = 'name'; }
        else if (target.is('.type') && bucket.type != 'background') { tab = 'type'; }
        else if (target.is('.symbol')) { tab = 'symbol'; }
    } else if (typeof e === 'string') {
        tab = e;
    }

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
        this.root.removeClass('tab-color tab-type tab-symbol tab-name').addClass('tab-' + tab);
    }

    this['activate' + util.titlecase(tab)]();
    this.fire('activate');

    return false;
};

LayerView.prototype.getLayerStyle = function() {
    'use strict';
    var classes = this.style.stylesheet.classes;
    for (var i = 0; i < classes.length; i++) {
        if (classes[i].name === 'default') {
            var layers = classes[i].layers;
            if (layers[this.layer_name]) {
                return layers[this.layer_name]
            } else {
                assert.fail('Default class for this layer class exists');
            }
        }
    }
    assert.fail('Default class exists');
};

LayerView.prototype.activateColor = function() {
    'use strict';
    var style = this.style;
    var layer = this.getLayerStyle();

    var picker = $('<div class="colorpicker"></div>');
    var hsv = llmr.chroma(layer.color).hsv();
    new Color.Picker({
        hue: (hsv[0] || 0),
        sat: hsv[1] * 100,
        val: hsv[2] * 100,
        element: picker[0],
        callback: function(hex) {
            layer.color = '#' + hex;
            style.cascade();
        }
    });
    this.body.append(picker);
};

LayerView.prototype.activateType = function() {
    var view = this;
    var layer = this.layer;
    var bucket = this.bucket;

    var form = $('<form id="edit-geometry-type-form">');
    $('<label><input type="radio" name="edit-geometry-type" value="fill"> Fill</label>').appendTo(form);
    $('<label><input type="radio" name="edit-geometry-type" value="line"> Line</label>').appendTo(form);
    $('<label><input type="radio" name="edit-geometry-type" value="point"> Point</label>').appendTo(form);

    form.find('input[value="' + bucket.type +  '"]').attr('checked', true);
    form.find('input').click(function(ev) {
        if (this.value !== bucket.type) {
            bucket.type = this.value;
            view.style.fire('buckets');
            layer.setType(this.value);
            view.root.removeClass('type-fill type-line type-point').addClass('type-' + this.value);
            view.root.find('.type.icon').removeClass('fill-icon line-icon point-icon').addClass(this.value + '-icon');
        }
    });

    form.appendTo(this.body);
};

LayerView.prototype.activateSymbol = function() {
    'use strict';
    var view = this;
    var style = this.style;
    var layerStyle = this.getLayerStyle();
    var sprite = this.style.sprite;
    var symbols = {};

    var container = $('<div class="icons">').appendTo(view.body);

    // Generate a list of all symbols in the current sprite.
    Object.keys(sprite.data).forEach(function(key) {
        var icon = sprite.data[key];
        var symbol = $('<div>')
            .attr('title', icon.name)
            .addClass('sprite-icon sprite-icon-' + key + '-18')
            .appendTo(container)
            .click(function() {
                $(this).addClass('selected').siblings('.selected').removeClass('selected');
                layerStyle.image = key;
                style.cascade();
            });

        if (key === layerStyle.image) {
            symbol.addClass('selected');
        }
        symbols[key] = symbol;
    });

    // Generate a search form that dims non-matching icons.
    var input = $('<div class="icon-filter"><input type="search" placeholder="Enter Keywords…"></div>').prependTo(view.body).find('input');
    input
        .focus()
        .on('input paste click', function() {
            var text = input.val();
            if (text.length) {
                container.addClass('dim');
                var keys = sprite.search(input.val());
                for (var key in symbols) {
                    symbols[key].toggleClass('highlighted', keys.indexOf(key) >= 0);
                }
            } else {
                container.removeClass('dim');
            }
        });
};

LayerView.prototype.activateName = function() {
    var view = this;

    var sprite = this.style.sprite;
    if (assert) assert.ok(typeof sprite === 'object', 'Sprite exists');

    var bucket = this.style.stylesheet.buckets[this.bucket_name];
    if (assert) assert.ok(typeof bucket === 'object', 'Bucket exists');




    var container = $('<div class="border">').appendTo(this.body);

    // Change the alias
    $('<div><label>Name: <input type="text" placeholder="(optional)"></label></div>')
        .appendTo(container)
        .find('input')
        .val((view.layer_name === view.bucket_name ? '' : view.layer_name) || '')
        .keyup(function() {
            var layer_name = this.value;
            if (layer_name === '') layer_name = view.bucket_name;
            view.layer_name = layer_name;
            // TODO: update name in structure.
            view.setDisplayName();
        });

    // TODO
    // // Antialiasing checkbox
    // if (bucket.type == 'fill') {
    //     $('<div><label><input type="checkbox" name="antialias"> Antialiasing</label></div>')
    //         .appendTo(container)
    //         .find('input')
    //         .attr('checked', this.layer.data.antialias)
    //         .click(function() {
    //             view.layer.setAntialias(this.checked);
    //         });
    // } else if (bucket.type == 'line') {
    //     var stops = layer.data.width.slice(1);
    //     var widget = new LineWidthWidget(stops);
    //     widget.on('stops', function(stops) {
    //         layer.setWidth(['stops'].concat(stops));
    //     });

    //     function updateZoom() {
    //         widget.setPivot(layer.z + 1);
    //     }

    //     layer.on('zoom', updateZoom);
    //     updateZoom();
    //     this.watchers.push(updateZoom);
    //     widget.canvas.appendTo(container);
    // } else if (bucket.type == 'point') {
    //     $('<div><label>Icon size: <input type="range" min="12" step="6" max="24" name="image-size"></label> <span class="image-size"></span></div>')
    //         .appendTo(container)
    //         .find('.image-size').text(layer.data.imageSize || 12).end()
    //         .find('input').attr('value', layer.data.imageSize || 12)
    //         .on('change mouseup', function() {
    //             layer.setImageSize(this.value);
    //             $(this).closest('div').find('.image-size').text(this.value);
    //         });
    //     $('<div><label><input type="checkbox" name="invert"> Invert</label></div>')
    //         .appendTo(container)
    //         .find('input')
    //         .attr('checked', this.layer.data.invert)
    //         .click(function() {
    //             view.layer.setInvert(this.checked);
    //         });
    // }
};

LayerView.prototype.highlightSidebar = function(on) {
    this.root[on ? 'addClass' : 'removeClass']('hover');
};

LayerView.prototype.hide = function() {
    'use strict';
    var layerStyle = this.getLayerStyle();
    layerStyle.hidden = !layerStyle.hidden;
    this.style.cascade();
    this.root.toggleClass('hidden', layerStyle.hidden);
    return false;
};

LayerView.prototype.remove = function() {
    this.root.remove();
    this.layer.fire('remove');
    this.fire('remove');
};
