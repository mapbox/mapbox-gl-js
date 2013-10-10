/*
 * Construct a line geometry that contains a vertex and fill
 * buffer and can be drawn using `addLine`
 */
function LineGeometry() {
    this.bufferIndex = -1;

    this.buffers = [];

    this.vertex = null;
    this.fill = null;

    this.swapBuffers(0);
}

/*
 * Given a desired vertexCount to be available in the vertex buffer,
 * swap the existing buffer if needed for new vertex and fill buffers.
 *
 * @param {number} vertexCount
 */
LineGeometry.prototype.swapBuffers = function(vertexCount) {
    if (!this.vertex || this.vertex.index + vertexCount >= 65536) {
        this.vertex = new VertexBuffer();
        this.fill = new FillBuffer();
        this.buffers.push({ vertex: this.vertex, fill: this.fill });
        this.bufferIndex++;
    }
};

LineGeometry.prototype.addMarkers = function(vertices, spacing) {

    var distance = 0;
    var markedDistance = 0;

    for (var i = 0; i < vertices.length - 1; i++) {
        var segmentDist = dist(vertices[i], vertices[i+1]);
        var slope = unit(vectorSub(vertices[i+1], vertices[i]));

        while (markedDistance + spacing < distance + segmentDist) {
            markedDistance += spacing;
            var segmentInterp = (markedDistance - distance)/ segmentDist;
            var point = {
                x: interp(vertices[i].x, vertices[i+1].x, segmentInterp),
                y: interp(vertices[i].y, vertices[i+1].y, segmentInterp)
            };

            this.swapBuffers(1);
            this.vertex.add(point.x, point.y, slope.x, slope.y, 0, 0);

        }

        distance += segmentDist;
    }
};

