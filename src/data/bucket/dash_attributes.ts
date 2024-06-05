import {createLayout} from '../../util/struct_array';

import type {StructArrayLayout} from '../../util/struct_array';

const dashAttributes: StructArrayLayout = createLayout([
    {name: 'a_dash', components: 4, type: 'Uint16'} // [x, y, width, unused]
]);

export default dashAttributes;
