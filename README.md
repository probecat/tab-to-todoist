# Tab to Todoist

[![Build][build-image]][build-url] [![Version][version-image]][release-url] [![License][license-image]][license-url]

[![Get the add-on for Firefox](docs/get-the-addon.svg)](https://addons.mozilla.org/firefox/addon/tab-to-todoist/)

See [Releases](https://github.com/probecat/tab-to-todoist/releases) for additional signed builds.

## Design

Tab to Todoist is a lightweight open-source add-on to save tabs and links as Todoist tasks. It is intentionally single-purpose. The add-on reaches Todoist API only when you interact with it. Your projects and labels are not fetched or synced in the background. You can optionally configure the project and label(s) to use.

Some behavior comes from the Todoist API itself; see [Known limitations](https://github.com/probecat/tab-to-todoist/issues/1).

## License

[MIT](LICENSE)

## Disclaimer

Not created by, affiliated with, or supported by Doist.

[build-url]: https://github.com/probecat/tab-to-todoist/actions/workflows/ci.yml
[build-image]: https://img.shields.io/github/actions/workflow/status/probecat/tab-to-todoist/ci.yml?branch=main
[release-url]: https://github.com/probecat/tab-to-todoist/releases/latest
[version-image]: https://img.shields.io/github/v/release/probecat/tab-to-todoist?label=version
[license-url]: LICENSE
[license-image]: https://img.shields.io/github/license/probecat/tab-to-todoist
