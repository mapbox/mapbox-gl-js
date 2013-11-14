function DataFilterView(list) {
    var view = this;

    this.list = $(list)[0];
    this.layers = {};

    $(this.list).on('click', 'input', function() {
        bean.fire(view, 'selection');
    });
    $('#add-data-form').on('click', 'input', function() {
        bean.fire(view, 'selection');
    });

    setTimeout(function() {
        bean.fire(view, 'selection');
    });
}

DataFilterView.prototype.getLayer = function($root, layer_name) {
    if (!$root.layers[layer_name]) {
        var el = $('<li class="source-layer"><label><input class="source-layer" type="radio" name="layer" value="' + layer_name + '"> <span class="source-layer-name">' + layer_name + '</span> <span class="feature-count">0</span></label><fieldset><ul></ul></fieldset></li>');
        el.appendTo($root.list);

        $root.layers[layer_name] = {
            name: layer_name,
            list: el.find('> fieldset > ul')[0],
            count: el.find('> label .feature-count')[0],
            radio: el.find('> label input')[0],
            features: {}
        };
    }

    return $root.layers[layer_name];
};

DataFilterView.prototype.getFeature = function($layer, feature_name) {
    if (!$layer.features[feature_name]) {
        var el = $('<li class="feature-name"><label><input class="feature-name" type="radio" name="feature[' + $layer.name + ']" value="' + feature_name + '"> <span class="feature-name">' + feature_name + '</span></label></li>');
        if (feature_name === '(all)') {
            el.find('input.feature-name').attr('checked', true);
        } else {
            el.append('<ul></ul>');
        }
        el.appendTo($layer.list);

        $layer.features[feature_name] = {
            name: feature_name,
            list: el.find('> ul')[0],
            radio: el.find('> label input')[0],
            values: {}
        };
    }

    return $layer.features[feature_name];
};

DataFilterView.prototype.getValue = function($layer, $feature, value_name) {
    if (!$feature.values[value_name]) {
        var el = $('<li class="feature-value"><label><input class="feature-value" type="checkbox" name="value[' + $layer.name + '][' + $feature.name + ']" value="' + value_name + '"> <span class="feature-value">' + (value_name || '(none)') + '</span> <span class="feature-count"></span></label></li>');
        el.appendTo($feature.list);

        $feature.values[value_name] = {
            count: el.find('> label .feature-count')[0],
            checkbox: el.find('> label input')[0]
        };
    }

    return $feature.values[value_name];
};

DataFilterView.prototype.update = function(data) {
    var $updatedLayers = [];
    for (var layer_name in data) {
        var layer = data[layer_name];
        var $layer = this.getLayer(this, layer_name);
        $layer.count.innerText = layer['(all)'];
        $updatedLayers.push($layer);

        for (var feature_name in layer) {
            var feature = layer[feature_name];
            var $feature = this.getFeature($layer, feature_name);

            var $updatedValues = [];
            for (var value_name in feature) {
                var value = feature[value_name];
                var $value = this.getValue($layer, $feature, value_name);
                $value.count.innerText = value;
                $updatedValues.push($value);
            }

            // Set all other values to 0.
            for (var value_name in $feature.values) {
                var $value = $feature.values[value_name];
                if ($updatedValues.indexOf($value) < 0) {
                    $value.count.innerText = '0';
                }
            }
        }
    }

    // Set all other layers to 0.
    for (var layer_name in this.layers) {
        var $layer = this.layers[layer_name];
        if ($updatedLayers.indexOf($layer) < 0) {
            $layer.count.innerText = '0';

            for (var feature_name in $layer.features) {
                var $feature = $layer.features[feature_name];
                for (var value_name in $feature.values) {
                    var $value = $feature.values[value_name];
                    $value.count.innerText = '0';
                }
            }
        }
    }
};

DataFilterView.prototype.on = function() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift(this);
    bean.on.apply(bean, args);
    return this;
};

DataFilterView.prototype.selection = function() {
    for (var layer_name in this.layers) {
        var $layer = this.layers[layer_name];
        if ($layer.radio.checked) {

            for (var feature_name in $layer.features) {
                var $feature = $layer.features[feature_name];
                if ($feature.radio.checked) {
                    var values = [];
                    for (var value_name in $feature.values) {
                        var $value = $feature.values[value_name];
                        if ($value.checkbox.checked) {
                            values.push($value.checkbox.value);
                        }
                    }

                    if (values.length) {
                        return {
                            layer: $layer.name,
                            field: $feature.name,
                            value: values
                        };
                    }
                }
            }

            return {
                layer: $layer.name
            };
        }
    }

    return null;
};
