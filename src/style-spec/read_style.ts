import ParsingError from './error/parsing_error';
import jsonlint from '@mapbox/jsonlint-lines-primitives';

import type {StyleSpecification} from './types';

export default function readStyle(style: string | Buffer | StyleSpecification): StyleSpecification {
    if (style instanceof String || typeof style === 'string' || ArrayBuffer.isView(style)) {
        try {
            return (jsonlint as {parse: (input: string) => StyleSpecification}).parse(style.toString());
        } catch (e) {
            throw new ParsingError(e as Error);
        }
    }

    return style;
}
