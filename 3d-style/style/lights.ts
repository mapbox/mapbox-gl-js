import {StyleProperties} from '../../src/style/style_properties';

import type {LightsSpecification} from '../../src/style-spec/types';
import type {ConfigOptions, Properties, PropertyValueSpecifications} from '../../src/style/properties';
import type {LightProps as FlatLightProps} from './flat_light_properties';
import type {LightProps as AmbientLightProps} from './ambient_light_properties';
import type {LightProps as DirectionalLightProps} from './directional_light_properties';

type LightProps = FlatLightProps | AmbientLightProps | DirectionalLightProps;

class Lights<P extends LightProps> extends StyleProperties<P> {
    _options: LightsSpecification;

    constructor(options: LightsSpecification, properties: Properties<P>, scope: string, configOptions?: ConfigOptions | null) {
        super(properties, scope, new Map(configOptions));
        this.set(options);
        this._transitionable.snap();
    }

    get(): LightsSpecification {
        this._options.properties = this._transitionable.serialize() as LightsSpecification['properties'];
        return this._options;
    }

    set(options: LightsSpecification, configOptions?: ConfigOptions | null) {
        this._options = options;
        this._setValues(options.properties as PropertyValueSpecifications<P>, configOptions);
    }

    shadowsEnabled(): boolean {
        if (!this.properties) return false;
        return this.properties.get('cast-shadows' as keyof P) === true;
    }
}

export default Lights;
