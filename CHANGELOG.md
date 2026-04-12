# Changelog

## [0.2.3](https://github.com/MonsieurBarti/GH-PI/compare/gh-pi-v0.2.2...gh-pi-v0.2.3) (2026-04-12)


### Features

* **gh-client:** add createGHClient factory with Node default exec ([6fa30ff](https://github.com/MonsieurBarti/GH-PI/commit/6fa30ffd3434136be399756fddb7ac0104e89bb6))
* **gh-client:** attach stdout to GHError for failure-details preservation ([0b6420e](https://github.com/MonsieurBarti/GH-PI/commit/0b6420ee6680314e761d6540f76b4e8e6f84c739))
* **index:** add library-style named exports for TFF consumers ([d5e2941](https://github.com/MonsieurBarti/GH-PI/commit/d5e294142b3102c5ebe766268565d56682240e75))
* library-style surface for TFF integration ([960ce98](https://github.com/MonsieurBarti/GH-PI/commit/960ce985fedf41bf6ef64a6d96a8a297d6001069))
* **pr-tools:** add checks() with watch/required and failure-returns-info ([14cf550](https://github.com/MonsieurBarti/GH-PI/commit/14cf550576817771e9bddbc86cae9ceeda4f7cd9))
* **pr-tools:** include comments field in pr.view JSON response ([d9d58d8](https://github.com/MonsieurBarti/GH-PI/commit/d9d58d8b6b54b17012ba983a047601dd5c0c1612))


### Bug Fixes

* **gh-client:** remove abort listener after defaultNodeExec completes ([58b41ba](https://github.com/MonsieurBarti/GH-PI/commit/58b41baa74a201249ae097b772a269190fb41205))

## [0.2.2](https://github.com/MonsieurBarti/GH-PI/compare/gh-pi-v0.2.1...gh-pi-v0.2.2) (2026-04-12)


### Features

* add PR and issue summary formatters ([8a4215d](https://github.com/MonsieurBarti/GH-PI/commit/8a4215d146537932ec7e16344f48c755b7a730ce))
* add repo and workflow summary formatters ([4e6c366](https://github.com/MonsieurBarti/GH-PI/commit/4e6c3660ba44c9b4739104f1c5de11e04766441a))
* add search parameter to PR and issue list actions ([f62bfa7](https://github.com/MonsieurBarti/GH-PI/commit/f62bfa70cba6b3482e7acfe30889ea21d848cea2))
* clamp list limit to 200 to prevent pathological requests ([5eab031](https://github.com/MonsieurBarti/GH-PI/commit/5eab03129c68589e240185ec76f0a3252be5ce99))
* integrate detail parameter and summary formatters into all tools ([c1dd512](https://github.com/MonsieurBarti/GH-PI/commit/c1dd512b167634b0048933a5cab4453587c4856b))
* overhaul prompt guidelines and parameter descriptions for all tools ([28d791c](https://github.com/MonsieurBarti/GH-PI/commit/28d791c428181f04b76aab1708418dd1462e6a12))
* **v0.3:** agent UX, output reduction, and prompt guidance ([d49ef7c](https://github.com/MonsieurBarti/GH-PI/commit/d49ef7cbda6986167fc50786d85d2e307a0045f7))


### Bug Fixes

* replace invalid 'merged' JSON field with 'mergedAt' and 'mergedBy' in pr view ([ae94c97](https://github.com/MonsieurBarti/GH-PI/commit/ae94c973f045d9c2685855bd0716eda26d4cbe69))
* safer type narrowing and check status handling in formatters ([37b4b0b](https://github.com/MonsieurBarti/GH-PI/commit/37b4b0b9f53619150affd40b81b76c52a6d0ac4e))

## [0.2.1](https://github.com/MonsieurBarti/GH-PI/compare/gh-pi-v0.2.0...gh-pi-v0.2.1) (2026-04-11)


### Features

* add read-only classification to tool prompt guidelines ([#7](https://github.com/MonsieurBarti/GH-PI/issues/7)) ([017f271](https://github.com/MonsieurBarti/GH-PI/commit/017f2710277bcedebf7a0f5f420551ec0f4df863))
* add update notification on session start ([#8](https://github.com/MonsieurBarti/GH-PI/issues/8)) ([60a8f8f](https://github.com/MonsieurBarti/GH-PI/commit/60a8f8f99e839b7034357ff8ac6f357feddd1399))

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
