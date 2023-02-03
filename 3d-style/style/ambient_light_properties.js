// @flow

import {DataConstantProperty} from '../../src/style/properties.js';

import type Color from '../../src/style-spec/util/color.js';

export type LightProps = {|
    "color": DataConstantProperty<Color>,
    "intensity": DataConstantProperty<number>,
|};
