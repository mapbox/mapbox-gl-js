// Adapted from https://stackoverflow.com/a/47287595/331379
export default (element, deltaY, x, y) => {
    // Disables modern JS features to maintain IE11/ES5 support.
    /* eslint-disable no-var, no-undef, object-shorthand */
    var box = element.getBoundingClientRect();
    var clientX = box.left + (typeof x !== "undefined" ? x : box.width / 2);
    var clientY = box.top + (typeof y !== "undefined" ? y : box.height / 2);
    var target = element.ownerDocument.elementFromPoint(clientX, clientY);

    for (var e = target; e; e = e.parentElement) {
        if (e === element) {
            target.dispatchEvent(
                new MouseEvent("mouseover", {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: clientX,
                    clientY: clientY
                })
            );
            target.dispatchEvent(
                new MouseEvent("mousemove", {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: clientX,
                    clientY: clientY
                })
            );
            target.dispatchEvent(
                new WheelEvent("wheel", {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: clientX,
                    clientY: clientY,
                    deltaY: deltaY
                })
            );
            return null;
        }
    }

    return "Element is not interactable";
};
