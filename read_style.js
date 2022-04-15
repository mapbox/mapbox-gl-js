import ParsingError from './error/parsing_error.js';
import jsonlint from '@mapbox/jsonlint-lines-primitives';

export default function readStyle(style) {
    if (style instanceof String || typeof style === 'string' || style instanceof Buffer) {
        try {
            return jsonlint.parse(style.toString());
        } catch (e) {
            throw new ParsingError(e);
        }
    }

    return style;
}
