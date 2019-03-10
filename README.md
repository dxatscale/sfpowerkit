sfpowerkit
==========

Swiss Army toolset for Salesforce

## `sfpowerkit package:dependencies:install`

Install dependencies of a package. This makes installing all the dependencies for package a breeze

Adapted from texei plugin, modified it for working with the new cli

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

## `sfpowerkit package:valid`

Validates a package(source) to check whether it only contains valid metadata as per metadata coverage.
This is ultra useful in your local machine as well as during a pull request validation to prevent very cryptic error messages during package creation

```
USAGE
  $ sfpowerkit package:valid [-n <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]

OPTIONS
  -n, --package=package                           the package to analyze
  --json                                          format output as json
  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this command invocation

EXAMPLES
  $ sfdx package:valid -n dreamhouse
     Analyzing dreamhous
  
  $ sfdx package:valid

```

_See code: [src\commands\package\valid.ts](https://github.com/azlam-abdulsalam/sfpowerkit/blob/v1.0.0/src\commands\package\valid.ts)_
