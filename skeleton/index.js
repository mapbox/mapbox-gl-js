var context = document.getElementById('mycanvas').getContext('2d');
earcut = function() {};
context.fillStyle = '#f00';
let x = 0;
let y = 0;

let colours = [];
const n = 14;
for (let i = 0; i < n; i++) {
    colours.push('rgba(' + i * 255 / n +',0,0, 0.5)');
}
colours = [];
for (let i = 0; i < 1000; i++) {
    colours.push('rgba(' + Math.random() * 255 +',' + Math.random() * 255 + ',' + Math.random() * 255 +', 0.5)');
}
drawPolygon(testCases[3]);


let out = skeleton(testCases[3], 4000, 40);
drawOutputPoly(out);
drawOutput(out.edges);

function drawRay(p, vec, n) {
    return;
    context.strokeStyle = '#00f';
    drawLine(p, p.add(vec.mult(n)));
}

function setOrigin(x_, y_) {
    x = x_;
    y = y_;
}

function drawOutputPoly(output) {
    for (let i = 0; i < output.length; i++) {
        context.fillStyle = colours[i % colours.length];
        context.fillOpacity = 0.5;
        drawPolygon(output[i].original);
    }
}

function drawOutput(output) {
    context.strokeStyle = '#fff';
    for (let i = 0; i < output.length; i++) {
        //context.fillStyle = colours[i];
        //drawPolygon(output[i]);
        drawLine(output[i][0], output[i][1]);
    }
}

function drawLine(a, b) {
    return;
    context.beginPath();
    context.moveTo(x + a.x, y + a.y);
    context.lineTo(x + b.x, y + b.y);
    context.closePath();
    context.stroke();
}

function drawRays(polygon) {
    context.strokeStyle = '#000';
    forEachVertex(polygon, (p) => {
        const rayEnd = p.add(p.bisector.mult(100));
        drawLine(p, rayEnd);
    });
}

function drawIntersections(polygon) {
    context.strokeStyle = '#fff';
    forEachVertex(polygon, (p) => {
        const e = p.e2;
        if (!e.intersection) return;
        const start = e.v2.sub(e.v1).mult(0.5).add(e.v1);
        drawLine(start, e.intersection);
    });
}

function drawLinkedPolygon(polygon) {
    context.beginPath();
    let first = true;
    forEachVertex(polygon, (p) => {
        if (first) {
            context.moveTo(x + p.x, y + p.y);
            first = false;
        } else {
            context.lineTo(x + p.x, y + p.y);
        }
    });
    context.closePath();
    context.fill();
}

function drawPolygon(polygon) {
    context.beginPath();
    context.moveTo(x + polygon[0].x, y + polygon[0].y);
    for (let i = 1; i < polygon.length; i++) {
        const p = polygon[i];
        context.lineTo(x + p.x, y + p.y);
    }
    context.closePath();
    context.fill();
}
