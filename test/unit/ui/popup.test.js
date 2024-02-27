import {describe, test, beforeEach, afterEach, expect, waitFor, vi, createMap as globalCreateMap} from "../../util/vitest.js";
import Popup from '../../../src/ui/popup.js';
import LngLat from '../../../src/geo/lng_lat.js';
import Point from '@mapbox/point-geometry';
import simulate from '../../util/simulate_interaction.js';

const containerWidth = 512;
const containerHeight = 512;

describe('Popup', () => {
    let container;

    function createMap(options) {
        options = options || {};
        Object.defineProperty(container, 'getBoundingClientRect',
        {value: () => ({height: options.height || containerHeight, width: options.width || containerWidth})});
        return globalCreateMap({container});
    }

    beforeEach(() => {
        container = window.document.createElement('div');
        window.document.body.appendChild(container);
    });

    afterEach(() => {
        window.document.body.removeChild(container);
    });

    test('Popup#getElement returns a .mapboxgl-popup element', () => {
        const map = createMap();
        const popup = new Popup()
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(map);

        expect(popup.isOpen()).toBeTruthy();
        expect(popup.getElement().classList.contains('mapboxgl-popup')).toBeTruthy();
    });

    test('Popup#addTo adds a .mapboxgl-popup element', () => {
        const map = createMap();
        const popup = new Popup()
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(map);

        expect(popup.isOpen()).toBeTruthy();
        expect(map.getContainer().querySelectorAll('.mapboxgl-popup').length).toEqual(1);
    });

    test('Popup closes on map click events by default', () => {
        const map = createMap();
        const popup = new Popup()
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(map);

        simulate.click(map.getCanvas());

        expect(!popup.isOpen()).toBeTruthy();
    });

    test('Popup close event listener is removed on map click', async () => {
        const map = createMap();
        const popup = new Popup()
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(map);

        const listener = vi.fn();
        popup.on('close', listener);

        simulate.click(map.getCanvas());
        simulate.click(map.getCanvas());

        expect(!popup.isOpen()).toBeTruthy();
        expect(listener).toHaveBeenCalledTimes(1);
    });

    test(
        'Popup does not close on map click events when the closeOnClick option is false',
        () => {
            const map = createMap();
            const popup = new Popup({closeOnClick: false})
                .setText('Test')
                .setLngLat([0, 0])
                .addTo(map);

            simulate.click(map.getCanvas());

            expect(popup.isOpen()).toBeTruthy();
        }
    );

    test('Popup closes on close button click events', () => {
        const map = createMap();
        const popup = new Popup()
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(map);

        simulate.click(map.getContainer().querySelector('.mapboxgl-popup-close-button'));

        expect(!popup.isOpen()).toBeTruthy();
    });

    test('Popup has no close button if closeButton option is false', () => {
        const map = createMap();

        const popup = new Popup({closeButton: false})
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(map);

        expect(popup.getElement().querySelectorAll('.mapboxgl-popup-close-button').length).toEqual(0);
    });

    test(
        'Popup does not close on map move events when the closeOnMove option is false',
        () => {
            const map = createMap();
            const popup = new Popup({closeOnMove: false})
                .setText('Test')
                .setLngLat([0, 0])
                .addTo(map);

            map.setCenter([-10, 0]); // longitude bounds: [-370, 350]

            expect(popup.isOpen()).toBeTruthy();
        }
    );

    test(
        'Popup closes on map move events when the closeOnMove option is true',
        () => {
            const map = createMap();
            const popup = new Popup({closeOnMove: true})
                .setText('Test')
                .setLngLat([0, 0])
                .addTo(map);

            map.setCenter([-10, 0]); // longitude bounds: [-370, 350]

            expect(!popup.isOpen()).toBeTruthy();
        }
    );

    test('Popup fires close event when removed', () => {
        const map = createMap();
        const onClose = vi.fn();

        new Popup()
            .setText('Test')
            .setLngLat([0, 0])
            .on('close', onClose)
            .addTo(map)
            .remove();

        expect(onClose).toHaveBeenCalled();
    });

    test('Popup fires open event when added', () => {
        const map = createMap();
        const onOpen = vi.fn();

        new Popup()
            .setText('Test')
            .setLngLat([0, 0])
            .on('open', onOpen)
            .addTo(map);

        expect(onOpen).toHaveBeenCalled();
    });

    test('Popup content can be set via setText', () => {
        const map = createMap();

        const popup = new Popup({closeButton: false})
            .setLngLat([0, 0])
            .addTo(map)
            .setText('Test');

        expect(popup.getElement().textContent).toEqual('Test');
    });

    test('Popup content can be set via setHTML', () => {
        const map = createMap();

        const popup = new Popup({closeButton: false})
            .setLngLat([0, 0])
            .addTo(map)
            .setHTML("<span>Test</span>");

        expect(popup.getElement().querySelector('.mapboxgl-popup-content').innerHTML).toEqual("<span>Test</span>");
    });

    test('Popup width maximum defaults to 240px', () => {
        const map = createMap();

        const popup = new Popup({closeButton: false})
            .setLngLat([0, 0])
            .addTo(map)
            .setHTML("<span>Test</span>");

        expect(popup.getMaxWidth()).toEqual('240px');
    });

    test('Popup width maximum can be set via using maxWidth option', () => {
        const map = createMap();

        const popup = new Popup({closeButton: false, maxWidth: '5px'})
            .setLngLat([0, 0])
            .addTo(map)
            .setHTML("<span>Test</span>");

        expect(popup.getMaxWidth()).toEqual('5px');
    });

    test('Popup width maximum can be set via maxWidth', () => {
        const map = createMap();

        const popup = new Popup({closeButton: false})
            .setLngLat([0, 0])
            .setHTML("<span>Test</span>")
            .setMaxWidth('5px')
            .addTo(map);

        expect(popup.getMaxWidth()).toEqual('5px');
    });

    test('Popup content can be set via setDOMContent', () => {
        const map = createMap();
        const content = window.document.createElement('span');

        const popup = new Popup({closeButton: false})
            .setLngLat([0, 0])
            .addTo(map)
            .setDOMContent(content);

        expect(popup.getElement().querySelector('.mapboxgl-popup-content').firstChild).toEqual(content);
    });

    test('Popup#setText protects against XSS', () => {
        const map = createMap();

        const popup = new Popup({closeButton: false})
            .setLngLat([0, 0])
            .addTo(map)
            .setText("<script>alert('XSS')</script>");

        expect(popup.getElement().textContent).toEqual("<script>alert('XSS')</script>");
    });

    test('Popup content setters overwrite previous content', () => {
        const map = createMap();

        const popup = new Popup({closeButton: false})
            .setLngLat([0, 0])
            .addTo(map);

        popup.setText('Test 1');
        expect(popup.getElement().textContent).toEqual('Test 1');

        popup.setHTML('Test 2');
        expect(popup.getElement().textContent).toEqual('Test 2');

        popup.setDOMContent(window.document.createTextNode('Test 3'));
        expect(popup.getElement().textContent).toEqual('Test 3');
    });

    test('Popup provides LngLat accessors', () => {
        expect(new Popup().getLngLat()).toEqual(undefined);

        expect(new Popup().setLngLat([1, 2]).getLngLat() instanceof LngLat).toBeTruthy();
        expect(new Popup().setLngLat([1, 2]).getLngLat()).toEqual(new LngLat(1, 2));

        expect(new Popup().setLngLat(new LngLat(1, 2)).getLngLat() instanceof LngLat).toBeTruthy();
        expect(new Popup().setLngLat(new LngLat(1, 2)).getLngLat()).toEqual(new LngLat(1, 2));
    });

    test('Popup is positioned at the specified LngLat in a world copy', () => {
        const map = createMap({width: 1024}); // longitude bounds: [-360, 360]

        const popup = new Popup()
            .setLngLat([270, 0])
            .setText('Test')
            .addTo(map);

        expect(popup._pos).toEqual(map.project([270, 0]));
    });

    test('Popup preserves object constancy of position after map move', () => {
        const map = createMap({width: 1024}); // longitude bounds: [-360, 360]

        const popup = new Popup()
            .setLngLat([270, 0])
            .setText('Test')
            .addTo(map);

        map.setCenter([-10, 0]); // longitude bounds: [-370, 350]
        expect(popup._pos).toEqual(map.project([270, 0]));

        map.setCenter([-20, 0]); // longitude bounds: [-380, 340]
        expect(popup._pos).toEqual(map.project([270, 0]));
    });

    test(
        'Popup preserves object constancy of position after auto-wrapping center (left)',
        () => {
            const map = createMap({width: 1024});
            map.setCenter([-175, 0]); // longitude bounds: [-535, 185]

            const popup = new Popup()
                .setLngLat([0, 0])
                .setText('Test')
                .addTo(map);

            map.setCenter([175, 0]); // longitude bounds: [-185, 535]
            expect(popup._pos).toEqual(map.project([360, 0]));
        }
    );

    test(
        'Popup preserves object constancy of position after auto-wrapping center (right)',
        () => {
            const map = createMap({width: 1024});
            map.setCenter([175, 0]); // longitude bounds: [-185, 535]

            const popup = new Popup()
                .setLngLat([0, 0])
                .setText('Test')
                .addTo(map);

            map.setCenter([-175, 0]); // longitude bounds: [-185, 535]
            expect(popup._pos).toEqual(map.project([-360, 0]));
        }
    );

    test(
        'Popup preserves object constancy of position after auto-wrapping center with horizon',
        () => {
            const map = createMap({width: 1024});
            map.setCenter([-175, 0]); // longitude bounds: [-535, 185]
            map.setPitch(69);
            map.setBearing(90);

            const popup = new Popup()
                .setLngLat([-720, 0])
                .setText('Test')
                .addTo(map);
            // invoke smart wrap multiple times.
            map.setCenter([0, 0]);
            map.setCenter([300, 0]);
            map.setPitch(72);
            map.setCenter([600, 0]);
            map.setPitch(75);
            map.setCenter([900, 0]);
            map.setPitch(80);
            map.setCenter([175, 0]);

            expect(popup._pos).toEqual(map.project([720, 0]));
        }
    );

    test(
        'Popup wraps position after map move if it would otherwise go offscreen (right)',
        () => {
            const map = createMap({width: 1024}); // longitude bounds: [-360, 360]

            const popup = new Popup()
                .setLngLat([-355, 0])
                .setText('Test')
                .addTo(map);

            map.setCenter([10, 0]); // longitude bounds: [-350, 370]
            expect(popup._pos).toEqual(map.project([5, 0]));
        }
    );

    test(
        'Popup wraps position after map move if it would otherwise go offscreen (right)',
        () => {
            const map = createMap({width: 1024}); // longitude bounds: [-360, 360]

            const popup = new Popup()
                .setLngLat([355, 0])
                .setText('Test')
                .addTo(map);

            map.setCenter([-10, 0]); // longitude bounds: [-370, 350]
            expect(popup._pos).toEqual(map.project([-5, 0]));
        }
    );

    test('Popup is repositioned at the specified LngLat', () => {
        const map = createMap({width: 1024}); // longitude bounds: [-360, 360]

        const popup = new Popup()
            .setLngLat([270, 0])
            .setText('Test')
            .addTo(map)
            .setLngLat([0, 0]);

        expect(popup._pos).toEqual(map.project([0, 0]));
    });

    test(
        'When toggling projections, popups update with correct position',
        async () => {
            const map = createMap();
            const popup = new Popup()
                .setText('Test')
                .setLngLat([12, 55])
                .addTo(map);

            map.setCenter([-179, 0]);
            expect(popup.getLngLat().lng).toEqual(-348);

            map.setProjection('albers');

            map._domRenderTaskQueue.run();
            await waitFor(map, "render");
            expect(popup.getLngLat().lng).toEqual(12);
            map.remove();
        }
    );

    test(
        'When disabling render world copies, popups update with correct position',
        async () => {
            const map = createMap();
            const popup = new Popup()
                .setText('Test')
                .setLngLat([12, 55])
                .addTo(map);

            map.setCenter([-179, 0]);
            expect(popup.getLngLat().lng).toEqual(-348);

            map.setRenderWorldCopies(false);

            map._domRenderTaskQueue.run();

            await waitFor(map, "render");
            expect(popup.getLngLat().lng).toEqual(12);
            map.remove();
        }
    );

    test('Popup anchors as specified by the anchor option', () => {
        const map = createMap();
        const popup = new Popup({anchor: 'top-left'})
            .setLngLat([0, 0])
            .setText('Test')
            .addTo(map);
        map._domRenderTaskQueue.run();

        expect(popup.getElement().classList.contains('mapboxgl-popup-anchor-top-left')).toBeTruthy();
    });

    [
        ['top-left',     new Point(10, 10),                                     'translate(0px, 0px) translate(7px, 7px)'],
        ['top',          new Point(containerWidth / 2, 10),                     'translate(-50%, 0px) translate(0px, 10px)'],
        ['top-right',    new Point(containerWidth - 10, 10),                    'translate(-100%, 0px) translate(-7px, 7px)'],
        ['right',        new Point(containerWidth - 10, containerHeight / 2),   'translate(-100%, -50%) translate(-10px, 0px)'],
        ['bottom-right', new Point(containerWidth - 10, containerHeight - 10),  'translate(-100%, -100%) translate(-7px, -7px)'],
        ['bottom',       new Point(containerWidth / 2, containerHeight - 10),   'translate(-50%, -100%) translate(0px, -10px)'],
        ['bottom-left',  new Point(10, containerHeight - 10),                   'translate(0px, -100%) translate(7px, -7px)'],
        ['left',         new Point(10, containerHeight / 2),                    'translate(0px, -50%) translate(10px, 0px)'],
        ['bottom',       new Point(containerWidth / 2, containerHeight / 2),    'translate(-50%, -100%) translate(0px, -10px)']
    ].forEach((args) => {
        const anchor = args[0];
        const point = args[1];
        const transform = args[2];

        test(`Popup automatically anchors to ${anchor}`, () => {
            const map = createMap();
            const popup = new Popup()
                .setLngLat([0, 0])
                .setText('Test')
                .addTo(map);
            map._domRenderTaskQueue.run();

            Object.defineProperty(popup.getElement(), 'offsetWidth', {value: 100});
            Object.defineProperty(popup.getElement(), 'offsetHeight', {value: 100});

            vi.spyOn(map, 'project').mockImplementation(() => point);
            vi.spyOn(map.transform, 'locationPoint3D', 'get').mockImplementation(() => point);
            popup.setLngLat([0, 0]);
            map._domRenderTaskQueue.run();

            expect(popup.getElement().classList.contains(`mapboxgl-popup-anchor-${anchor}`)).toBeTruthy();
        });

        test(`Popup translation reflects offset and ${anchor} anchor`, () => {
            const map = createMap();
            vi.spyOn(map, 'project').mockImplementation(() => new Point(0, 0));
            vi.spyOn(map.transform, 'locationPoint3D', 'get').mockImplementation(() => new Point(0, 0));

            const popup = new Popup({anchor, offset: 10})
                .setLngLat([0, 0])
                .setText('Test')
                .addTo(map);
            map._domRenderTaskQueue.run();

            expect(popup.getElement().style.transform).toEqual(transform);
        });
    });

    test(
        'Popup automatically anchors to top if its bottom offset would push it off-screen',
        () => {
            const map = createMap();
            const point = new Point(containerWidth / 2, containerHeight / 2);
            const options = {offset: {
                'bottom': [0, -25],
                'top': [0, 0]
            }};
            const popup = new Popup(options)
                .setLngLat([0, 0])
                .setText('Test')
                .addTo(map);
            map._domRenderTaskQueue.run();

            Object.defineProperty(popup.getElement(), 'offsetWidth', {value: containerWidth / 2});
            Object.defineProperty(popup.getElement(), 'offsetHeight', {value: containerHeight / 2});

            vi.spyOn(map, 'project').mockImplementation(() => point);
            popup.setLngLat([0, 0]);
            map._domRenderTaskQueue.run();

            expect(popup.getElement().classList.contains('mapboxgl-popup-anchor-top')).toBeTruthy();
        }
    );

    test('Popup is offset via a PointLike offset option', () => {
        const map = createMap();
        vi.spyOn(map, 'project').mockImplementation(() => new Point(0, 0));
        vi.spyOn(map.transform, 'locationPoint3D', 'get').mockImplementation(() => new Point(0, 0));

        const popup = new Popup({anchor: 'top-left', offset: [5, 10]})
            .setLngLat([0, 0])
            .setText('Test')
            .addTo(map);
        map._domRenderTaskQueue.run();

        expect(popup.getElement().style.transform).toEqual('translate(0px, 0px) translate(5px, 10px)');
    });

    test('Popup is offset via an object offset option', () => {
        const map = createMap();
        vi.spyOn(map, 'project').mockImplementation(() => new Point(0, 0));
        vi.spyOn(map.transform, 'locationPoint3D', 'get').mockImplementation(() => new Point(0, 0));

        const popup = new Popup({anchor: 'top-left', offset: {'top-left': [5, 10]}})
            .setLngLat([0, 0])
            .setText('Test')
            .addTo(map);
        map._domRenderTaskQueue.run();

        expect(popup.getElement().style.transform).toEqual('translate(0px, 0px) translate(5px, 10px)');
    });

    test('Popup is offset via an incomplete object offset option', () => {
        const map = createMap();
        vi.spyOn(map, 'project').mockImplementation(() => new Point(0, 0));
        vi.spyOn(map.transform, 'locationPoint3D', 'get').mockImplementation(() => new Point(0, 0));

        const popup = new Popup({anchor: 'top-right', offset: {'top-left': [5, 10]}})
            .setLngLat([0, 0])
            .setText('Test')
            .addTo(map);
        map._domRenderTaskQueue.run();

        expect(popup.getElement().style.transform).toEqual('translate(-100%, 0px) translate(0px, 0px)');
    });

    test('Popup offset can be set via setOffset', () => {
        const map = createMap();

        const popup = new Popup({offset: 5})
            .setLngLat([0, 0])
            .setText('Test')
            .addTo(map);

        expect(popup.options.offset).toEqual(5);

        popup.setOffset(10);

        expect(popup.options.offset).toEqual(10);
    });

    test('Popup is positioned and occluded correctly on globe', () => {
        const map = createMap({width: 1024});
        map.setProjection('globe');

        const popup = new Popup()
            .setLngLat([45, 0])
            .setText('Test')
            .addTo(map);

        expect(popup._pos).toEqual(map.project([45, 0]));
        expect(popup._container.style.opacity).toBe("1");
        expect(popup._content.style.pointerEvents).toBe('auto');

        popup.setLngLat([270, 0]);
        expect(popup._pos).toEqual(map.project([270, 0]));
        expect(popup._container.style.opacity).toBe("0");
        expect(popup._content.style.pointerEvents).toBe('none');

        popup.setLngLat([0, 45]);
        expect(popup._pos).toEqual(map.project([0, 45]));
        expect(popup._container.style.opacity).toBe("1");
        expect(popup._content.style.pointerEvents).toBe('auto');
    });

    test('Popup can be removed and added again (#1477)', () => {
        const map = createMap();

        new Popup()
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(map)
            .remove()
            .addTo(map);

        expect(map.getContainer().querySelectorAll('.mapboxgl-popup').length).toEqual(1);
    });

    test('Popup#addTo is idempotent (#1811)', () => {
        const map = createMap();

        const popup = new Popup({closeButton: false})
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(map)
            .addTo(map);

        expect(popup.getElement().querySelector('.mapboxgl-popup-content').textContent).toEqual('Test');
    });

    test('Popup#remove is idempotent (#2395)', () => {
        const map = createMap();

        new Popup({closeButton: false})
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(map)
            .remove()
            .remove();

        expect(map.getContainer().querySelectorAll('.mapboxgl-popup').length).toEqual(0);
    });

    test(
        'Popup adds classes from className option, methods for class manipulation work properly',
        () => {
            const map = createMap();
            const popup = new Popup({className: 'some classes'})
                .setText('Test')
                .setLngLat([0, 0])
                .addTo(map);

            const popupContainer = popup.getElement();
            expect(popupContainer.classList.contains('some')).toBeTruthy();
            expect(popupContainer.classList.contains('classes')).toBeTruthy();

            popup.addClassName('addedClass');
            expect(popupContainer.classList.contains('addedClass')).toBeTruthy();

            popup.removeClassName('addedClass');
            expect(!popupContainer.classList.contains('addedClass')).toBeTruthy();

            popup.toggleClassName('toggle');
            expect(popupContainer.classList.contains('toggle')).toBeTruthy();

            popup.toggleClassName('toggle');
            expect(!popupContainer.classList.contains('toggle')).toBeTruthy();
        }
    );

    test(
        'Popup#addClassName adds classes when called before adding popup to map (#9677)',
        () => {
            const map = createMap();
            const popup = new Popup();
            popup.addClassName('some');
            popup.addClassName('classes');

            popup.setText('Test')
                .setLngLat([0, 0])
                .addTo(map);

            const popupContainer = popup.getElement();
            expect(popupContainer.classList.contains('some')).toBeTruthy();
            expect(popupContainer.classList.contains('classes')).toBeTruthy();
        }
    );
    test('Popup className option and addClassName both add classes', () => {
        const map = createMap();
        const popup = new Popup({className: 'some classes'});
        popup.addClassName('even')
            .addClassName('more');

        popup.setText('Test')
            .setLngLat([0, 0])
            .addTo(map);

        popup.addClassName('one-more');

        const popupContainer = popup.getElement();
        expect(popupContainer.classList.contains('some')).toBeTruthy();
        expect(popupContainer.classList.contains('classes')).toBeTruthy();
        expect(popupContainer.classList.contains('even')).toBeTruthy();
        expect(popupContainer.classList.contains('more')).toBeTruthy();
        expect(popupContainer.classList.contains('one-more')).toBeTruthy();
    });

    test(
        'Methods for class manipulation work properly when popup is not on map',
        () => {
            const map = createMap();
            const popup = new Popup()
                .setText('Test')
                .setLngLat([0, 0])
                .addClassName('some')
                .addClassName('classes');

            let popupContainer = popup.addTo(map).getElement();
            expect(popupContainer.classList.contains('some')).toBeTruthy();
            expect(popupContainer.classList.contains('classes')).toBeTruthy();

            popup.remove();
            popup.removeClassName('some');
            popupContainer = popup.addTo(map).getElement();

            expect(!popupContainer.classList.contains('some')).toBeTruthy();

            popup.remove();
            popup.toggleClassName('toggle');
            popupContainer = popup.addTo(map).getElement();

            expect(popupContainer.classList.contains('toggle')).toBeTruthy();

            popup.remove();
            popup.toggleClassName('toggle');
            popupContainer = popup.addTo(map).getElement();

            expect(!popupContainer.classList.contains('toggle')).toBeTruthy();
        }
    );

    test('Cursor-tracked popup disappears on mouseout', () => {
        const map = createMap();

        const popup = new Popup()
            .setText("Test")
            .trackPointer()
            .addTo(map);

        expect(popup._trackPointer).toEqual(true);
    });

    test('Pointer-tracked popup is tagged with right class', () => {
        const map = createMap();
        const popup = new Popup()
            .setText("Test")
            .trackPointer()
            .addTo(map);

        expect(popup._container.classList.value.includes('mapboxgl-popup-track-pointer')).toEqual(true);
    });

    test(
        'Pointer-tracked popup with content set later is tagged with right class ',
        () => {
            const map = createMap();
            const popup = new Popup()
                .trackPointer()
                .addTo(map);

            popup.setText("Test");

            expect(popup._container.classList.value.includes('mapboxgl-popup-track-pointer')).toEqual(true);
        }
    );

    test(
        'Pointer-tracked popup that is set afterwards is tagged with right class ',
        () => {
            const map = createMap();
            const popup = new Popup()
                .addTo(map);

            popup.setText("Test");
            popup.trackPointer();

            expect(popup._container.classList.value.includes('mapboxgl-popup-track-pointer')).toEqual(true);
        }
    );

    test('Pointer-tracked popup can be repositioned with setLngLat', () => {
        const map = createMap();
        const popup = new Popup()
            .setText("Test")
            .trackPointer()
            .setLngLat([0, 0])
            .addTo(map);

        expect(popup._pos).toEqual(map.project([0, 0]));
        expect(popup._container.classList.value.includes('mapboxgl-popup-track-pointer')).toEqual(false);
    });

    test('Positioned popup lacks pointer-tracking class', () => {
        const map = createMap();
        const popup = new Popup()
            .setText("Test")
            .setLngLat([0, 0])
            .addTo(map);

        expect(popup._container.classList.value.includes('mapboxgl-popup-track-pointer')).toEqual(false);
    });

    /**
     * @note Flacky
     */
    test.skip('Positioned popup can be set to track pointer', () => {
        const map = createMap({interactive: true});
        const popup = new Popup()
            .setText("Test")
            .setLngLat([0, 0])
            .trackPointer()
            .addTo(map);

        simulate.mousemove(map.getCanvas(), {screenX:10, screenY:1000});
        expect(popup._pos).toEqual({x:0, y:0});
    });

    test('Popup closes on Map#remove', () => {
        const map = createMap();
        const popup = new Popup()
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(map);

        map.remove();

        expect(!popup.isOpen()).toBeTruthy();
    });

    test(
        'Adding popup with no focusable content (Popup#setText) does not change the active element',
        () => {
            const dummyFocusedEl = window.document.createElement('button');
            window.document.body.appendChild(dummyFocusedEl);
            dummyFocusedEl.focus();

            new Popup({closeButton: false})
                .setText('Test')
                .setLngLat([0, 0])
                .addTo(createMap());

            expect(window.document.activeElement).toEqual(dummyFocusedEl);
        }
    );

    test(
        'Adding popup with no focusable content (Popup#setHTML) does not change the active element',
        () => {
            const dummyFocusedEl = window.document.createElement('button');
            window.document.body.appendChild(dummyFocusedEl);
            dummyFocusedEl.focus();

            new Popup({closeButton: false})
                .setHTML('<span>Test</span>')
                .setLngLat([0, 0])
                .addTo(createMap());

            expect(window.document.activeElement).toEqual(dummyFocusedEl);
        }
    );

    test('Close button is focused if it is the only focusable element', () => {
        const dummyFocusedEl = window.document.createElement('button');
        window.document.body.appendChild(dummyFocusedEl);
        dummyFocusedEl.focus();

        const popup = new Popup({closeButton: true})
            .setHTML('<span>Test</span>')
            .setLngLat([0, 0])
            .addTo(createMap());

        // Suboptimal because the string matching is case-sensitive
        const closeButton = popup._container.querySelector("[aria-label^='Close']");

        expect(window.document.activeElement).toEqual(closeButton);
    });

    test('If popup content contains a focusable element it is focused', () => {
        const popup = new Popup({closeButton: true})
            .setHTML('<span tabindex="0" data-testid="abc">Test</span>')
            .setLngLat([0, 0])
            .addTo(createMap());

        const focusableEl = popup._container.querySelector("[data-testid='abc']");

        expect(window.document.activeElement).toEqual(focusableEl);
    });

    test('Element with tabindex="-1" is not focused', () => {
        const popup = new Popup({closeButton: true})
            .setHTML('<span tabindex="-1" data-testid="abc">Test</span>')
            .setLngLat([0, 0])
            .addTo(createMap());

        const nonFocusableEl = popup._container.querySelector("[data-testid='abc']");
        const closeButton = popup._container.querySelector("button[aria-label='Close popup']");

        expect(window.document.activeElement).not.toEqual(nonFocusableEl);
        expect(window.document.activeElement).toEqual(closeButton);
    });

    test(
        'If popup contains a disabled button and a focusable element then the latter is focused',
        () => {
            const popup = new Popup({closeButton: true})
                .setHTML(`
                    <button disabled>No focus here</button>
                    <select data-testid="abc">
                        <option value="1">1</option>
                        <option value="2">2</option>
                    </select>
                `)
                .setLngLat([0, 0])
                .addTo(createMap());

            const focusableEl = popup._container.querySelector("[data-testid='abc']");

            expect(window.document.activeElement).toEqual(focusableEl);
        }
    );

    test('Popup with disabled focusing does not change the active element', () => {
        const dummyFocusedEl = window.document.createElement('button');
        window.document.body.appendChild(dummyFocusedEl);
        dummyFocusedEl.focus();

        new Popup({closeButton: false, focusAfterOpen: false})
            .setHTML('<span tabindex="0" data-testid="abc">Test</span>')
            .setLngLat([0, 0])
            .addTo(createMap());

        expect(window.document.activeElement).toEqual(dummyFocusedEl);
    });
});
