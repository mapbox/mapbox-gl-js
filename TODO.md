done
X element buffers to reduce memory overhead
X automatic buffer enlarging
X polygon tesselation
  X glutess
X render vector tiles a lot larger, at least 512px minimum size per vector tile
X remember location in hash
X styling
  X when adding features to the buffer, remember the offsets we write them add


todo
- split up large tiles into multiple vertex/index buffers
- move tile loading + tesselation + buffer generation to separate thread
- resolve flicker issue, tile removal during some zooms
- handle canvas size change

- https://code.google.com/p/glyphy/
- https://code.google.com/p/freetype-gl/
- http://bytewrangler.blogspot.com/2011/10/signed-distance-fields.html
- http://i11www.iti.uni-karlsruhe.de/~awolff/map-labeling/bibliography/maplab_date.html
