BETA release of this fork, built from the merged `development` commit [80d76b2eea84460813f34cf7384f84c3e8ab73fd](https://github.com/ZEB-23/desktop/commit/80d76b2eea84460813f34cf7384f84c3e8ab73fd).

Download **GitHubDesktopSetup-x64.exe** for Windows x64. This release provides only that installer; other platforms, ARM64 and MSI packages were not built.

Differences from [desktop/desktop development at bebc062caafcf818993b9f53397b976d33484231](https://github.com/desktop/desktop/commit/bebc062caafcf818993b9f53397b976d33484231):

- Adds a persistent Word wrap toggle to unified diffs. Turning it off keeps each line unwrapped and scrolls the entire diff horizontally together.
- Keeps both line-number columns exactly aligned across changed and unchanged rows, including selected lines and check marks shown or hidden.
- Temporarily disables background and manual remote update checks and upstream Windows delta downloads. Install future fork releases manually.

[Complete source comparison](https://github.com/ZEB-23/desktop/compare/bebc062caafcf818993b9f53397b976d33484231...80d76b2eea84460813f34cf7384f84c3e8ab73fd).

Application names, executable/shortcut/installer names, bundle ID, dependency versions, and application version remain identical to upstream. The application reports **3.6.8-beta2**; this dated BETA tag identifies the new fork release. Build automation is kept on a separate branch, and the release tag points directly to the merged application source.

This is an unofficial, unsigned BETA build. Windows may prompt before running it.
