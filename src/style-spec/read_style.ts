import ParsingError from './error/parsing_error';
import jsonlint from '@mapbox/jsonlint-lines-primitives';

import type {StyleSpecification} from './types';

export default function readStyle(style: string | Buffer | StyleSpecification): StyleSpecification {
    if (style instanceof String || typeof style === 'string' || ArrayBuffer.isView(style)) {
        try {
            return (jsonlint as {parse: (input: string) => StyleSpecification}).parse(style.toString());
        } catch (e) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            throw new ParsingError(e);
        }
    }

    return style;
}
