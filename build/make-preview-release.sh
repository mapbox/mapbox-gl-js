# This script is used to make a preview release of the package.
# It will bump the version to the preview version from CLI argument and then
# run the prepublishOnly script to build the package and publish it on S3.

# Get the next preview version from the arguments
nextVersion=$1

# Print help page if no CLI arguments are passed
if [[ -z $nextVersion ]]; then
  echo "Usage: make-preview-release.sh <version> [--publish]"
  echo "Example: make-preview-release.sh 3.0.0-preview.1"
  echo "Example: make-preview-release.sh 3.0.0-preview.1 --publish"
  exit 1
fi

# Check if the next version is a preview version, e.g. 3.0.0-preview.1
if [[ $nextVersion != *"-preview"* ]]; then
  echo "The next version must be a preview version"
  echo "Example: make-preview-release.sh 3.0.0-preview.1"
  exit 1
fi

# Update the version in package.json and run the prepublishOnly script
npm version $nextVersion --no-git-tag-version
npm run prepublishOnly

# Delete all *.map, *.flow and *-dev.* files in the dist/ folder
find dist/ -type f \( -name "*.map" -o -name "*.flow" -o -name "*-dev.*" \) -delete

# Update package.json inplace using jq to remove everything from the "files" section except dist/
jq '.files = ["dist/"]' package.json > package.json.tmp && mv package.json.tmp package.json

# Create the tarball
npm pack

# Revert the version change
git checkout package.json

# Rename the tarball
mv mapbox-mapbox-gl-private-$nextVersion.tgz mapbox-gl-$nextVersion.tgz
echo "Preview release created: mapbox-gl-$nextVersion.tgz"

# Upload the tarball to S3 if --publish flag is passed
if [[ $2 == "--publish" ]]; then
  echo "Please make sure you are logged into the Mapbox account with 'mbx env'"

  aws s3 cp --content-type "application/gzip" \
    mapbox-gl-$nextVersion.tgz \
    s3://mapbox-api-downloads-production/v2/mapbox-gl-js/releases/other/v$nextVersion/v$nextVersion.tar.gz

  echo "Preview release published: https://api.mapbox.com/downloads/v2/mapbox-gl-js/releases/other/v$nextVersion/v$nextVersion.tar.gz"
fi
