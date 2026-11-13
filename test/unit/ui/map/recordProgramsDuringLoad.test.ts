import {describe, test, expect, waitFor, createMap} from '../../../util/vitest';

function createRecordingMap() {
    return createMap({
        recordProgramsDuringLoad: true,
        zoom: 12,
        style: {version: 8, sources: {}, layers: [{id: 'background', type: 'background', paint: {'background-color': 'red'}}]},
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
});
