@dishantlangayan/sc-cli-core
=================

Core library for the Solace Cloud CLI

[![Version](https://img.shields.io/npm/v/@dishantlangayan/sc-cli-core.svg)](https://npmjs.org/package/@dishantlangayan/sc-cli-core)
[![License](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](https://opensource.org/license/apache-2-0)

# Description
The @dishantlangayan/sc-cli-core provides utilities for the Solace Cloud CLI and it's plugins.

## ScCommand Abstract Class
The ScCommand abstract class extends [@oclif/core's Command class](https://github.com/oclif/core/blob/main/src/command.ts).

- ScCommand takes a generic type that defines the success JSON result
- Enable the json flag support by default
- Sets the base URL for making Solace Cloud API calls
- Checks if the access token is set for authentication with Solace Cloud APIs

## ScConnection Class
The ScConnection class provide abstraction functions for Solace Cloud API REST calls. It handles the access token and base URL for each REST call, avoiding the need to set these on each Command.

## OrgManager
The OrgManager class provides utility functions to store and retrieve Solace Cloud authentication information from user's home directory: `~/.sc/` or `%USERPROFILE%\sc\`. The implementation uses AES-256-GCM for authenticated encryption and provides machine-bound encryption that combines OS-level security (keychain) with machine-specific identifiers, making credentials non-transferable between machines.

Supports changing of the Solace Cloud REST API base url using the environment variable `SC_BASE_URL` and API version using `SC_API_VERSION`.

## BrokerAuthManager
The BrokerAuthManager class provides utility functions to store and retrieve broker SEMP management authentication information similar to the `OrgManager` class. It supports Basic and OAuth authentication schemes.

# Contributing
Contributions are encouraged! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

<!-- contributingstop -->
# Authors
<!-- authors -->
See the list of [contributors](https://github.com/dishantlangayan/sc-cli-core/graphs/contributors) who participated in this project.

<!-- authorsstop -->
# License
<!-- license -->
See the [LICENSE](LICENSE.txt) file for details.
