
X add background color
X show temporary highlight while selecting new data
X add flashing feature highlight when mousing over a layer
X temporarily hide layers
X add persistence
X support multiple styles/switching between styles
X show feature counts on layer view

- add new data
  - select tile layer
  - filter by value (string matching, number ranges!)
  - show taginfo stats
    - update them while the user pans around

- composited layers
- line caps/joins
- pois
- text
- click on features on the map to highlight the layer
  - use feature bitmaps?
- duplicate layer
- add reset north compass
- enable/disable the feature
- fadein/fadeout depending on zoom level
- zoom level dependent colors

- restore the unparsed style
- undo/redo support
- duplicate entire style
  - diverging styles

- add more color operations (darken); dependent colors
- add color palette
- add opacity control


- rebuild interface with [angular | ember | backbone]
- dependent parameters
  - change line width dependent on other, connected line(s)
  - line with = <other line width> + 1
  - color = operation(<other color>)      operation = darken(%), lighten(%)

- when deleting a layer, check whether the bucket is still in use; if not, delete it
- Don't allow users to select the same bucket again -- if they want to use the same bucket, use the clone feature
- name layers as "bucketname - optional name"
  - allow editing the "optional name"
- allow editing buckets