LineGeometry.prototype.addLine = function(vertices, join, cap, miterLimit, roundLimit) {
    if (typeof join === 'undefined') join = 'miter';
    if (typeof cap === 'undefined') cap = 'butt';
    if (typeof miterLimit === 'undefined') miterLimit = 2;
    if (typeof roundLimit === 'undefined') roundLimit = 1;

    if (vertices.length < 1) {
        alert('a line must have at least one vertex');
        return;
    }

    // Point
    if (vertices.length === 1) {
        var point = vertices[0];
        this.swapBuffers(1);
        this.vertex.add(point.x, point.y, 1, 0, 0, 0);
        return;
    }

    var firstVertex = vertices[0];
    var lastVertex = vertices[vertices.length - 1];
    var closed = firstVertex.x == lastVertex.x && firstVertex.y == lastVertex.y;

    if (vertices.length == 2 && closed) {
        // alert('a line may not have coincident points');
        return;
    }

    var beginCap = cap;
    var endCap = closed ? 'butt' : cap;

    // Calculate the total number of vertices we're going to produce so that we
    // can resize the buffer beforehand, or detect whether the current line won't
    // fit into the buffer anymore.
    // Original array holds two components per vertex, but we're duplicating all
    // vertices to achieve the tessellation.
    // For round line joins, this sometimes overestimates the number of required
    // vertices because even when requesting round line joins, we don't render
    // round line joins for angles that are very obtuse.
    var vertexCount = (vertices.length) * 2;
    vertexCount++; // degenerate vertex at the beginning.
    if (join == 'round') {
        vertexCount += vertices.length * 5; // (4 end cap + 1 degenerate)
        if (!closed) vertexCount -= 10;
    }
    if (!closed) {
        if (beginCap == 'round') vertexCount += 2;
        if (endCap == 'round') vertexCount += 2;
    }

    // Check whether this geometry buffer can hold all the required vertices.
    this.swapBuffers(vertexCount);

    var currentVertex = null, prevVertex = null, nextVertex = null;
    var prevNormal = null, nextNormal = null;
    var firstIndex = null, prevIndex = null, currentIndex = null;
    var flip = 1;
    var distance = 0;

    if (closed) {
        currentVertex = vertices[vertices.length - 2];
        nextNormal = normal(currentVertex, lastVertex);
    }

    // Start all lines with a degenerate vertex
    this.vertex.addDegenerate();

    firstIndex = this.vertex.index;

    for (var i = 0; i < vertices.length; i++) {
        if (nextNormal) prevNormal = { x: -nextNormal.x, y: -nextNormal.y };
        if (currentVertex) prevVertex = currentVertex;

        currentVertex = vertices[i];

        if (currentVertex && prevVertex) distance += dist(currentVertex, prevVertex);

        // Find the next vertex.
        if (i + 1 < vertices.length) {
            nextVertex = vertices[i + 1];
        } else {
            nextVertex = null;
        }

        var segment = false;

        if (closed && i >= 2 && (i + 1 < vertices.length)) {
            segment = true;
        }

        // If the line is closed, we treat the last vertex like the first vertex.
        if (!nextVertex && closed) {
            nextVertex = vertices[1];
        }

        // Calculate the normal towards the next vertex in this line. In case
        // there is no next vertex, pretend that the line is continuing straight,
        // meaning that we are just reversing the previous normal
        if (nextVertex) {
            nextNormal = normal(currentVertex, nextVertex);
        } else {
            nextNormal = { x: -prevNormal.x, y: -prevNormal.y };
        }

        // If we still don't have a previous normal, this is the beginning of a
        // non-closed line, so we're doing a straight "join".
        if (!prevNormal) {
            prevNormal = { x: -nextNormal.x, y: -nextNormal.y };
        }

        // Determine the normal of the join extrusion. It is the angle bisector
        // of the segments between the previous line and the next line.
        var joinNormal = {
            x: prevNormal.x + nextNormal.x,
            y: prevNormal.y + nextNormal.y
        };

        // Cross product yields 0..1 depending on whether they are parallel
        // or perpendicular.
        var joinAngularity = nextNormal.x * joinNormal.y - nextNormal.y * joinNormal.x;
        joinNormal.x /= joinAngularity;
        joinNormal.y /= joinAngularity;
        var roundness = Math.max(Math.abs(joinNormal.x), Math.abs(joinNormal.y));


        var roundJoin = false;
        // Determine whether we should actually draw a round line join. It looks
        // better if we do, but we can get away with drawing a mitered join for
        // joins that have a very small angle. For this, we have the "roundLimit"
        // parameter. We do this to reduce the number of vertices we have to
        // write into the line vertex buffer. Note that joinAngularity may be 0,
        // so the roundness grows to infinity. This is intended.
        if (join == 'round' && roundness > roundLimit) {
            roundJoin = true;
        }

        // Close up the previous line for a round join
        if (roundJoin && prevVertex && nextVertex) {
            // Add first vertex
            this.vertex.add(currentVertex.x, currentVertex.y, // vertex pos
                      flip * prevNormal.y, -flip * prevNormal.x, // extrude normal
                      0, 0, distance); // texture normal

            // Add second vertex.
            this.vertex.add(currentVertex.x, currentVertex.y, // vertex pos
                      -flip * prevNormal.y, flip * prevNormal.x, // extrude normal
                      0, 1, distance); // texture normal

            // Degenerate triangle
            this.vertex.addDegenerate();

            prevVertex = null;
            prevNormal = { x: -nextNormal.x, y: -nextNormal.y };
            flip = 1;
        }

        // Add a cap.
        if (!prevVertex && (beginCap == 'round' || beginCap == 'square' || roundJoin)) {
            var tex = beginCap == 'round' || roundJoin ? 1 : 0;

            currentIndex = this.vertex.index;

            // Add first vertex
            this.vertex.add(currentVertex.x, currentVertex.y, // vertex pos
                      flip * (prevNormal.x + prevNormal.y), flip * (-prevNormal.x + prevNormal.y), // extrude normal
                      tex, 0, distance); // texture normal

            // Add second vertex
            this.vertex.add(currentVertex.x, currentVertex.y, // vertex pos
                      flip * (prevNormal.x - prevNormal.y), flip * (prevNormal.x + prevNormal.y), // extrude normal
                      tex, 1, distance); // texture normal
        }

        if (roundJoin) {
            // ROUND JOIN
            currentIndex = this.vertex.index;

            // Add first vertex
            this.vertex.add(currentVertex.x, currentVertex.y, // vertex pos
                      -flip * nextNormal.y, flip * nextNormal.x, // extrude normal
                      0, 0, distance); // texture normal

            // Add second vertex
            this.vertex.add(currentVertex.x, currentVertex.y, // vertex pos
                      flip * nextNormal.y, -flip * nextNormal.x, // extrude normal
                      0, 1, distance); // texture normal
        } else if ((nextVertex || endCap != 'square') && (prevVertex || beginCap != 'square')) {
            // MITER JOIN
            if (Math.abs(joinAngularity) < 0.01) {
                // The two normals are almost parallel.
                joinNormal.x = -nextNormal.y;
                joinNormal.y = nextNormal.x;
            } else if (roundness > miterLimit) {
                // If the miter grows too large, flip the direction to make a
                // bevel join.
                joinNormal.x = (prevNormal.x - nextNormal.x) / joinAngularity;
                joinNormal.y = (prevNormal.y - nextNormal.y) / joinAngularity;
                flip = -flip;
            }

            currentIndex = this.vertex.index;

            // Add first vertex
            this.vertex.add(currentVertex.x, currentVertex.y, // vertex pos
                      flip * joinNormal.x, flip * joinNormal.y, // extrude normal
                      0, 0, distance); // texture normal

            // Add second vertex
            this.vertex.add(currentVertex.x, currentVertex.y, // vertex pos
                      -flip * joinNormal.x, -flip * joinNormal.y, // extrude normal
                      0, 1, distance); // texture normal
        }

        // Add the end cap, but only if this vertex is distinct from the begin
        // vertex.
        if (!nextVertex && (endCap == 'round' || endCap == 'square')) {
            var tex = endCap == 'round' ? 1 : 0;

            currentIndex = this.vertex.index;

            // Add first vertex
            this.vertex.add(currentVertex.x, currentVertex.y, // vertex pos
                      nextNormal.x - flip * nextNormal.y, flip * nextNormal.x + nextNormal.y, // extrude normal
                      tex, 0, distance); // texture normal

            // Add second vertex
            this.vertex.add(currentVertex.x, currentVertex.y, // vertex pos
                      nextNormal.x + flip * nextNormal.y, -flip * nextNormal.x + nextNormal.y, // extrude normal
                      tex, 1, distance); // texture normal
        }

        if (closed && segment) {
            this.fill.add(firstIndex, prevIndex, currentIndex);
        }
        prevIndex = currentIndex;
    }
};
