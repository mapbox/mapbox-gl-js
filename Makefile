JS_FILES = $(shell find js -name '*.js')

dist/mapbox-gl-dev.js: $(JS_FILES) package.json
	browserify -d js/mapbox-gl.js --standalone mapboxgl > dist/mapbox-gl-dev.js

dist/mapbox-gl.js: $(JS_FILES) package.json
	browserify js/mapbox-gl.js --debug --transform unassertify --plugin [minifyify --map mapbox-gl.js.map --output dist/mapbox-gl.js.map] --standalone mapboxgl > dist/mapbox-gl.js

docs/api/index.html: $(JS_FILES) documentation.yml node_modules/.bin/documentation
	documentation build --github --format html -c documentation.yml --theme ./docs/_theme --output docs/api/

bench/data/naturalearth-land.json:
	mkdir -p ./bench/data
	curl -s https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_land.geojson > ./bench/data/naturalearth-land.json
