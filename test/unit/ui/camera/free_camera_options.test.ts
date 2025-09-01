// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {vec3, quat} from 'gl-matrix';
import {createCamera} from './utils';
import {describe, test, expect} from '../../../util/vitest';
import {FreeCameraOptions} from '../../../../src/ui/free_camera';
import {fixedNum, fixedVec3} from '../../../util/fixed';
import MercatorCoordinate from '../../../../src/geo/mercator_coordinate';
import LngLat from '../../../../src/geo/lng_lat';

describe('camera', () => {
    describe('FreeCameraOptions', () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const camera = createCamera();

        const rotatedFrame = (quaternion) => {
            return {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                up: vec3.transformQuat([], [0, -1, 0], quaternion),
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                forward: vec3.transformQuat([], [0, 0, -1], quaternion),
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(fixedVec3(frame.right)).toEqual([1, 0, 0]);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(fixedVec3(frame.up)).toEqual([0, -cosPi4, cosPi4]);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(fixedVec3(frame.forward)).toEqual([0, -cosPi4, -cosPi4]);
            });

            test('Look directly to east', () => {
                options.position = new MercatorCoordinate(0.5, 0.5, 0.0);
                options.lookAtPoint(new LngLat(30, 0));
                expect(options.orientation).toBeTruthy();
                frame = rotatedFrame(options.orientation);

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(fixedVec3(frame.right)).toEqual([+0, 1, +0]);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(fixedVec3(frame.up)).toEqual([0, 0, 1]);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(fixedVec3(frame.forward)).toEqual([1, -0, -0]);
            });

            test('Pitch: 0, bearing: 0', () => {
                options.position = MercatorCoordinate.fromLngLat(new LngLat(24.9384, 60.1699), 100.0);
                options.lookAtPoint(new LngLat(24.9384, 60.1699), [0.0, -1.0, 0.0]);
                expect(options.orientation).toBeTruthy();
                frame = rotatedFrame(options.orientation);

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(fixedVec3(frame.right)).toEqual([1.0, 0.0, 0.0]);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(fixedVec3(frame.up)).toEqual([0.0, -1.0, 0.0]);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(fixedVec3(frame.forward)).toEqual([0.0, 0.0, -1.0]);
            });

            test('Pitch: 0, bearing: 45', () => {
                options.position = MercatorCoordinate.fromLngLat(new LngLat(24.9384, 60.1699), 100.0);
                options.lookAtPoint(new LngLat(24.9384, 60.1699), [-1.0, -1.0, 0.0]);
                expect(options.orientation).toBeTruthy();
                frame = rotatedFrame(options.orientation);

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(fixedVec3(frame.right)).toEqual([cosPi4, -cosPi4, 0.0]);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(fixedVec3(frame.up)).toEqual([-cosPi4, -cosPi4, 0.0]);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(fixedVec3(frame.forward)).toEqual([0.0, 0.0, -1.0]);
            });

            test('Looking south, up vector almost same as forward vector', () => {
                options.position = MercatorCoordinate.fromLngLat(new LngLat(122.4194, 37.7749));
                options.lookAtPoint(new LngLat(122.4194, 37.5), [0.0, 1.0, 0.00001]);
                expect(options.orientation).toBeTruthy();
                frame = rotatedFrame(options.orientation);

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(fixedVec3(frame.right)).toEqual([-1.0, 0.0, 0.0]);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(fixedVec3(frame.up)).toEqual([0.0, 0.0, 1.0]);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(fixedVec3(frame.forward)).toEqual([+0.0, 1.0, -0.0]);
            });

            test('Orientation with roll-component', () => {
                options.position = MercatorCoordinate.fromLngLat(new LngLat(151.2093, -33.8688));
                options.lookAtPoint(new LngLat(160.0, -33.8688), [0.0, -1.0, 0.1]);
                expect(options.orientation).toBeTruthy();
                frame = rotatedFrame(options.orientation);

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(fixedVec3(frame.right)).toEqual([0.0, 1.0, 0.0]);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(fixedVec3(frame.up)).toEqual([0.0, 0.0, 1.0]);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(fixedVec3(frame.forward)).toEqual([1.0, -0.0, -0.0]);
            });

            test('Up vector pointing downwards', () => {
                options.position = new MercatorCoordinate(0.5, 0.5, 0.5);
                options.lookAtPoint(new LngLat(0.0, 85.051128779806604), [0.0, 0.0, -0.5]);
                expect(options.orientation).toBeTruthy();
                frame = rotatedFrame(options.orientation);

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(fixedVec3(frame.right)).toEqual([1.0, 0.0, 0.0]);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(fixedVec3(frame.up)).toEqual([0.0, -cosPi4, cosPi4]);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(fixedVec3(frame.right)).toEqual([1, 0, 0]);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(fixedVec3(frame.up)).toEqual([0, -1, 0]);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(fixedVec3(frame.forward)).toEqual([0, 0, -1]);

            options.setPitchBearing(0, 180);
            expect(options.orientation).toBeTruthy();
            frame = rotatedFrame(options.orientation);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(fixedVec3(frame.right)).toEqual([-1, 0, 0]);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(fixedVec3(frame.up)).toEqual([0, 1, 0]);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(fixedVec3(frame.forward)).toEqual([0, 0, -1]);

            options.setPitchBearing(60, 0);
            expect(options.orientation).toBeTruthy();
            frame = rotatedFrame(options.orientation);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(fixedVec3(frame.right)).toEqual([1, 0, 0]);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(fixedVec3(frame.up)).toEqual([0, -cos60, sin60]);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(fixedVec3(frame.forward)).toEqual([0, -sin60, -cos60]);

            options.setPitchBearing(60, -450);
            expect(options.orientation).toBeTruthy();
            frame = rotatedFrame(options.orientation);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(fixedVec3(frame.right)).toEqual([+0, -1, -0]);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(fixedVec3(frame.up)).toEqual([-cos60, -0, sin60]);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(fixedVec3(frame.forward)).toEqual([-sin60, -0, -cos60]);
        });

        // eslint-disable-next-line @typescript-eslint/require-await
        test('emits move events', async () => {
            let started: any, moved: any, ended: any;
            const eventData = {data: 'ok'};

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            camera
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                .on('movestart', (d) => { started = d.data; })
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                .on('move', (d) => { moved = d.data; })
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                .on('moveend', (d) => { ended = d.data; });

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            const options = camera.getFreeCameraOptions();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            options.position.x = 0.2;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            options.position.y = 0.2;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.setFreeCameraOptions(options, eventData);

            expect(started).toEqual('ok');
            expect(moved).toEqual('ok');
            expect(ended).toEqual('ok');
        });

        // eslint-disable-next-line @typescript-eslint/require-await
        test('changing orientation emits bearing events', async () => {
            let rotatestarted: any, rotated: any, rotateended: any, pitch: any;
            const eventData = {data: 'ok'};

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            camera
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                .on('rotatestart', (d) => { rotatestarted = d.data; })
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                .on('rotate', (d) => { rotated = d.data; })
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                .on('rotateend', (d) => { rotateended = d.data; })
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                .on('pitch', (d) => { pitch = d.data; });

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            const options = camera.getFreeCameraOptions();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
            quat.rotateZ(options.orientation, options.orientation, 0.1);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.setFreeCameraOptions(options, eventData);

            expect(rotatestarted).toEqual('ok');
            expect(rotated).toEqual('ok');
            expect(rotateended).toEqual('ok');
            expect(pitch).toEqual(undefined);
        });

        // eslint-disable-next-line @typescript-eslint/require-await
        test('changing orientation emits pitch events', async () => {
            let  pitchstarted: any, pitch: any, pitchended: any, rotated: any;
            const eventData = {data: 'ok'};

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            camera
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                .on('pitchstart', (d) => { pitchstarted = d.data; })
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                .on('pitch', (d) => { pitch = d.data; })
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                .on('pitchend', (d) => { pitchended = d.data; })
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                .on('rotate', (d) => { rotated = d.data; });

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            const options = camera.getFreeCameraOptions();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
            quat.rotateX(options.orientation, options.orientation, -0.1);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.setFreeCameraOptions(options, eventData);

            expect(pitchstarted).toEqual('ok');
            expect(pitch).toEqual('ok');
            expect(pitchended).toEqual('ok');
            expect(rotated).toEqual(undefined);
        });

        // eslint-disable-next-line @typescript-eslint/require-await
        test('changing altitude emits zoom events', async () => {
            let zoomstarted: any, zoom: any, zoomended: any;
            const eventData = {data: 'ok'};

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            camera
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                .on('zoomstart', (d) => { zoomstarted = d.data; })
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                .on('zoom', (d) => { zoom = d.data; })
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                .on('zoomend', (d) => { zoomended = d.data; });

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            const options = camera.getFreeCameraOptions();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            options.position.z *= 0.8;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            camera.setFreeCameraOptions(options, eventData);

            expect(zoomstarted).toEqual('ok');
            expect(zoom).toEqual('ok');
            expect(zoomended).toEqual('ok');
        });
    });
});
