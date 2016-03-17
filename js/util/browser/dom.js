'use strict';

var Point = require('point-geometry');

exports.create = function (tagName, className, container) {
    var el = document.createElement(tagName);
    if (className) el.className = className;
    if (container) container.appendChild(el);
    return el;
};

var docStyle = document.documentElement.style;

function testProp(props) {
    for (var i = 0; i < props.length; i++) {
        if (props[i] in docStyle) {
            return props[i];
        }
    }
}

var selectProp = testProp(['userSelect', 'MozUserSelect', 'WebkitUserSelect', 'msUserSelect']),
    userSelect;
exports.disableDrag = function () {
    if (selectProp) {
        userSelect = docStyle[selectProp];
        docStyle[selectProp] = 'none';
    }
};
exports.enableDrag = function () {
    if (selectProp) {
        docStyle[selectProp] = userSelect;
    }
};

var transformProp = testProp(['transform', 'WebkitTransform']);
exports.setTransform = function(el, value) {
    el.style[transformProp] = value;
};

// Suppress the next click, but only if it's immediate.
function suppressClick(e) {
    e.preventDefault();
    e.stopPropagation();
    window.removeEventListener('click', suppressClick, true);
}
exports.suppressClick = function() {
    window.addEventListener('click', suppressClick, true);
    window.setTimeout(function() {
        window.removeEventListener('click', suppressClick, true);
    }, 0);
};

exports.mousePos = function (el, e) {
    var rect = el.getBoundingClientRect();
    e = e.touches ? e.touches[0] : e;
    return new Point(
        e.clientX - rect.left - el.clientLeft,
        e.clientY - rect.top - el.clientTop
    );
};

exports.touchPos = function (el, e) {
    var rect = el.getBoundingClientRect(),
        points = [];
    for (var i = 0; i < e.touches.length; i++) {
        points.push(new Point(
            e.touches[i].clientX - rect.left - el.clientLeft,
            e.touches[i].clientY - rect.top - el.clientTop
        ));
    }
    return points;
};
