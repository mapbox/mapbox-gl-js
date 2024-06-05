import type {StyleSpecification} from './types';

export default function emptyStyle(): StyleSpecification {
    return {
        version: 8,
        layers: [],
        sources: {}
    };
}
