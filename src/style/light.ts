import styleSpec from '../style-spec/reference/latest';
import {validateLight} from './validate_style';
import {Properties, DataConstantProperty, PositionProperty} from './properties';
import {StyleProperties} from './style_properties';

import type Color from '../style-spec/util/color';
import type {StyleSetterOptions} from '../style/style';
import type {LightSpecification} from '../style-spec/types';
import type {StylePropertySpecification} from '../style-spec/style-spec';

type Props = {
    ["anchor"]: DataConstantProperty<'map' | 'viewport'>;
    ["position"]: PositionProperty;
    ["color"]: DataConstantProperty<Color>;
    ["intensity"]: DataConstantProperty<number>;
};

const lightReference = styleSpec.light as Record<string, StylePropertySpecification>;

let properties: Properties<Props>;
const getProperties = (): Properties<Props> => properties || (properties = new Properties({
    "anchor": new DataConstantProperty(lightReference.anchor),
    "position": new PositionProperty(lightReference.position),
    "color": new DataConstantProperty(lightReference.color),
    "intensity": new DataConstantProperty(lightReference.intensity),
}));

/*
 * Represents the light used to light extruded features.
 * Note that these lights are part of the legacy light API.
 */
class Light extends StyleProperties<Props> {
    id!: string;

    constructor(lightOptions?: LightSpecification, id: string = "flat") {
        super(getProperties());
        this.setLight(lightOptions, id);
        this._transitionable.snap();
    }

    getLight(): LightSpecification {
        return this._transitionable.serialize();
    }

    setLight(light: LightSpecification | null | undefined, id: string, options: StyleSetterOptions = {}) {
        if (this._validate(validateLight, light, options)) {
            return;
        }
        this._setValues(light);
        this.id = id;
    }
}

export default Light;
