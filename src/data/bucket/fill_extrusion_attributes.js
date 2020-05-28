// @flow
import {createLayout} from '../../util/struct_array';

const layout = createLayout([
    {name: 'a_pos_normal_ed', components: 4, type: 'Int16'}
]);

export default layout;
export const {members, size, alignment} = layout;
