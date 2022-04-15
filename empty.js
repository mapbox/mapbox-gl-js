// @flow
import type {StyleSpecification} from './types.js';

export default function emptyStyle(): StyleSpecification {
    return {
        version: 8,
        layers: [],
        sources: {}
    };
}
