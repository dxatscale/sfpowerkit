sfpowerkit
==========

Swiss Army toolset for Salesforce

[![Version](https://img.shields.io/npm/v/sfpowerkit.svg)](https://npmjs.org/package/sfpowerkit)
[![CircleCI](https://circleci.com/gh/azlam-abdulsalam/sfpowerkit/tree/master.svg?style=shield)](https://circleci.com/gh/azlam-abdulsalam/sfpowerkit/tree/master)
[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/azlam-abdulsalam/sfpowerkit?branch=master&svg=true)](https://ci.appveyor.com/project/heroku/sfpowerkit/branch/master)
[![Codecov](https://codecov.io/gh/azlam-abdulsalam/sfpowerkit/branch/master/graph/badge.svg)](https://codecov.io/gh/azlam-abdulsalam/sfpowerkit)
[![Greenkeeper](https://badges.greenkeeper.io/azlam-abdulsalam/sfpowerkit.svg)](https://greenkeeper.io/)
[![Known Vulnerabilities](https://snyk.io/test/github/azlam-abdulsalam/sfpowerkit/badge.svg)](https://snyk.io/test/github/azlam-abdulsalam/sfpowerkit)
[![Downloads/week](https://img.shields.io/npm/dw/sfpowerkit.svg)](https://npmjs.org/package/sfpowerkit)
[![License](https://img.shields.io/npm/l/sfpowerkit.svg)](https://github.com/azlam-abdulsalam/sfpowerkit/blob/master/package.json)

<!-- toc -->
* [Debugging your plugin](#debugging-your-plugin)
<!-- tocstop -->
<!-- install -->
<!-- usage -->
```sh-session
$ npm install -g sfpowerkit
$ sfpowerkit COMMAND
running command...
$ sfpowerkit (-v|--version|version)
sfpowerkit/1.0.0 win32-x64 node-v10.15.3
$ sfpowerkit --help [COMMAND]
USAGE
  $ sfpowerkit COMMAND
...
```
<!-- usagestop -->
<!-- commands -->
* [`sfpowerkit <%= command.id %> [-p <string>] [-k <string>] [-b <string>] [-w <string>] [-r] [-v <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]`](#sfpowerkit--commandid---p-string--k-string--b-string--w-string--r--v-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfatal)
* [`sfpowerkit <%= command.id %> [-n <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]`](#sfpowerkit--commandid---n-string---json---loglevel-tracedebuginfowarnerrorfatal)

## `sfpowerkit <%= command.id %> [-p <string>] [-k <string>] [-b <string>] [-w <string>] [-r] [-v <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]`

Install dependencies of a package

```
USAGE
  $ sfpowerkit package:dependencies:install [-p <string>] [-k <string>] [-b <string>] [-w <string>] [-r] [-v <string>] 
  [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]

OPTIONS
  -b, --branch=branch                              the package version’s branch

  -k, --installationkeys=installationkeys          installation key for key-protected packages (format is
                                                   1:MyPackage1Key 2: 3:MyPackage3Key... to allow some packages without
                                                   installation key)

  -p, --individualpackage=individualpackage        Installs a specific package especially for upgrade scenario

  -r, --noprompt                                   allow Remote Site Settings and Content Security Policy websites to
                                                   send or receive data without confirmation

  -u, --targetusername=targetusername              username or alias for the target org; overrides default target org

  -v, --targetdevhubusername=targetdevhubusername  username or alias for the dev hub org; overrides default dev hub org

  -w, --wait=wait                                  number of minutes to wait for installation status (also used for
                                                   publishwait). Default is 10

  --apiversion=apiversion                          override the api version used for api requests made by this command

  --json                                           format output as json

  --loglevel=(trace|debug|info|warn|error|fatal)   [default: warn] logging level for this command invocation

EXAMPLE
  $ sfpowerkit package:dependencies:install -u MyScratchOrg -v MyDevHub -k "1:MyPackage1Key 2: 3:MyPackage3Key" -b "DEV"
```

_See code: [src\commands\package\dependencies\install.ts](https://github.com/azlam-abdulsalam/sfpowerkit/blob/v1.0.0/src\commands\package\dependencies\install.ts)_

## `sfpowerkit <%= command.id %> [-n <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]`

Validates a package to check whether it only contains valid metadata as per metadata coverage

```
USAGE
  $ sfpowerkit package:valid [-n <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]

OPTIONS
  -n, --package=package                           the package to analyze
  --json                                          format output as json
  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this command invocation

EXAMPLES
  $ sfdx hello:org --targetusername myOrg@example.com --targetdevhubusername devhub@org.com
     Hello world! This is org: MyOrg and I will be around until Tue Mar 20 2018!
     My hub org id is: 00Dxx000000001234
  
  $ sfdx hello:org --name myname --targetusername myOrg@example.com
     Hello myname! This is org: MyOrg and I will be around until Tue Mar 20 2018!
```

_See code: [src\commands\package\valid.ts](https://github.com/azlam-abdulsalam/sfpowerkit/blob/v1.0.0/src\commands\package\valid.ts)_
<!-- commandsstop -->
<!-- debugging-your-plugin -->
# Debugging your plugin
We recommend using the Visual Studio Code (VS Code) IDE for your plugin development. Included in the `.vscode` directory of this plugin is a `launch.json` config file, which allows you to attach a debugger to the node process when running your commands.

To debug the `hello:org` command: 
1. Start the inspector
  
If you linked your plugin to the sfdx cli, call your command with the `dev-suspend` switch: 
```sh-session
$ sfdx hello:org -u myOrg@example.com --dev-suspend
```
  
Alternatively, to call your command using the `bin/run` script, set the `NODE_OPTIONS` environment variable to `--inspect-brk` when starting the debugger:
```sh-session
$ NODE_OPTIONS=--inspect-brk bin/run hello:org -u myOrg@example.com
```

2. Set some breakpoints in your command code
3. Click on the Debug icon in the Activity Bar on the side of VS Code to open up the Debug view.
4. In the upper left hand corner of VS Code, verify that the "Attach to Remote" launch configuration has been chosen.
5. Hit the green play button to the left of the "Attach to Remote" launch configuration window. The debugger should now be suspended on the first line of the program. 
6. Hit the green play button at the top middle of VS Code (this play button will be to the right of the play button that you clicked in step #5).
<br><img src=".images/vscodeScreenshot.png" width="480" height="278"><br>
Congrats, you are debugging!
