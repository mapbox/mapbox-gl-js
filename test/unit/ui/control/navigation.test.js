import {test} from '../../../util/test';
import window from '../../../../src/util/window';
import {createMap} from '../../../util';
import NavigationControl from '../../../../src/ui/control/navigation_control';

test('NavigationControl with no options', (t) => {
    const map = createMap(t);
    t.plan(0);

    const navigation = new NavigationControl();
    map.addControl(navigation);
    t.end();
});

test('NavigationControl keyboard event on compass', (t) => {
    t.plan(4);

    const map = createMap(t, {bearing: 45, pitch: 20});
    const navigation = new NavigationControl();
    map.addControl(navigation);

    const left = new window.KeyboardEvent('keydown', {code: 'ArrowLeft'});
    const right = new window.KeyboardEvent('keydown', {code: 'ArrowRight'});
    const up = new window.KeyboardEvent('keydown', {code: 'ArrowUp'});
    const down = new window.KeyboardEvent('keydown', {code: 'ArrowDown'});

    const originalBearing = map.getBearing();
    const originalPitch = map.getPitch();

    navigation._compass.dispatchEvent(left);
    map.once('moveend', () => {
        t.ok(map.getBearing() < originalBearing, 'left key rotated anti-clockwise');

        navigation._compass.dispatchEvent(right);
        navigation._compass.dispatchEvent(right);
        map.once('moveend', () => {
            t.ok(map.getBearing() > originalBearing, 'right key rotated clockwise');

            navigation._compass.dispatchEvent(up);
            map.once('moveend', () => {
                t.ok(map.getPitch() < originalPitch, 'up key pitched less');

                navigation._compass.dispatchEvent(down);
                navigation._compass.dispatchEvent(down);
                map.once('moveend', () => {
                    t.ok(map.getPitch() > originalPitch, 'down key pitched more');

                    t.end();
                });
            });
        });
    });
});
