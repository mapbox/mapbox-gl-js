import {vec3} from 'gl-matrix';
import {Ray} from '../../util/primitives';

import type Transform from '../transform';

export function farthestPixelDistanceOnPlane(tr: Transform, pixelsPerMeter: number): number {
    // Find the distance from the center point [width/2 + offset.x, height/2 + offset.y] to the
    // center top point [width/2 + offset.x, 0] in Z units, using the law of sines.
    // 1 Z unit is equivalent to 1 horizontal px at the center of the map
    // (the distance between[width/2, height/2] and [width/2 + 1, height/2])
    const fovAboveCenter = tr.fovAboveCenter;

    // Adjust distance to MSL by the minimum possible elevation visible on screen,
    // this way the far plane is pushed further in the case of negative elevation.
    const minElevationInPixels = tr.elevation ?
        tr.elevation.getMinElevationBelowMSL() * pixelsPerMeter :
        0;
    const cameraToSeaLevelDistance = ((tr._camera.position[2] * tr.worldSize) - minElevationInPixels) / Math.cos(tr._pitch);
    const topHalfSurfaceDistance = Math.sin(fovAboveCenter) * cameraToSeaLevelDistance / Math.sin(Math.max(Math.PI / 2.0 - tr._pitch - fovAboveCenter, 0.01));

    // Calculate z distance of the farthest fragment that should be rendered.
    let furthestDistance = Math.sin(tr._pitch) * topHalfSurfaceDistance + cameraToSeaLevelDistance;
    const horizonDistance = cameraToSeaLevelDistance * (1 / tr._horizonShift);

    // Add a bit extra to avoid precision problems when a fragment's distance is exactly `furthestDistance`
    // Due to precision of sources with low maxZoom, content is prone to flickering on zoom above 18.
    // Use larger furthest distance also on pitch before the horizon, especially on higher zoom to limit
    // the performance and depth range resolution impact.
    if (!tr.elevation || tr.elevation.exaggeration() === 0) {
        let factor = Math.max(tr.zoom - 17, 0);
        // In case of orthographic projection we don't want to extend the far clip plane that much as the
        // depth is linear and we would be effectively decreasing precision.
        if (tr.isOrthographic) {
            factor /= 10.0;
        }
        furthestDistance *= (1.0 + factor);
    }
    return Math.min(furthestDistance * 1.01, horizonDistance);
}

export function farthestPixelDistanceOnSphere(tr: Transform, pixelsPerMeter: number): number {
    // Find farthest distance of the globe that is potentially visible to the camera.
    // First check if the view frustum is fully covered by the map by casting a ray
    // from the top left/right corner and see if it intersects with the globe. In case
    // of no intersection we need to find distance to the horizon point where the
    // surface normal is perpendicular to the camera forward direction.
    const cameraDistance = tr.cameraToCenterDistance;
    const centerPixelAltitude = tr._centerAltitude * pixelsPerMeter;

    const camera = tr._camera;
    const forward = tr._camera.forward();
    const cameraPosition = vec3.add([] as unknown as vec3, vec3.scale([] as unknown as vec3, forward, -cameraDistance), [0, 0, centerPixelAltitude]);

    const globeRadius = tr.worldSize / (2.0 * Math.PI);
    const globeCenter: vec3 = [0, 0, -globeRadius];

    const aspectRatio = tr.width / tr.height;
    const tanFovAboveCenter = Math.tan(tr.fovAboveCenter);

    const up = vec3.scale([] as unknown as vec3, camera.up(), tanFovAboveCenter);
    const right = vec3.scale([] as unknown as vec3, camera.right(), tanFovAboveCenter * aspectRatio);
    const dir = vec3.normalize([] as unknown as vec3, vec3.add([] as unknown as vec3, vec3.add([] as unknown as vec3, forward, up), right));

    const pointOnGlobe = [] as unknown as vec3;
    const ray = new Ray(cameraPosition, dir);

    let pixelDistance;
    if (ray.closestPointOnSphere(globeCenter, globeRadius, pointOnGlobe)) {
        const p0 = vec3.add([] as unknown as vec3, pointOnGlobe, globeCenter);
        const p1 = vec3.sub([] as unknown as vec3, p0, cameraPosition);
        // Globe is fully covering the view frustum. Project the intersection
        // point to the camera view vector in order to find the pixel distance
        pixelDistance = Math.cos(tr.fovAboveCenter) * vec3.length(p1);
    } else {
        // Background space is visible. Find distance to the point of the
        // globe where surface normal is parallel to the view vector
        const globeCenterToCamera = vec3.sub([] as unknown as vec3, cameraPosition, globeCenter);
        const cameraToGlobe = vec3.sub([] as unknown as vec3, globeCenter, cameraPosition);
        vec3.normalize(cameraToGlobe, cameraToGlobe);

        const cameraHeight = vec3.length(globeCenterToCamera) - globeRadius;
        pixelDistance = Math.sqrt(cameraHeight * (cameraHeight + 2 * globeRadius));
        const angle = Math.acos(pixelDistance / (globeRadius + cameraHeight)) - Math.acos(vec3.dot(forward, cameraToGlobe));
        pixelDistance *= Math.cos(angle);
    }

    return pixelDistance * 1.01;
}
