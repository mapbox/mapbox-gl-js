import * as DOM from '../util/dom';

import type Transform from '../geo/transform';

/**
 * Shows the camera state in the top left corner of the map, in the same format as the native SDKs.
 * Creates the element in `container` when `element` is null, and returns the element.
 * @private
 */
export function updateCameraDebug(element: HTMLElement | null, container: HTMLElement, tr: Transform): HTMLElement {
    const el = element || DOM.create('div', 'mapboxgl-camera-debug', container);
    const entries: Array<[string, string]> = [
        ['lat', tr.center.lat.toFixed(4)],
        ['lon', tr.center.lng.toFixed(4)],
        ['zoom', tr.zoom.toFixed(2)]
    ];
    if (tr.bearing !== 0) entries.push(['bearing', tr.bearing.toFixed(2)]);
    if (tr.pitch !== 0) entries.push(['pitch', tr.pitch.toFixed(2)]);

    const text = entries.map(([key, value]) => `${key}: ${value}`).join('\n');
    if (el.textContent === text) return el;

    el.replaceChildren();
    entries.forEach(([key, value], i) => {
        if (i > 0) el.append('\n');
        DOM.create('b', null, el).textContent = `${key}:`;
        el.append(` ${value}`);
    });
    return el;
}
