// @flow

import {DataConstantProperty} from '../../src/style/properties.js';

import type Color from '../../src/style-spec/util/color.js';

export type LightProps = {|
    "direction": DataConstantProperty<[number, number]>,
    "color": DataConstantProperty<Color>,
    "intensity": DataConstantProperty<number>,
    "cast-shadows": DataConstantProperty<boolean>,
    "shadow-intensity": DataConstantProperty<number>,
|};
