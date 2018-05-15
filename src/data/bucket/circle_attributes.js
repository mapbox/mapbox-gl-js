// @flow
import { createLayout } from '../../util/struct_array';

const layout = createLayout([
    {name: 'a_pos', components: 3, type: 'Int16'}
], 4);

// TODO change heatmap bucket to reflect 3 components, or don't reuse circle there to save space

export default layout;
export const {members, size, alignment} = layout;
