'use strict';

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
