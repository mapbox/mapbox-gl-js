// @ts-nocheck

import ParsingError from './error/parsing_error';
import jsonlint from '@mapbox/jsonlint-lines-primitives';

export default function readStyle(style) {
    if (style instanceof String || typeof style === 'string' || ArrayBuffer.isView(style)) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            return jsonlint.parse(style.toString());
        } catch (e: any) {
            throw new ParsingError(e);
        }
    }

    return style;
}
