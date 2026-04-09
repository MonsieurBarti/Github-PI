# Changelog

## [0.2.0](https://github.com/MonsieurBarti/GH-PI/compare/gh-pi-v0.1.1...gh-pi-v0.2.0) (2026-04-09)


### ⚠ BREAKING CHANGES

* any saved prompts, skills, or slash-command templates that literally name the old tool ids must be updated. Live LLM sessions pick up the new names automatically from the registered tool list.

### Bug Fixes

* exempt package.json from biome formatter ([#3](https://github.com/MonsieurBarti/GH-PI/issues/3)) ([c87a997](https://github.com/MonsieurBarti/GH-PI/commit/c87a99792acc154529f29e109515da5d44687dfa))


### Code Refactoring

* namespace tool ids with tff- prefix ([#5](https://github.com/MonsieurBarti/GH-PI/issues/5)) ([62ceb65](https://github.com/MonsieurBarti/GH-PI/commit/62ceb65f67d0f153fdafc8a21e28e0e1dd657d5c))

## [0.1.1](https://github.com/MonsieurBarti/GH-PI/compare/gh-pi-v0.1.0...gh-pi-v0.1.1) (2026-04-09)


### Features

* initial release of gh-pi with full tool suite, CI, and release automation ([84e7161](https://github.com/MonsieurBarti/GH-PI/commit/84e7161ecf58d3cddf9056e850d3ca7366e59d76))
