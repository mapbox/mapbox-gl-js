'use strict';

exports.create = function (tagName, className) {
	var el = document.createElement(tagName);
	el.className = className;
	return el;
};
