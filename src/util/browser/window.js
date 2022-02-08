// @flow
/* eslint-env browser */
import type {Window} from '../../types/window.js';

// shim window for the case of requiring the browser bundle in Node
export default ((typeof self !== 'undefined' ? self : ({}: any)): Window);
