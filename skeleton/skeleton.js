function skeleton(polygon, maxDistance, outsideDistance) {
    const outputEdges = [];
    const outputPolygons = [];

    let intersections = [];
    const copy = linkPolygon(clonePolygon(polygon));
    addEdges(copy, []);
    const polygon1 = linkPolygon(clonePolygon(polygon));
    addEdges(polygon1, intersections);
    makeSkeleton(polygon1, intersections, outputEdges, outputPolygons, maxDistance, true, copy);

    intersections = [];
    const polygon2 = linkPolygon(clonePolygon(polygon.reverse()));
    addEdges(polygon2, intersections);
    makeSkeleton(polygon2, intersections, outputEdges, outputPolygons, outsideDistance, false, copy);

    //drawOutputPoly(outputPolygons);
    //drawOutput(outputEdges);

    const out = triangulate(outputPolygons);
    out.edges = outputEdges;
    return out;
}


function triangulate(polygons) {
    const out = [];
    for (const polygon of polygons) {
        const f = polygon.inside ? 1 : -1;
        const flat = [];
        for (const p of polygon) {
            flat.push(p.x, p.y, f * p.distanceToEdge);
        }
        out.push({
            original: polygon,
            flat: flat,
            indices: earcut(flat, undefined, 3)
        });
    }
    return out;
}

function build(p, next, prev, inside) {
    const left = [p];
    const right = [];

    do {
        left.push(next);
        next = next.skelPrev;
    } while (next);

    do {
        right.push(prev);
        prev = prev.skelNext;
    } while (prev);

    left.reverse();
    const a = right.concat(left);

    a.inside = inside;
    return a;
}
    
function makeSkeleton(polygon, intersections, outputEdges, outputPolygons, maxDistance, inside, copy) {

    const allVertices = [];
    forEachVertex(polygon, (v) => {
        allVertices.push(v);
    });

    let i = closestIntersection(intersections);


    while (i && i.distanceToEdge <= maxDistance) {
        console.log("---", findClosest(copy, i));

        let a = i.prev;
        let b = i.next;
        let c = i.next.next;

        if (i.splitEvent) {
            // some split events are actually edge events
            // but due to bisectors going the opposite direction or parallel lines they never get created
            if (i.third === i.next.next) {
                i.prev = i.next;
                i.next = i.third;
                i.splitEvent = false;
            } else if (i.third === i.prev.prev) {
                i.next = i.prev;
                i.prev = i.third;
                i.splitEvent = false;
            }
        }

        if (i.prev.prev === i.next.next) {
            console.log("PEAK", i.label, c.label, i.distanceToEdge);
            outputEdges.push([a, i]);
            outputEdges.push([b, i]);
            outputEdges.push([c, i]);
            outputPolygons.push(build(i, b, a, inside));
            outputPolygons.push(build(i, c, b, inside));
            outputPolygons.push(build(i, a, c, inside));
            /*
            */
            a.used = true;
            b.used = true;
            c.used = true;

            // end
        } else {

            if (i.splitEvent) {
                console.log("SPLIT", i.label, i.distanceToEdge);

                const edge = i.next.e1;
                const edgePoint = closestPoint(i, edge);

                i.third.used = true;
                edge.splitVersion++;
                outputEdges.push([i.third, i]);

                const p1 = i.clone();
                p1.label = i.label + 'A';
                p1.prev = i.third.prev;
                p1.next = i.next;
                p1.prev.next = p1;
                p1.next.prev = p1;
                p1.e1 = p1.prev.e2;
                p1.e2 = p1.next.e1;
                p1.skelPrev = i.third;
                p1.skelNext = edgePoint;
                p1.distanceToEdge = i.distanceToEdge;
                addBisector(p1);
                addNearestIntersection(intersections, p1);
                addEdgeIntersections(intersections, p1, p1.next, p1.e2);

                const p2 = i.clone();
                p2.label = i.label + 'B';
                p2.prev = i.prev;
                p2.next = i.third.next;
                p2.prev.next = p2;
                p2.next.prev = p2;
                p2.e1 = p2.prev.e2;
                p2.e2 = p2.next.e1;
                p2.skelNext = i.third;
                p2.skelPrev = edgePoint;
                p2.distanceToEdge = i.distanceToEdge;
                addBisector(p2);
                addNearestIntersection(intersections, p2, true);
                addEdgeIntersections(intersections, p2.prev, p2, p2.e1);

                allVertices.push(p1, p2);

            } else {
                console.log("EDGE", i.label, i.distanceToEdge);
                i.prev.used = true;
                i.next.used = true;

                outputEdges.push([i.prev, i]);
                outputEdges.push([i.next, i]);
                outputPolygons.push(build(i, i.next, i.prev, inside));

                const p = i.clone();
                p.label = i.label;
                p.skelPrev = i.prev;
                p.skelNext = i.next;
                p.prev = i.prev.prev;
                p.next = i.next.next;
                p.prev.next = p;
                p.next.prev = p;
                p.distanceToEdge = i.distanceToEdge;

                p.e1 = p.prev.e2;
                p.e2 = p.next.e1;

                addBisector(p);
                addNearestIntersection(intersections, p);

                addEdgeIntersections(intersections, p.prev, p, p.e1);
                addEdgeIntersections(intersections, p, p.next, p.e2);

                allVertices.push(p);
            }
        }
        i = closestIntersection(intersections);
    }


    for (const v of allVertices) {
        if (v.used) continue;

        const internal = [];
        internal.inside = inside;
        forEachVertex(v, (p) => {
            p.used = true;
            const d = p.distanceToEdge || 0;
            const factor = Math.sqrt(distToSegmentSquared(p.add(p.bisector), p.e1.v1, p.e1.v2)) - d;
            const newPoint = p.add(p.bisector.mult((maxDistance - d) / factor));
            newPoint.skelPrev = p;
            newPoint.skelNext = p;
            newPoint.distanceToEdge = maxDistance;
            console.log(maxDistance, 'asdf');
            internal.push(newPoint);
        });

        for (let i = 0; i < internal.length; i++) {
            let p = internal[i];
            let next = internal[(i + 1) % internal.length];
            outputPolygons.push(build(p, next, p.skelPrev, inside));
        }
        console.log(internal);
        if (inside) outputPolygons.push(internal);
    }
    /*
    */
}


