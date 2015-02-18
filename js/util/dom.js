'use strict';

exports.create = function (tagName, className, container) {
    var el = document.createElement(tagName);
    if (className) el.className = className;
    if (container) container.appendChild(el);
    return el;
};

function preventDefault(e) {
    e.preventDefault();
}

var docEl = typeof document !== 'undefined' ? document.documentElement : {},
    selectProp =
        'userSelect' in docEl ? 'userSelect' :
        'MozUserSelect' in docEl ? 'MozUserSelect' :
        'WebkitUserSelect' in docEl ? 'WebkitUserSelect' : null,
    userSelect;

exports.disableDrag = function () {
    window.addEventListener('dragstart', preventDefault);

    if ('onselectstart' in document) {
        window.addEventListener('selectstart', preventDefault);
    } else if (selectProp) {
        userSelect = docEl.style[selectProp];
        docEl.style[selectProp] = 'none';
    }
};
exports.enableDrag = function () {
    window.removeEventListener('dragstart', preventDefault);

    if ('onselectstart' in document) window.removeEventListener('selectstart', preventDefault);
    else if (selectProp) docEl.style[selectProp] = userSelect;
};

function testProp(props) {
    var style = document.documentElement.style;
    for (var i = 0; i < props.length; i++) {
        if (props[i] in style) {
            return props[i];
        }
    }
}

var transformProp = testProp(['transform', 'WebkitTransform']);
exports.setTransform = function(el, value) {
    el.style[transformProp] = value;
};
