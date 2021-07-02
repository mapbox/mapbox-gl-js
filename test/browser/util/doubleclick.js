// Simulates a double click. Unfortunately, Safari doesn't properly recognize double
// clicks when sent as two subsequent clicks via the WebDriver API. Therefore, we'll
// manually dispatch a double click event for a particular location.

// Adapted from https://stackoverflow.com/a/47287595/331379
export default (element, x, y) => {
    // Disables modern JS features to maintain IE11/ES5 support.
    /* eslint-disable no-var, no-undef, object-shorthand */
    var box = element.getBoundingClientRect();
    var clientX = box.left + (typeof x !== "undefined" ? x : box.width / 2);
    var clientY = box.top + (typeof y !== "undefined" ? y : box.height / 2);
    var target = element.ownerDocument.elementFromPoint(clientX, clientY);

    for (var e = target; e; e = e.parentElement) {
        if (e === element) {
            target.dispatchEvent(
                new MouseEvent("dblclick", {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: clientX,
                    clientY: clientY
                })
            );
            return null;
        }
    }

    return "Element is not interactable";
};
