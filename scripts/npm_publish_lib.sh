#!/usr/bin/env bash

PROJECT_ROOT="$(cd $(dirname "$BASH_SOURCE[0]") && cd .. && pwd)" &> /dev/null

cd ${PROJECT_ROOT}/packages/duckdb-wasm
mkdir -p ./dist/img
cp ${PROJECT_ROOT}/misc/duckdb_wasm.svg ./dist/img/duckdb_wasm.svg
${PROJECT_ROOT}/scripts/build_duckdb_badge.sh > ./dist/img/duckdb_version_badge.svg

npm config set //registry.npmjs.org/:_authToken ${NPM_PUBLISH_TOKEN}
npm publish --ignore-scripts --access public ${TAG} || true
