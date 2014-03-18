'use strict';


// jshint -W079
var Navigation = module.exports = function(map) {
    if (map) this.onAdd(map);
};

Navigation.prototype = {
    onAdd: function(map) {
        this._map = map;

        this._container = ce('div', 'map-zoom-control');
        this._northButton = this._container.appendChild(ce('a', 'north-button'));
        this._zoomInButton = this._container.appendChild(ce('a', 'zoom-in-button'));
        this._zoomOutButton = this._container.appendChild(ce('a', 'zoom-out-button'));

        this._zoomInButton.addEventListener('click', function() {
            map.zoomTo(map.transform.zoom + 1);
        });

        this._zoomOutButton.addEventListener('click', function() {
            map.zoomTo(map.transform.zoom - 1);
        });

        this._northButton.addEventListener('click', function() {
            map.resetNorth();
        });

        var northCanvas = this._northButton.appendChild(ce('canvas', 'north-button-canvas'));
        northCanvas.style.cssText = 'width:26px;height:26px;';
        northCanvas.width = 26 * 2;
        northCanvas.height = 26 * 2;
        var northCtx = northCanvas.getContext('2d');

        this._map.on('rotation', drawNorth);
        var rad = 6 * 2;
        var center = 12 * 2;

        function drawNorth() {
            var angle = map.transform.angle + (Math.PI / 2);
            northCanvas.width = northCanvas.width;

            northCtx.lineWidth = 3;

            northCtx.beginPath();
            northCtx.strokeStyle = '#000';
            northCtx.moveTo(center, center);
            northCtx.lineTo(center - (Math.cos(angle) * rad),
                            center - (Math.sin(angle) * rad));
            northCtx.stroke();

            northCtx.beginPath();
            northCtx.strokeStyle = '#aaa';
            northCtx.moveTo(center, center);
            northCtx.lineTo(center + (Math.cos(angle) * rad),
                            center + (Math.sin(angle) * rad));
            northCtx.stroke();

            northCtx.beginPath();
            northCtx.strokeStyle = '#000';
            northCtx.arc(center, center, rad, 0, 2 * Math.PI, false);
            northCtx.stroke();
        }

        drawNorth();

        this._map.container.appendChild(this._container);
    }
};

function ce(_, name) {
    var elem = document.createElement(_);
    elem.className = name;
    return elem;
}
