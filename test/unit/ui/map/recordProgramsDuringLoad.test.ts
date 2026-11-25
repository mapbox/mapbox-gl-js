import {describe, test, expect, waitFor, createMap} from '../../../util/vitest';
import {mockFetch} from '../../../util/network';

const STYLE = {version: 8, sources: {}, layers: [{id: 'background', type: 'background', paint: {'background-color': 'red'}}]};

function createRecordingMap(style = {}) {
    return createMap({
        recordProgramsDuringLoad: true,
        zoom: 12,
        style: {...STYLE, ...style},
    });
}

describe('Map#_getRecordedProgramsDuringLoad', () => {
    test('returns null without the recordProgramsDuringLoad option', async () => {
        const map = createMap();
        await waitFor(map, 'load');
        expect(map._getRecordedProgramsDuringLoad()).toBeNull();
        map.remove();
    });

    test('returns null before load', () => {
        const map = createRecordingMap();
        expect(map._getRecordedProgramsDuringLoad()).toBeNull();
        map.remove();
    });

    test('returns the zoom after load', async () => {
        const map = createRecordingMap();
        await waitFor(map, 'load');
        expect(map._getRecordedProgramsDuringLoad().zoom).toEqual(12);
        map.remove();
    });

    test('records the program a draw asked for before load', async () => {
        const map = createRecordingMap();
        await waitFor(map, 'load');
        const {loadTime, programs} = map._getRecordedProgramsDuringLoad();
        const background = programs.find(program => program.key.split('/')[0] === 'background');
        expect(background.firstUse).toBeLessThanOrEqual(loadTime);
        map.remove();
    });

    // As in recorded loads, the style arrives from its URL after the first frame.
    test('records when the first frame ended and when the next frame that asked for a new program started', async () => {
        let respond: (response: Response) => void = () => {};
        mockFetch({'/styles/v1/mapbox/streets-v12': () => new Promise<Response>(resolve => { respond = resolve; })});
        const map = createMap({recordProgramsDuringLoad: true, accessToken: 'access-token', zoom: 12, style: 'mapbox://styles/mapbox/streets-v12'});
        map.once('render', () => respond(new Response(JSON.stringify(STYLE))));
        await waitFor(map, 'load');
        const {loadTime, firstFrameEnd, newProgramFrameStart} = map._getRecordedProgramsDuringLoad();
        expect(firstFrameEnd > 0 && newProgramFrameStart > firstFrameEnd && newProgramFrameStart <= loadTime).toBe(true);
        map.remove();
    });

    test('records no frame asking for a new program for a style without layers', async () => {
        const map = createRecordingMap({layers: []});
        await waitFor(map, 'load');
        expect(map._getRecordedProgramsDuringLoad().newProgramFrameStart).toBeNull();
        map.remove();
    });

    test('returns the style\'s zoom', async () => {
        const map = createRecordingMap({zoom: 7});
        await waitFor(map, 'load');
        expect(map._getRecordedProgramsDuringLoad().styleZoom).toEqual(7);
        map.remove();
    });

    test('returns zoom 0 for a style without one', async () => {
        const map = createRecordingMap();
        await waitFor(map, 'load');
        expect(map._getRecordedProgramsDuringLoad().styleZoom).toEqual(0);
        map.remove();
    });
});
