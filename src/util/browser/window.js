// @flow
/* eslint-env browser */
import type {Window} from '../../types/window';

const win: ?Window = typeof self !== 'undefined' ? self : undefined;

export default win;
