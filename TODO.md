done
X element buffers to reduce memory overhead
X automatic buffer enlarging
X polygon tesselation
  X glutess
X render vector tiles a lot larger, at least 512px minimum size per vector tile
X remember location in hash
X styling
  X when adding features to the buffer, remember the offsets we write them add


- reduce vector tile size. they're insanely large. like 20x larger than oscim tiles

todo
- split up large tiles into multiple vertex/index buffers
- move tile loading + buffer generation to separate thread
- resolve flicker issue, tile removal during some zooms
- handle canvas size change

- https://code.google.com/p/glyphy/
- https://code.google.com/p/freetype-gl/
- http://bytewrangler.blogspot.com/2011/10/signed-distance-fields.html
- http://i11www.iti.uni-karlsruhe.de/~awolff/map-labeling/bibliography/maplab_date.html



approaches:
- 2d canvas overlay: frame rate goes down
  - not because 2d drawing is too slow (it isn't), but because it gets more
    expensive to composite layers


- when drawing the labels layer, *don't* confine it to the tile viewport
  - rather, set the viewport to the entire canvas
  - use a uniform to pass in an offset to add to all 