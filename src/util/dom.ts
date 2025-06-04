import Point from '@mapbox/point-geometry';
import assert from 'assert';

// refine the return type based on tagName, e.g. 'button' -> HTMLButtonElement
export function create<T extends keyof HTMLElementTagNameMap>(tagName: T, className?: string | null, container?: HTMLElement) {
    const el = document.createElement<T>(tagName);
    if (className !== undefined && className !== null) el.className = className;
    if (container) container.appendChild(el);
    return el;
}

export function createSVG(
    tagName: string,
    attributes: {
        [key: string]: string | number;
    },
    container?: Element,
): Element {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tagName);
    for (const name of Object.keys(attributes)) {
        el.setAttributeNS(null, name, String(attributes[name]));
    }
    if (container) container.appendChild(el);
    return el;
}

const docStyle = typeof document !== 'undefined' ? document.documentElement && document.documentElement.style : null;
const selectProp = docStyle && docStyle.userSelect !== undefined ? 'userSelect' : 'WebkitUserSelect';
let userSelect;

export function disableDrag() {
    if (docStyle && selectProp) {
        userSelect = docStyle[selectProp];
        docStyle[selectProp] = 'none';
    }
}

export function enableDrag() {
    if (docStyle && selectProp) {
        docStyle[selectProp] = userSelect;
    }
}

// Suppress the next click, but only if it's immediate.
function suppressClickListener(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    window.removeEventListener('click', suppressClickListener, true);
}

export function suppressClick() {
    window.addEventListener('click', suppressClickListener, true);
    window.setTimeout(() => {
        window.removeEventListener('click', suppressClickListener, true);
    }, 0);
}

export function mousePos(el: HTMLElement, e: MouseEvent | WheelEvent): Point {
    const rect = el.getBoundingClientRect();
    return getScaledPoint(el, rect, e);
}

export function touchPos(el: HTMLElement, touches: TouchList): Array<Point> {
    const rect = el.getBoundingClientRect(),
        points = [];

    for (let i = 0; i < touches.length; i++) {
        points.push(getScaledPoint(el, rect, touches[i]));
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return points;
}

export function mouseButton(e: MouseEvent): number {
    assert(e.type === 'mousedown' || e.type === 'mouseup');
    if (/firefox/i.test(navigator.userAgent) && /macintosh/i.test(navigator.userAgent) && e.button === 2 && e.ctrlKey) {
        // Fix for https://github.com/mapbox/mapbox-gl-js/issues/3131:
        // Firefox on Mac (detected by user agent) determines e.button = 2 when
        // using Control + left click
        return 0;
    }
    return e.button;
}

function getScaledPoint(el: HTMLElement, rect: ClientRect, e: MouseEvent | WheelEvent | Touch) {
    // Until we get support for pointer events (https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent)
    // we use this dirty trick which would not work for the case of rotated transforms, but works well for
    // the case of simple scaling.
    // Note: `el.offsetWidth === rect.width` eliminates the `0/0` case.
    const scaling = el.offsetWidth === rect.width ? 1 : el.offsetWidth / rect.width;
    return new Point(
        (e.clientX - rect.left) * scaling,
        (e.clientY - rect.top) * scaling
    );
}
