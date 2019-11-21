// @flow
import {extend} from './util';

/**
 * This is a private namespace for utility functions that will get automatically stripped
 * out in production builds.
 */
export const Debug = {
    extend(dest: Object, ...sources: Array<?Object>): Object {
        return extend(dest, ...sources);
    }
};
