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