function Edge(v1, v2) {
    this.v1 = v1;
    this.v2 = v2;
    this.label = v1.label + '-' + v2.label;
    this.splitVersion = 0;
    //this.intersection = intersection(v1, v2);
}

function closestIntersection(intersections) {
    intersections.sort((a, b) => a.distanceToEdge - b.distanceToEdge);

    let closest;
    do {
        closest = intersections.shift();
        if (closest) console.log('closest', closest.label, closest.distanceToEdge, closest.x, closest.y);
    } while (closest && (closest.prev.used || closest.next.used || (closest.third && closest.third.used) || (closest.splitEvent && closest.next.e1.splitVersion !== closest.splitVersion)));

    return closest;
}

function rayRayIntersection(p1, vec1, p2, vec2) {
    const d = p2.sub(p1);
    const det = vec2.x * vec1.y - vec2.y * vec1.x;
    const u = (d.y * vec2.x - d.x * vec2.y) / det;
    const v = (d.y * vec1.x - d.x * vec1.y) / det;

    if (det === 0) {
        return null;
    }
    if (u < 0 || v < 0) {
        return null;
    }

    const p = p1.add(vec1.mult(u));
    return p;
}

function addEdgeIntersections(intersections, v1, v2, edge) {
    forEachVertex(v1, (p) => {
        if (p === v1 || p === v2) return;
        //if (p.prev === v2 || p.next === v1) return;
        if ((p.prev === v2 && v2.bisector.mag()) || (p.next === v1 && v1.bisector.mag())) return;
        if (!p.isReflex) return;

        const i = edgeIntersectionPoint(p, v1, v2, edge);
        if (i) intersections.push(i);
        if (p.label === '9') {
        }
    });
}

