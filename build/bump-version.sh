#!/bin/bash

# A script to bump the version of the main package and the style-spec sub-package.

# Stop script on any error
set -e

# --- Help Documentation ---
show_help() {
    echo "usage: $0 <major|minor|patch> [pre-release-id]"
    echo "Bumps the version of the project and style-spec."
    printf "\n"
    echo "Arguments:"
    echo "  <major|minor|patch>   Required. The type of version bump."
    echo "  [pre-release-id]      Optional. Identifier for a pre-release version (e.g., 'beta', 'rc')."
    printf "\n"
    echo "Examples:"
    echo "  # Stable release: 3.13.0 -> 3.14.0"
    echo "  $0 minor"
    printf "\n"
    echo "  # Start a new pre-release: 3.13.0 -> 3.14.0-beta.1"
    echo "  $0 minor beta"
    printf "\n"
    echo "  # Increment an existing pre-release: 3.14.0-beta.1 -> 3.14.0-beta.2"
    echo "  $0 minor beta"
    printf "\n"
    echo "  # Change pre-release type: 3.14.0-beta.2 -> 3.14.0-rc.1"
    echo "  $0 minor rc"
    printf "\n"
    echo "  # Graduate from pre-release to stable: 3.14.0-rc.1 -> 3.14.0"
    echo "  $0 minor"
    exit 0
}

# --- Argument Parsing and Validation ---

# Show help if requested or no arguments are provided
if [[ "$1" == "--help" || -z "$1" ]]; then
    show_help
fi

# Validate the first argument (increment type)
case "$1" in
    major|minor|patch)
        increment_type="$1"
        ;;
    *)
        echo "Error: Invalid increment type '$1'. Must be one of 'major', 'minor', or 'patch'." >&2
        show_help
        ;;
esac

preid="$2"

# --- Version Calculation ---

# Get current versions from package.json files
version=$(node -p 'require("./package.json").version')
style_spec_version=$(node -p 'require("./src/style-spec/package.json").version')
# Get the pre-release identifier (e.g., 'beta') from the current version string
current_preid=$(node -p 'const r = require("semver").prerelease(process.argv[1]); r ? r[0] : ""' "$version")

if [ -n "$preid" ]; then
    # --- Logic for handling pre-releases ---
    if [ -n "$current_preid" ] && [ "$current_preid" != "$preid" ]; then
        # SPECIAL CASE: Switching pre-release identifiers (e.g., beta -> rc).
        # We stay on the same base version.
        # First, get the stable version of the current release (e.g., 3.16.0-beta.1 -> 3.16.0)
        stable_version=$(npx semver "$version" -i patch)
        stable_style_spec_version=$(npx semver "$style_spec_version" -i patch)
        # Then, start the new pre-release series from that stable base.
        next_version=$(npx semver "$stable_version" -i "prepatch" --preid "$preid")
        style_spec_next_version=$(npx semver "$stable_style_spec_version" -i "prepatch" --preid "$preid")
        # Finally, bump the new series from .0 to .1
        next_version=$(npx semver "$next_version" -i prerelease)
        style_spec_next_version=$(npx semver "$style_spec_next_version" -i prerelease)
    else
        # STANDARD CASE: Incrementing a pre-release or starting a new one from stable.
        if [ "$current_preid" == "$preid" ]; then
            # Incrementing an existing prerelease (e.g., beta.1 -> beta.2)
            semver_increment="prerelease"
        else
            # Starting a new prerelease from a stable version (e.g., 3.15.2 -> 3.16.0-beta.1)
            semver_increment="pre$increment_type"
        fi

        # Calculate the next version
        next_version=$(npx semver "$version" -i "$semver_increment" --preid "$preid")
        style_spec_next_version=$(npx semver "$style_spec_version" -i "$semver_increment" --preid "$preid")

        # If we just started a new pre-release series (which starts at .0), bump it to .1
        if [ "$semver_increment" != "prerelease" ]; then
            next_version=$(npx semver "$next_version" -i prerelease)
            style_spec_next_version=$(npx semver "$style_spec_next_version" -i prerelease)
        fi
    fi
else
    # --- Logic for stable releases ---
    # Graduate from a pre-release or do a standard version bump.
    next_version=$(npx semver "$version" -i "$increment_type")
    style_spec_next_version=$(npx semver "$style_spec_version" -i "$increment_type")
fi


# --- User Confirmation and Execution ---

printf "Current versions: gl-js %s, style-spec %s\n" "$version" "$style_spec_version"
printf "New versions:     gl-js %s, style-spec %s\n\n" "$next_version" "$style_spec_next_version"

read -p "Proceed and commit the changes? (y/n) " answer

if [[ "$answer" == "y" || "$answer" == "Y" ]]; then
    echo "Bumping versions in package.json files..."
    # Use npm version to update package.json files without creating git tags
    npm version "$next_version" --no-git-tag-version > /dev/null
    npm version "$style_spec_next_version" --no-git-tag-version --workspace src/style-spec > /dev/null

    echo "Committing changes..."
    git add package.json package-lock.json src/style-spec/package.json
    git commit -m "v$next_version. Bump versions"

    echo "Done. New version is $next_version."
else
    echo "Operation cancelled."
fi
