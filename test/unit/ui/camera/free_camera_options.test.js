import {vec3, quat} from 'gl-matrix';

import {createCamera} from './utils.js';
import {describe, test, expect} from '../../../util/vitest.js';
import {FreeCameraOptions} from '../../../../src/ui/free_camera.js';
import {fixedNum, fixedVec3} from '../../../util/fixed.js';
import MercatorCoordinate from '../../../../src/geo/mercator_coordinate.js';
import LngLat from '../../../../src/geo/lng_lat.js';

describe('camera', () => {
    describe('FreeCameraOptions', () => {
        const camera = createCamera();

        const rotatedFrame = (quaternion) => {
            return {
                up: vec3.transformQuat([], [0, -1, 0], quaternion),
                forward: vec3.transformQuat([], [0, 0, -1], quaternion),
                right: vec3.transformQuat([], [1, 0, 0], quaternion)
            };
        };

        describe('lookAtPoint', () => {
            const options = new FreeCameraOptions();
            const cosPi4 = fixedNum(1.0 / Math.sqrt(2.0));
            let frame = null;

            test('Pitch: 45, bearing: 0', () => {
                options.position = new MercatorCoordinate(0.5, 0.5, 0.5);
                options.lookAtPoint(new LngLat(0.0, 85.051128779806604));
                expect(options.orientation).toBeTruthy();
                frame = rotatedFrame(options.orientation);

                expect(fixedVec3(frame.right)).toEqual([1, 0, 0]);
                expect(fixedVec3(frame.up)).toEqual([0, -cosPi4, cosPi4]);
                expect(fixedVec3(frame.forward)).toEqual([0, -cosPi4, -cosPi4]);
            });

            test('Look directly to east', () => {
                options.position = new MercatorCoordinate(0.5, 0.5, 0.0);
                options.lookAtPoint(new LngLat(30, 0));
                expect(options.orientation).toBeTruthy();
                frame = rotatedFrame(options.orientation);

                expect(fixedVec3(frame.right)).toEqual([+0, 1, +0]);
                expect(fixedVec3(frame.up)).toEqual([0, 0, 1]);
                expect(fixedVec3(frame.forward)).toEqual([1, -0, -0]);
            });

            test('Pitch: 0, bearing: 0', () => {
                options.position = MercatorCoordinate.fromLngLat(new LngLat(24.9384, 60.1699), 100.0);
                options.lookAtPoint(new LngLat(24.9384, 60.1699), [0.0, -1.0, 0.0]);
                expect(options.orientation).toBeTruthy();
                frame = rotatedFrame(options.orientation);

                expect(fixedVec3(frame.right)).toEqual([1.0, 0.0, 0.0]);
                expect(fixedVec3(frame.up)).toEqual([0.0, -1.0, 0.0]);
                expect(fixedVec3(frame.forward)).toEqual([0.0, 0.0, -1.0]);
            });

            test('Pitch: 0, bearing: 45', () => {
                options.position = MercatorCoordinate.fromLngLat(new LngLat(24.9384, 60.1699), 100.0);
                options.lookAtPoint(new LngLat(24.9384, 60.1699), [-1.0, -1.0, 0.0]);
                expect(options.orientation).toBeTruthy();
                frame = rotatedFrame(options.orientation);

                expect(fixedVec3(frame.right)).toEqual([cosPi4, -cosPi4, 0.0]);
                expect(fixedVec3(frame.up)).toEqual([-cosPi4, -cosPi4, 0.0]);
                expect(fixedVec3(frame.forward)).toEqual([0.0, 0.0, -1.0]);
            });

            test('Looking south, up vector almost same as forward vector', () => {
                options.position = MercatorCoordinate.fromLngLat(new LngLat(122.4194, 37.7749));
                options.lookAtPoint(new LngLat(122.4194, 37.5), [0.0, 1.0, 0.00001]);
                expect(options.orientation).toBeTruthy();
                frame = rotatedFrame(options.orientation);

                expect(fixedVec3(frame.right)).toEqual([-1.0, 0.0, 0.0]);
                expect(fixedVec3(frame.up)).toEqual([0.0, 0.0, 1.0]);
                expect(fixedVec3(frame.forward)).toEqual([+0.0, 1.0, -0.0]);
            });

            test('Orientation with roll-component', () => {
                options.position = MercatorCoordinate.fromLngLat(new LngLat(151.2093, -33.8688));
                options.lookAtPoint(new LngLat(160.0, -33.8688), [0.0, -1.0, 0.1]);
                expect(options.orientation).toBeTruthy();
                frame = rotatedFrame(options.orientation);

                expect(fixedVec3(frame.right)).toEqual([0.0, 1.0, 0.0]);
                expect(fixedVec3(frame.up)).toEqual([0.0, 0.0, 1.0]);
                expect(fixedVec3(frame.forward)).toEqual([1.0, -0.0, -0.0]);
            });

            test('Up vector pointing downwards', () => {
                options.position = new MercatorCoordinate(0.5, 0.5, 0.5);
                options.lookAtPoint(new LngLat(0.0, 85.051128779806604), [0.0, 0.0, -0.5]);
                expect(options.orientation).toBeTruthy();
                frame = rotatedFrame(options.orientation);

                expect(fixedVec3(frame.right)).toEqual([1.0, 0.0, 0.0]);
                expect(fixedVec3(frame.up)).toEqual([0.0, -cosPi4, cosPi4]);
                expect(fixedVec3(frame.forward)).toEqual([0.0, -cosPi4, -cosPi4]);
            });

            test('invalid input', () => {
                const options = new FreeCameraOptions();

                // Position not set
                options.orientation = [0, 0, 0, 0];
                options.lookAtPoint(new LngLat(0, 0));
                expect(options.orientation).toBeFalsy();

                // Target same as position
                options.orientation = [0, 0, 0, 0];
                options.position = new MercatorCoordinate(0.5, 0.5, 0.0);
                options.lookAtPoint(new LngLat(0, 0));
                expect(options.orientation).toBeFalsy();

                // Camera looking directly down without an explicit up vector
                options.orientation = [0, 0, 0, 0];
                options.position = new MercatorCoordinate(0.5, 0.5, 0.5);
                options.lookAtPoint(new LngLat(0, 0));
                expect(options.orientation).toBeFalsy();

                // Zero length up vector
                options.orientation = [0, 0, 0, 0];
                options.lookAtPoint(new LngLat(0, 0), [0, 0, 0]);
                expect(options.orientation).toBeFalsy();

                // Up vector same as direction
                options.orientation = [0, 0, 0, 0];
                options.lookAtPoint(new LngLat(0, 0), [0, 0, -1]);
                expect(options.orientation).toBeFalsy();
            });
        });

        test('setPitchBearing', () => {
            const options = new FreeCameraOptions();
            const cos60 = fixedNum(Math.cos(60 * Math.PI / 180.0));
            const sin60 = fixedNum(Math.sin(60 * Math.PI / 180.0));
            let frame = null;

            options.setPitchBearing(0, 0);
            expect(options.orientation).toBeTruthy();
            frame = rotatedFrame(options.orientation);
            expect(fixedVec3(frame.right)).toEqual([1, 0, 0]);
            expect(fixedVec3(frame.up)).toEqual([0, -1, 0]);
            expect(fixedVec3(frame.forward)).toEqual([0, 0, -1]);

            options.setPitchBearing(0, 180);
            expect(options.orientation).toBeTruthy();
            frame = rotatedFrame(options.orientation);
            expect(fixedVec3(frame.right)).toEqual([-1, 0, 0]);
            expect(fixedVec3(frame.up)).toEqual([0, 1, 0]);
            expect(fixedVec3(frame.forward)).toEqual([0, 0, -1]);

            options.setPitchBearing(60, 0);
            expect(options.orientation).toBeTruthy();
            frame = rotatedFrame(options.orientation);
            expect(fixedVec3(frame.right)).toEqual([1, 0, 0]);
            expect(fixedVec3(frame.up)).toEqual([0, -cos60, sin60]);
            expect(fixedVec3(frame.forward)).toEqual([0, -sin60, -cos60]);

            options.setPitchBearing(60, -450);
            expect(options.orientation).toBeTruthy();
            frame = rotatedFrame(options.orientation);
            expect(fixedVec3(frame.right)).toEqual([+0, -1, -0]);
            expect(fixedVec3(frame.up)).toEqual([-cos60, 0, sin60]);
            expect(fixedVec3(frame.forward)).toEqual([-sin60, -0, -cos60]);
        });

        test('emits move events', async () => {
            let started, moved, ended;
            const eventData = {data: 'ok'};

            camera
                .on('movestart', (d) => { started = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => { ended = d.data; });

            const options = camera.getFreeCameraOptions();
            options.position.x = 0.2;
            options.position.y = 0.2;
            camera.setFreeCameraOptions(options, eventData);

            expect(started).toEqual('ok');
            expect(moved).toEqual('ok');
            expect(ended).toEqual('ok');
        });

        test('changing orientation emits bearing events', async () => {
            let rotatestarted, rotated, rotateended, pitch;
            const eventData = {data: 'ok'};

            camera
                .on('rotatestart', (d) => { rotatestarted = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('rotateend', (d) => { rotateended = d.data; })
                .on('pitch', (d) => { pitch = d.data; });

            const options = camera.getFreeCameraOptions();
            quat.rotateZ(options.orientation, options.orientation, 0.1);
            camera.setFreeCameraOptions(options, eventData);

            expect(rotatestarted).toEqual('ok');
            expect(rotated).toEqual('ok');
            expect(rotateended).toEqual('ok');
            expect(pitch).toEqual(undefined);
        });

        test('changing orientation emits pitch events', async () => {
            let  pitchstarted, pitch, pitchended, rotated;
            const eventData = {data: 'ok'};

            camera
                .on('pitchstart', (d) => { pitchstarted = d.data; })
                .on('pitch', (d) => { pitch = d.data; })
                .on('pitchend', (d) => { pitchended = d.data; })
                .on('rotate', (d) => { rotated = d.data; });

            const options = camera.getFreeCameraOptions();
            quat.rotateX(options.orientation, options.orientation, -0.1);
            camera.setFreeCameraOptions(options, eventData);

            expect(pitchstarted).toEqual('ok');
            expect(pitch).toEqual('ok');
            expect(pitchended).toEqual('ok');
            expect(rotated).toEqual(undefined);
        });

        test('changing altitude emits zoom events', async () => {
            let zoomstarted, zoom, zoomended;
            const eventData = {data: 'ok'};

            camera
                .on('zoomstart', (d) => { zoomstarted = d.data; })
                .on('zoom', (d) => { zoom = d.data; })
                .on('zoomend', (d) => { zoomended = d.data; });

            const options = camera.getFreeCameraOptions();
            options.position.z *= 0.8;
            camera.setFreeCameraOptions(options, eventData);

            expect(zoomstarted).toEqual('ok');
            expect(zoom).toEqual('ok');
            expect(zoomended).toEqual('ok');
        });
    });
});