function addNearestIntersection(intersections, p, debug) {
    const a = bisectorIntersectionPoint(p.prev, p, p.e1);
    let nearest = a;
    const b = bisectorIntersectionPoint(p, p.next, p.e2);
    if (b && (!nearest || nearest.distanceToEdge > b.distanceToEdge)) {
        nearest = b;
    }

    if (p.isReflex) {
        forEachVertex(p.next.next.next, function(v1) {
            const v2 = v1.next;
            if (p === v1 || p === v2) return;
            if (p.prev === v2 || p.next === v1) return;

            const edge = v1.e2;
            if (v2.e1 !== edge) throw 'expected';

            const i = edgeIntersectionPoint(p, v1, v2, edge);
            if (i && (!nearest || nearest.distanceToEdge > i.distanceToEdge)) {
                nearest = i;
            }
            if (p.label === '9' && edge.label === '5-6') {
            }
        });
    }

    if (debug) console.log("ADDING", nearest);
    if (debug) {
        console.log(p.label, p.prev.label, p.e1.label, p);
    }
    if (nearest) {
        intersections.push(nearest);
    }
}

function bisectorIntersectionPoint(v1, v2, edge) {
    const p = rayRayIntersection(v1, v1.bisector, v2, v2.bisector);
    if (!p) return null;

    p.distanceToEdge = Math.sqrt(distToSegmentSquared(p, edge.v1, edge.v2));

    p.isIntersection = true;
    p.prev = v1;
    p.next = v2;
    p.label = '[' + p.prev.label + ',' + p.next.label + ']';
    p.splitEvent = false;

    if (isNaN(p.x) || isNaN(p.y)) {
        console.log('failing', v1.label, v2.label, edge.label);
        return null;
    }

    return p;
}

function rayLineIntersection(v, ray, edge) {
    const b1 = ray;
    const b2 = edge.v2.sub(edge.v1);
    const d = edge.v1.sub(v);

    const det = b2.x * b1.y - b2.y * b1.x;
    const u = (d.y * b2.x - d.x * b2.y) / det;

    if (det === 0 || u < 0) {
        return null;
    }
    return v.add(ray.mult(u));
}

function lineIntersectionPoint(v, edge, debug) {
    if (!rayLineIntersection(v, v.bisector, edge)) {
        if (debug) console.log("nope");
        return null;
    }

    // find the point on the line
    let eVector = v.e1.v2.sub(v.e1.v1);
    let edgeLineIntersection = rayLineIntersection(v, eVector, edge);
    let edgeVector = edge.v2.sub(edge.v1);

    if (!edgeLineIntersection) {
        eVector = v.e2.v1.sub(v.e2.v2);
        edgeLineIntersection = rayLineIntersection(v, eVector, edge);
        edgeVector = edge.v1.sub(edge.v2);
    }

    // find the vector from that point
    const edgeIntersectionBisector = edgeVector.unit().add(eVector.mult(-1).unit());

    return rayRayIntersection(v, v.bisector, edgeLineIntersection, edgeIntersectionBisector);
}

function dot(vec1, vec2) {
    return vec1.x * vec2.x + vec1.y * vec2.y;
}
function edgeIntersectionPoint(v, v1, v2, edge) {
    const debug = edge.label === '-0';
    const i = lineIntersectionPoint(v, edge, debug);
    if (debug) console.log("calculating for", v.label, v1.label, v2.label);

    if (!i) {
        if (debug) console.log("RETURN");
        return null;
    }

    // check if it is between the bisectors
    const edgeVector = edge.v2.sub(edge.v1);

    if (dot(v1.bisector, edgeVector) > dot(i.sub(v1).unit(), edgeVector)) {
        if (debug) console.log("RETURN not within a");
        return null;
    }

    if (dot(v2.bisector, edgeVector) < dot(i.sub(v2).unit(), edgeVector)) {
        if (debug) console.log("RETURN not within b");
        return null;
    }


    i.distanceToEdge = Math.sqrt(distToSegmentSquared(i, edge.v1, edge.v2));
    i.prev = v1;
    i.next = v2;
    i.third = v;
    i.label = '[' + i.prev.label + ',' + i.next.label + ',' + i.third.label + ']';
    i.isIntersection = true;
    i.splitEvent = true;
    i.splitVersion = edge.splitVersion;
    i.edge = edge;
    if (debug) {
        console.log("intersection point", edge.label, i);
    }

    return i;
}

