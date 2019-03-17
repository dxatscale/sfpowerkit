sfpowerkit
==========

Swiss Army toolset for Salesforce

## `sfdx sfpowerkit:package:dependencies:install`

Install dependencies of a package. This makes installing all the dependencies for package a breeze

Adapted from texei plugin, modified it for working with the new cli

```
USAGE
  $ sfdx sfpowerkit:package:dependencies:install [-p <string>] [-k <string>] [-b <string>] [-w <string>] [-r] [-v <string>] 
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

_See code: [src\commands\package\dependencies\install.ts](https://github.com/azlam-abdulsalam/sfpowerkit/blob/v1.0.0/src\commands\sfpowerkit\package\dependencies\install.ts)_

## `sfdx sfpowerkit:package:valid`

Validates a package(source) to check whether it only contains valid metadata as per metadata coverage.
This is ultra useful in your local machine as well as during a pull request validation to prevent very cryptic error messages during package creation

```
USAGE
  $ sfdx sfpowerkit:package:valid [-n <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]

OPTIONS
  -n, --package=package                           the package to analyze
  --json                                          format output as json
  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this command invocation

EXAMPLES
  $ sfdx package:valid -n dreamhouse
     Analyzing dreamhous
  
  $ sfdx package:valid

```

_See code: [src\commands\package\valid.ts](https://github.com/azlam-abdulsalam/sfpowerkit/blob/v1.0.0/src\commands\sfpowerkit\package\valid.ts)_

## `sfdx sfpowerkit:org:connectedapp:create `

Creates a connected app in the target org for JWT based authentication,
Please note it only creates Connected App with All users may self authorize option, You would need to manually edit the policies to enable admin users are pre-approved and add your profile to this connected app
It needs a web auth based login to create a JWT based token

```
USAGE
  $ sfdx sfpowerkit:org:connectedapp:create [-n <string>] [-c <string>] [-e <email>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]


OPTIONS
  -n,                          the label of the connected app toe be created
  -c,                          the x509 formatted .crt file 
  -e,                          the email to be used in while creating the connected app
  -u                           username or alias for the target org; overrides default target org
  --json                                          format output as json
  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this command invocation

EXAMPLES
  $ sfdx  sfpowerkit:org:connectedapp:create -u myOrg@example.com -n azurepipelines -c id_rsa -e azlam.abdulsalam@accentue.co
  Running prepare script for D:\projects\sf_toolkit... done
  Deploy connected app azurepipelines
  1823 bytes written to C:\Users\Azlam\AppData\Local\Temp\mdapi.zip using 30.413ms
   Deploying C:\Users\Azlam\AppData\Local\Temp\mdapi.zip...

  === Result
  Status:  Succeeded
  jobid:  0Af0k00000RKRPqCAP
  Completed:  2019-03-11T10:11:37.000Z
  Component errors:  0
  Components deployed:  1
  Components total:  1
  Tests errors:  0
  Tests completed:  0
  Tests total:  0
  Check only: false


```

_See code: [src\commands\sfpowerkit\org\connectedapp\create.ts](https://github.com/azlam-abdulsalam/sfpowerkit/blob/v1.1.1/src\commands\sfpowerkit\org\connectedapp\create.ts)_


## `sfdx sfpowerkit:org:sandbox:create `

Creates a sandbox using the tooling api, ensure the user has the required permissions before using this command

```
USAGE
  $ sfdx sfpowerkit:org:sandbox:create -n <string> -d <string> -l <string> [-a <string>] [-f <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]

OPTIONS
  -a, --apexclass=apexclass                       A reference to the ID of an Apex class that runs after each copy of the sandbox
  -d, --description=description                   (required) Description of the sandbox
  -f, --clonefrom=clonefrom                       A reference to the ID of a SandboxInfo that serves as the source org for a cloned sandbox.
  -l, --licensetype=licensetype                   (required) Type of the sandbox. Valid values are  DEVELOPER,DEVELOPER_PRO,PARTIAL,FULL
  -n, --name=name                                 (required) Name of the sandbox
  -u, --targetusername=targetusername             username or alias for the target org; overrides default target org
  --apiversion=apiversion                         override the api version used for api requests made by this command
  --json                                          format output as json
  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this command invocation

EXAMPLE
  $ sfdx sfpowerkit:org:sandbox:create -d Testsandbox -l DEVELOPER -n test2 -u myOrg@example.com
     Successfully Enqueued Creation of Sandbox
     { id: '0GQ6F0000004IeDWAU',
      success: true,
      errors: [],
      warnings: [],
      infos: [] }
```  
_See code: [src\commands\sfpowerkit\org\connectedapp\create.ts](https://github.com/azlam-abdulsalam/sfpowerkit/blob/v1.3.0/src/commands\sfpowerkit\org\sabdbox\create.ts)_


## `sfdx sfpowerkit:org:sandbox:refresh `

Refresh a sandbox using the tooling api, ensure the user has the required permissions before using this command

```
USAGE
  $ sfdx sfpowerkit:org:sandbox:create -n <string> -d <string> -l <string> [-a <string>] [-f <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]

OPTIONS
  -f, --clonefrom=clonefrom                       A reference to the ID of a SandboxInfo that serves as the source org for a cloned sandbox.
  -n, --name=name                                 (required) Name of the sandbox
  -u, --targetusername=targetusername             username or alias for the target org; overrides default target org
  --apiversion=apiversion                         override the api version used for api requests made by this command
  --json                                          format output as json
  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this command invocation

EXAMPLE
  $ sfdx sfpowerkit:org:sandbox:refresh -n test2 -u myOrg@example.com
     Successfully Enqueued Refresh of Sandbox
```  
_See code: [src\commands\sfpowerkit\org\connectedapp\create.ts](https://github.com/azlam-abdulsalam/sfpowerkit/blob/v1.3.0/src\commands\sfpowerkit\org\sabdbox\refresh.ts)_
