sfpowerkit
==========

Salesforce DevOps Helper Extensions

[![Version](https://img.shields.io/npm/v/sfpowerkit.svg)](https://npmjs.org/package/sfpowerkit)
[![CircleCI](https://circleci.com/gh/azlamsalam/sfpowerkit/tree/master.svg?style=shield)](https://circleci.com/gh/azlamsalam/sfpowerkit/tree/master)
[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/azlamsalam/sfpowerkit?branch=master&svg=true)](https://ci.appveyor.com/project/heroku/sfpowerkit/branch/master)
[![Codecov](https://codecov.io/gh/azlamsalam/sfpowerkit/branch/master/graph/badge.svg)](https://codecov.io/gh/azlamsalam/sfpowerkit)
[![Greenkeeper](https://badges.greenkeeper.io/azlamsalam/sfpowerkit.svg)](https://greenkeeper.io/)
[![Known Vulnerabilities](https://snyk.io/test/github/azlamsalam/sfpowerkit/badge.svg)](https://snyk.io/test/github/azlamsalam/sfpowerkit)
[![Downloads/week](https://img.shields.io/npm/dw/sfpowerkit.svg)](https://npmjs.org/package/sfpowerkit)
[![License](https://img.shields.io/npm/l/sfpowerkit.svg)](https://github.com/azlamsalam/sfpowerkit/blob/master/package.json)

<!-- toc -->

<!-- tocstop -->

<!-- commands -->
* [`sfpowerkit <%= command.id %> -n <string> -c <filepath> -e <email> [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]`](#sfpowerkit--commandid---n-string--c-filepath--e-email--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfatal)
* [`sfpowerkit <%= command.id %> -n <string> -d <string> -l <string> [-a <string>] [-f <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]`](#sfpowerkit--commandid---n-string--d-string--l-string--a-string--f-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfatal)
* [`sfpowerkit <%= command.id %> -n <string> [-s] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]`](#sfpowerkit--commandid---n-string--s--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfatal)
* [`sfpowerkit <%= command.id %> -n <string> [-f <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]`](#sfpowerkit--commandid---n-string--f-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfatal)
* [`sfpowerkit <%= command.id %> [-p <string>] [-k <string>] [-b <string>] [-w <string>] [-r] [-v <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]`](#sfpowerkit--commandid---p-string--k-string--b-string--w-string--r--v-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfatal)
* [`sfpowerkit <%= command.id %> [-n <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]`](#sfpowerkit--commandid---n-string---json---loglevel-tracedebuginfowarnerrorfatal)

## `sfpowerkit <%= command.id %> -n <string> -c <filepath> -e <email> [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]`

Creates a connected app in the target org for JWT based authentication, Please note it only creates Connected App with All users may self authorize option, You would need to manually edit the policies to enable admin users are pre-approved and add your profile to this connected app

```
USAGE
  $ sfpowerkit sfpowerkit:org:connectedapp:create -n <string> -c <filepath> -e <email> [-u <string>] [--apiversion 
  <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]

OPTIONS
  -c, --pathtocertificate=pathtocertificate       (required) Filepath to the private certificate for the connected app
                                                  to be created

  -e, --email=email                               (required) Email of the connected app to be created

  -n, --name=name                                 (required) Name of the connected app to be created

  -u, --targetusername=targetusername             username or alias for the target org; overrides default target org

  --apiversion=apiversion                         override the api version used for api requests made by this command

  --json                                          format output as json

  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this command invocation

EXAMPLE
  $ sfdx  sfpowerkit:org:connectedapp:create -u myOrg@example.com -n AzurePipelines -c id_rsa -e 
  azlam.salamm@invalid.com
     Created Connected App AzurePipelines in Target Org
```

_See code: [src\commands\sfpowerkit\org\connectedapp\create.ts](https://github.com/azlamsalam/sfpowerkit/blob/v1.4.4/src\commands\sfpowerkit\org\connectedapp\create.ts)_

## `sfpowerkit <%= command.id %> -n <string> -d <string> -l <string> [-a <string>] [-f <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]`

Creates a sandbox using the tooling api, ensure the user has the required permissions before using this command

```
USAGE
  $ sfpowerkit sfpowerkit:org:sandbox:create -n <string> -d <string> -l <string> [-a <string>] [-f <string>] [-u 
  <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]

OPTIONS
  -a, --apexclass=apexclass                               A reference to the ID of an Apex class that runs after each
                                                          copy of the sandbox

  -d, --description=description                           (required) Description of the sandbox

  -f, --clonefrom=clonefrom                               A reference to the ID of a SandboxInfo that serves as the
                                                          source org for a cloned sandbox.

  -l, --licensetype=DEVELOPER|DEVELOPER_PRO|PARTIAL|FULL  (required) Type of the sandbox. Valid values are
                                                          DEVELOPER,DEVELOPER_PRO,PARTIAL,FULL

  -n, --name=name                                         (required) Name of the sandbox

  -u, --targetusername=targetusername                     username or alias for the target org; overrides default target
                                                          org

  --apiversion=apiversion                                 override the api version used for api requests made by this
                                                          command

  --json                                                  format output as json

  --loglevel=(trace|debug|info|warn|error|fatal)          [default: warn] logging level for this command invocation

EXAMPLE
  $ sfdx sfpowerkit:org:sandbox:create -d Testsandbox -l DEVELOPER -n test2 -u myOrg@example.com
     Successfully Enqueued Creation of Sandbox
```

_See code: [src\commands\sfpowerkit\org\sandbox\create.ts](https://github.com/azlamsalam/sfpowerkit/blob/v1.4.4/src\commands\sfpowerkit\org\sandbox\create.ts)_

## `sfpowerkit <%= command.id %> -n <string> [-s] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]`

Gets the status of a sandbox

```
USAGE
  $ sfpowerkit sfpowerkit:org:sandbox:info -n <string> [-s] [-u <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal]

OPTIONS
  -n, --name=name                                 (required) Name of the sandbox
  -s, --showonlylatest                            Shows only the latest info of the sandbox record
  -u, --targetusername=targetusername             username or alias for the target org; overrides default target org
  --apiversion=apiversion                         override the api version used for api requests made by this command
  --json                                          format output as json
  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this command invocation

EXAMPLE
  $ sfdx sfpowerkit:org:sandbox:info -n test2  -u myOrg@example.com
     Successfully Enqueued Refresh of Sandbox
```

_See code: [src\commands\sfpowerkit\org\sandbox\info.ts](https://github.com/azlamsalam/sfpowerkit/blob/v1.4.4/src\commands\sfpowerkit\org\sandbox\info.ts)_

## `sfpowerkit <%= command.id %> -n <string> [-f <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]`

Refresh a sandbox using the tooling api, ensure the user has the required permissions before using this command

```
USAGE
  $ sfpowerkit sfpowerkit:org:sandbox:refresh -n <string> [-f <string>] [-u <string>] [--apiversion <string>] [--json] 
  [--loglevel trace|debug|info|warn|error|fatal]

OPTIONS
  -f, --clonefrom=clonefrom                       A reference to the ID of a SandboxInfo that serves as the source org
                                                  for a cloned sandbox.

  -n, --name=name                                 (required) Name of the sandbox

  -u, --targetusername=targetusername             username or alias for the target org; overrides default target org

  --apiversion=apiversion                         override the api version used for api requests made by this command

  --json                                          format output as json

  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this command invocation

EXAMPLE
  $ sfdx sfpowerkit:org:sandbox:refresh -n test2  -f sitSandbox -u myOrg@example.com
     Successfully Enqueued Refresh of Sandbox
```

_See code: [src\commands\sfpowerkit\org\sandbox\refresh.ts](https://github.com/azlamsalam/sfpowerkit/blob/v1.4.4/src\commands\sfpowerkit\org\sandbox\refresh.ts)_

## `sfpowerkit <%= command.id %> [-p <string>] [-k <string>] [-b <string>] [-w <string>] [-r] [-v <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]`

Install dependencies of a package

```
USAGE
  $ sfpowerkit sfpowerkit:package:dependencies:install [-p <string>] [-k <string>] [-b <string>] [-w <string>] [-r] [-v 
  <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]

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

_See code: [src\commands\sfpowerkit\package\dependencies\install.ts](https://github.com/azlamsalam/sfpowerkit/blob/v1.4.4/src\commands\sfpowerkit\package\dependencies\install.ts)_

## `sfpowerkit <%= command.id %> [-n <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]`

Validates a package to check whether it only contains valid metadata as per metadata coverage

```
USAGE
  $ sfpowerkit sfpowerkit:package:valid [-n <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]

OPTIONS
  -n, --package=package                           the package to analyze
  --json                                          format output as json
  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this command invocation

EXAMPLE
  $ sfdx sfpowerkit:package:valid -n testPackage
     Now analyzing inspections
  Converting package testPackage
  Source was successfully converted to Metadata API format and written to the location: 
  D:projects	estPackage	emp_sfpowerkitmdapi
  Elements supported included in your package testPackage are
  [
     "AuraDefinitionBundle",
     "CustomApplication",
     "ApexClass",
     "ContentAsset",
     "WorkflowRule"
  ]
```

_See code: [src\commands\sfpowerkit\package\valid.ts](https://github.com/azlamsalam/sfpowerkit/blob/v1.4.4/src\commands\sfpowerkit\package\valid.ts)_
<!-- commandsstop -->