function addEdges(polygon, intersections) {
    forEachVertex(polygon, (v1) => {
        const edge = new Edge(v1, v1.next);
        v1.e2 = edge;
        v1.next.e1 = edge;
    });
    forEachVertex(polygon, (p) => {
        addBisector(p);
    });
    forEachVertex(polygon, (p) => {
        addNearestIntersection(intersections, p);
    });
}

function forEachVertex(polygon, fn) {
    let i = 0;
    let p = polygon;
    do {
        fn(p);
        p = p.next;
        i++;
        if (i > 10000) throw 'no';
    } while (p !== polygon);
}

function clonePolygon(polygon) {
    return polygon.map((p) => p.clone());
}

function linkPolygon(polygon) {
    for (let i = 0; i < polygon.length; i++) {
        const p = polygon[i];
        p.next = polygon[(i + 1) % polygon.length];
        p.prev = polygon[(i - 1 + polygon.length) % polygon.length];
        p.label = String(i);
    }
    return polygon[0];
}

function addBisector(p) {
    const e1 = p.e1;
    const e2 = p.e2;
    const n1 = e1.v2.sub(e1.v1).unit();
    const n2 = e2.v2.sub(e2.v1).unit();
    p.bisector = n1.add(n2).perp().unit();
    p.isReflex = dot(n1.perp(), n2) < 0;
    //console.log(p.label);
    if (p.label === '[5,6]') {
        //console.log('!!!', p.label, p.bisector);
    }
    if (p.label === '[[2,3],4],[5,6]]' || p.label === '[[2,3],4]' || p.label === '[[5,6],0]') {
        //console.log(p.label, p.bisector);
        //p.bisector._mult(-1);
    }

    if (p.label === '9') {
    }
        //drawRay(p, p.bisector, -20);
        drawRay(p, p.bisector, 70);
    if (isNaN(p.bisector.x) || isNaN(p.bisector.y)) {
        console.log(p.label, 'asdfasdf');
        if (p.label === '[6,[7,8]]') {
        //    p.bisector = n2;
        }
    }
}

function distToSegmentSquared(p, v, w) {
    const l2 = v.distSqr(w);
    //if (l2 === 0) return p.distSqr(v);
    const t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    //if (t < 0) return p.distSqr(v);
    //if (t > 1) return p.distSqr(w);
    return p.distSqr(w.sub(v)._mult(t)._add(v));
}

function findClosest(polygon, p) {
    const fudge = 0.00001;
    const results = [];
    forEachVertex(polygon, (v) => {
        const d = distToSegment(p, v.e1.v1, v.e1.v2);
        if (p.distanceToEdge + fudge > d) {
            results.push([v.e1.label, d]);
        }
    });
    return results;
}

function distToSegment(p, v, w) {
    return Math.sqrt(distToSegmentSquared(p, v, w));
}

function toArray(polygon) {
    const arr = [];
    forEachVertex(polygon, (p) => {
        arr.push(p);
    });
    return arr;
}

function closestPoint(i, edge) {
    const v = edge.v1;
    const w = edge.v2;
    const p = i;
    const l2 = v.distSqr(w);
    if (l2 === 0) return v;//p.distSqr(v);
    const t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    if (t < 0) return v;//p.distSqr(v);
    if (t > 1) return w;//p.distSqr(w);
    return w.sub(v)._mult(t)._add(v);
/*
    const vector = edge.v2.sub(edge.v1).perp().mult(-1);
    const closest = rayLineIntersection(i, vector, edge);
    const dist = closest.dist(i);
    if (edge.v1.dist(i) < dist)
    */
}
