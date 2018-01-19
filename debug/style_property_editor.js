const convertFunction = require('../src/style-spec/function/convert');
const {isFunction} = require('../src/style-spec/function');
const util = require('../src/util/util');
const spec = require('../src/style-spec/reference/v8.json');
const stringify = require('json-stringify-pretty-compact');

class StylePropertyEditor extends React.Component {
    constructor(props) {
        super(props);

        this.onLayerChange = this.onLayerChange.bind(this);
        this.onPropertyChange = this.onPropertyChange.bind(this);
        this.onEdit = this.onEdit.bind(this);
        this.updateMap = this.updateMap.bind(this);

        this.map = props.map;

        const layers = this.map.getStyle().layers;
        const layer = this.props.layer;
        const property = this.props.property;
        this.state = {
            layers,
            layer,
            property,
            propertySpec: null,
            propertyValue: ''
        };

        if (layer && property) {
            const l = layers.find(({id}) => id === layer);
            util.extend(this.state, getPropertyValueAndSpec(l, property));
        }
    }

    render() {
        const properties = [];
        if (this.state.layer) {
            const layer = this.state.layers.find(layer => layer.id === this.state.layer);
            for (const p in layer.paint) {
                properties.push(`paint.${p}`);
            }
            for (const p in layer.layout) {
                properties.push(`layout.${p}`);
            }
        }

        let converted = '';
        if (this.state.propertySpec && this.state.propertyValue) {
            try {
                const input = JSON.parse(this.state.propertyValue);

                if (!isFunction(input)) {
                    converted = input;
                } else {
                    converted = convertFunction(input, this.state.propertySpec);
                }
                converted = <pre>{stringify(converted, null, 2)}</pre>;
            } catch (e) {
                converted = e.message;
            }
        }

        return (
            <div>
                <div className="select">
                    <select value={this.state.layer} onChange={this.onLayerChange}>
                        {[<option key="null" value="">Choose Layer</option>]
                            .concat(this.state.layers.map(layer =>
                                <option key={layer.id} value={layer.id}>{layer.id}</option>
                            ))
                        }
                    </select>
                    <select value={this.state.property} onChange={this.onPropertyChange} disabled={properties.length === 0}>
                        {[<option key="null" value="">Choose Property</option>]
                            .concat(properties.map(p =>
                                <option key={p} value={p}>{p}</option>
                            ))
                        }
                    </select>
                    <button onClick={this.updateMap}>Update Map</button>
                </div>
                {this.state.property ?
                    <strong>
                        <code>{this.state.layer} / {this.state.property}</code> value
                    </strong> :
                    ''
                }
                <div className="edit">
                    <textarea rows={30} cols={80} style={{height: 300}}
                        value={this.state.propertyValue}
                        onChange={this.onEdit}
                        disabled={!this.state.propertyValue}
                    />
                </div>
                <strong>Converted Expression:</strong>
                <div className="preview">
                    {converted}
                </div>
            </div>
        );
    }

    onLayerChange(event) {
        const layer = event.target.value;
        return this.setState(util.extend({}, this.state, {
            layer,
            property: '',
            propertyValue: '',
            propertySpec: null
        }));
    }

    onPropertyChange(event) {
        const property = event.target.value;
        const layer = this.state.layers.find(layer => layer.id === this.state.layer);
        return this.setState(util.extend({}, this.state,
            { property },
            getPropertyValueAndSpec(layer, property)
        ));
    }

    onEdit(event) {
        const newValue = event.target.value;

        try {
            const parsed = JSON.parse(newValue);

            const [type, key] = this.state.property.split('.');
            const layers = this.state.layers;
            const i = layers.findIndex(l => l.id === this.state.layer);
            const newLayer = util.extend({}, layers[i], {
                [type]: util.extend({}, layers[i][type], {[key]: parsed})
            });
            const newLayers = layers.slice(0, i)
                .concat(newLayer)
                .concat(layers.slice(i + 1));
            return this.setState(util.extend({}, this.state, {
                layers: newLayers,
                propertyValue: newValue
            }));
        } catch (e) {
            return this.setState(util.extend({}, this.state, {
                propertyValue: newValue
            }));
        }
    }

    updateMap() {
        const style = util.extend({}, this.map.getStyle(), {
            layers: this.state.layers
        });
        this.map.setStyle(style);
    }
}

function getPropertyValueAndSpec (layer, property) {
    const [type, key] = property.split('.');
    const propertyValue = JSON.stringify(layer[type][key], null, 2);
    const propertySpec = spec[`${type}_${layer.type}`][key];
    return {propertyValue, propertySpec};
}

module.exports = StylePropertyEditor;
