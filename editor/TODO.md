
X add background color
X show temporary highlight while selecting new data
X add flashing feature highlight when mousing over a layer
X temporarily hide layers
X add persistence
X support multiple styles/switching between styles
X show feature counts on layer view
X when deleting a layer, check whether the bucket is still in use; if not, delete it
X name layers as "bucketname - optional name"
X add new data
  X select tile layer
  X filter by value (string matching)
  X show taginfo stats
    X update them while the user pans around
X Don't allow users to select the same bucket again -- if they want to use the same bucket, use the clone feature
X pois
  X allow selecting an icon
X enable/disable the feature
X add reset north compass
X allow editing the "optional name"
X ability to switch bucket type

- change line width
- change fill antialiasing

- composited layers
- text
- click on features on the map to highlight the layer
  - use feature bitmaps?
- fadein/fadeout depending on zoom level
- zoom level dependent colors
- filter data by number ranges!

- undo/redo support
- duplicate entire style
  - diverging styles

- add more color operations (darken); dependent colors
- add color palette
- add opacity control

- dependent parameters
  - change line width dependent on other, connected line(s)
  - line with = <other line width> + 1
  - color = operation(<other color>)      operation = darken(%), lighten(%)

- duplicate layer
- allow editing buckets
	- line caps/joins

- "loupe" that displays a circle around the mouse cursor which shows
  all the data according to the stored type. If you click, we'll open a list
  of all features that are in the vicinity of the mouse click.
- generate a "default" stylesheet based on the vector stats.
