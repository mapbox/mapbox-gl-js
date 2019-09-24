import ParsingError from './error/parsing_error';
import jsonlint from '@mapbox/jsonlint-lines-primitives';

export default function readStyle(style) {
    let s = style;
    if (s instanceof String || typeof s === 'string' || s instanceof Buffer) {
        try {
            s = jsonlint.parse(s.toString());
        } catch (e) {
            throw new ParsingError(e);
        }
    }

    return s;
}
