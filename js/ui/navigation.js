'use strict';


// jshint -W079
var Navigation = module.exports = function(map) {
    if (map) this.onAdd(map);
};

Navigation.prototype = {
    onAdd: function(map) {
        this._map = map;

        var className = 'mapboxgl-zoom-ctrl';

        this._container = ce('div', className);
        this._northButton = this._container.appendChild(ce('a', className + '-north-btn'));
        this._zoomInButton = this._container.appendChild(ce('a', className + '-zoom-in-btn'));
        this._zoomOutButton = this._container.appendChild(ce('a', className + '-zoom-out-btn'));

        this._northButton.href = this._zoomInButton.href = this._zoomOutButton.href = '#';

        this._zoomInButton.onclick = function() {
            map.zoomTo(map.transform.zoom + 1);
            return false;
        };

        this._zoomOutButton.onclick = function() {
            map.zoomTo(map.transform.zoom - 1);
            return false;
        };

        this._northButton.onclick = function() {
            map.resetNorth();
            return false;
        };

        var northCanvas = this._northButton.appendChild(ce('canvas', className + '-north-btn-canvas'));
        northCanvas.style.cssText = 'width:26px;height:26px;';
        northCanvas.width = 26 * 2;
        northCanvas.height = 26 * 2;
        var northCtx = northCanvas.getContext('2d');

        this._map.on('rotation', drawNorth);
        var rad = 9 * 2;
        var width = rad / 2.3;
        var center = 12 * 2;

        function drawNorth() {
            var angle = map.transform.angle + (Math.PI / 2);
            northCanvas.width = northCanvas.width;

            northCtx.beginPath();
            northCtx.fillStyle = '#000';
            northCtx.moveTo(center, center);
            northCtx.lineTo(
                center - (Math.cos(angle + (Math.PI / 2)) * width),
                center - (Math.sin(angle + (Math.PI / 2)) * width));
            northCtx.lineTo(
                center - (Math.cos(angle) * rad),
                center - (Math.sin(angle) * rad));
            northCtx.lineTo(
                center - (Math.cos(angle - (Math.PI / 2)) * width),
                center - (Math.sin(angle - (Math.PI / 2)) * width));
            northCtx.fill();

            northCtx.beginPath();
            northCtx.fillStyle = '#bbb';
            northCtx.moveTo(center, center);
            northCtx.lineTo(
                center + (Math.cos(angle + (Math.PI / 2)) * width),
                center + (Math.sin(angle + (Math.PI / 2)) * width));
            northCtx.lineTo(
                center + (Math.cos(angle) * rad),
                center + (Math.sin(angle) * rad));
            northCtx.lineTo(
                center + (Math.cos(angle - (Math.PI / 2)) * width),
                center + (Math.sin(angle - (Math.PI / 2)) * width));
            northCtx.fill();

            northCtx.beginPath();
            northCtx.strokeStyle = '#fff';
            northCtx.lineWidth = 4;
            northCtx.moveTo(
                center + (Math.cos(angle - (Math.PI / 2)) * width),
                center + (Math.sin(angle - (Math.PI / 2)) * width));
            northCtx.lineTo(
                center + (Math.cos(angle + (Math.PI / 2)) * width),
                center + (Math.sin(angle + (Math.PI / 2)) * width));
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
