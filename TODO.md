todo
- move tile loading + buffer generation to separate thread

approaches:
- 2d canvas overlay: frame rate goes down
  - not because 2d drawing is too slow (it isn't), but because it gets more
    expensive to composite layers

- when drawing the labels layer, *don't* confine it to the tile viewport
  - rather, set the viewport to the entire canvas
  - use a uniform to pass in an offset to add to all
