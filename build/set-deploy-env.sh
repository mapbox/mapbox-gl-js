# Establish environment variables based on the branch name.
#
# This is an sh script (instead of Node or bash) because it needs to run in the
# top-level process so the environment variables it creates are available to
# all children processes (e.g. `x && y && z`). `npm run` executes in an `sh`
# environment -- so, sh it is.

# `git symbolic-ref HEAD` outputs `refs/head/{your-branch-name}`.
branch=`git symbolic-ref HEAD | sed "s/refs\/heads\/\(.*\)/\1/"`

if [ -z "$DEPLOY_ENV" ]
  then
    if [ "$branch" = "mb-pages" ]
      then
        export DEPLOY_ENV=production
      else
        export DEPLOY_ENV=staging
    fi
fi

echo "DEPLOY_ENV set to $DEPLOY_ENV"
