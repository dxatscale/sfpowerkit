sfpowerkit
==========

[![NPM](https://img.shields.io/npm/v/sfpowerkit.svg)](https://www.npmjs.com/package/sfpowerkit) [![Board Status](https://dev.azure.com/cloudfirstanz/f7a91473-0e1c-490e-b0a0-80f9f8d82c14/c97f3cbd-bd4a-4d08-b123-9ebdd5c7c79f/_apis/work/boardbadge/6d1336f9-991b-4cb5-8cce-4173c4dcdca8?columnOptions=1)](https://dev.azure.com/cloudfirstanz/f7a91473-0e1c-490e-b0a0-80f9f8d82c14/_boards/board/t/c97f3cbd-bd4a-4d08-b123-9ebdd5c7c79f/Microsoft.RequirementCategory) [![Build status](https://dev.azure.com/cloudfirstanz/SFPowerkit/_apis/build/status/SFPowerkit-CI)](https://dev.azure.com/cloudfirstanz/SFPowerkit/_build/latest?definitionId=5)



Salesforce DevOps Helper Extensions


## `sfpowerkit auth:login`

Allows to authenticate against an org using username/password and Security Token.  Security Token requirement
can be removed by ensuring the particular user profile is allowed to connect to Salesforce from different IP 
ranges.

```
USAGE
  $ sfdx sfpowerkit:auth:login -u <string> -p <string>  [-s <string>] [ -r <url> ]  [-a <string>]  [--apiversion 
  <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]

OPTIONS
  -u, --username=username                         (required) Username of the org

  -e, --email=email                               (required) Password of the org

  -r, --url=url                                    URL of the org, by default it points to test.salesforce.com

  -s  --securitytoken=securitytoken               Security Token for this particular user

  -a, --alias=alias                               alias for the target org

  --apiversion=apiversion                         override the api version used for api requests made by this command

  --json                                          format output as json

  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this command invocation

EXAMPLE
  $  sfdx sfpowerkit:auth:login -u azlam@sfdc.com -p Xasdax2w2  -a prod
     Authorized to azlam@sfdc.com
   
```


## `sfpowerkit org:connectedapp:create`

Creates a connected app in the target org for JWT based authentication, Please note it only creates Connected App with All users may self authorize option, You would need to manually edit the policies to enable admin users are pre-approved and add your profile to this connected app. API, Web and RefreshToken Scope are added to every app that is being created.

```
USAGE
  $ sfdx sfpowerkit:org:connectedapp:create -n <string> -c <filepath> -e <email> [-u <string>] [--apiversion 
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
  $ sfdx sfpowerkit:org:connectedapp:create -u myOrg@example.com -n AzurePipelines -c id_rsa -e 
  azlam.salamm@invalid.com
     Created Connected App AzurePipelines in Target Org
```

_See code: [src\commands\sfpowerkit\org\connectedapp\create.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/org/connectedapp/create.ts)_



## `sfpowerkit org:connectedapp:retrieve`

Useful if you want to retreive a connected app key especially in  CI/CD system after a sandbox refresh. Use the auth command to login to the sandbox and then use this command. Use JSON format if you want to retrieve the entire metadata of the connected app, Without the json flag, it only displays the key

```
USAGE
  $ sfdx sfpowerkit:org:connectedapp:retrieve -n <string> -u <string>  [-r <url>] [--json] [--loglevel trace|debug|info|warn|error|fatal]

OPTIONS
  -n, --name=name                                 (required) Name of the connected app to be
                                                  retreived
  -u, --targetusername=targetusername             username or alias for the target org; overrides default target org                     
  --json                                          format output as json

  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this
                                                  command invocation

EXAMPLE
  $ sfdx sfpowerkit:org:connectedapp:retrieve -u azlam@sfdc.com -p Xasdax2w2 -n
  AzurePipelines
     Retrived AzurePipelines Consumer Key : XSD21Sd23123w21321
```

_See code: [src\commands\sfpowerkit\org\connectedapp\retrieve.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/org/connectedapp/retrieve.ts)_


## `sfpowerkit:org:duplicaterule:deactivate`

Deactivates a duplicate rule in the target org

```
USAGE
  $ sfdx sfpowerkit:org:duplicaterule:deactivate -n <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -n, --name=name                                 (required) Name of the duplicate rule

  -u, --targetusername=targetusername              username or alias for the target org; overrides default target org

  --json                                          format output as json

  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this
                                                  command invocation

EXAMPLE
    $ sfdx sfpowerkit:org:duplicaterule:deactivate -n Account.CRM_Account_Rule_1 -u sandbox
       Polling for Retrieval Status
       Retrieved Duplicate Rule  with label : CRM Account Rule 2
       Preparing Deactivation
       Deploying Deactivated Rule with ID  0Af4Y000003OdTWSA0
       Polling for Deployment Status
       Polling for Deployment Status
       Duplicate Rule CRM Account Rule 2 deactivated
```

_See code: [src\commands\sfpowerkit\org\duplicaterule\deactivate.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/org/deactivate.ts)_

## `sfpowerkit:org:matchingrule:deactivate`

Deactivates a matching rule in the target org, Please ensure all duplicate rules are deactivated before using this

```
USAGE
  $ sfdx sfpowerkit:org:matchingrule:deactivate -n <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -n, --name=name                                 (required) Name of the object
  -u, --targetusername=targetusername              username or alias for the target org; overrides default target org

  --json                                          format output as json

  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this
                                                  command invocation

EXAMPLE
    $ sfdx sfpowerkit:org:matchingrule:deactivate -n Account -u sandbox
       Polling for Retrieval Status
       Retrieved Matching Rule  for Object : Account
       Preparing Deactivation
       Deploying Deactivated Matching Rule with ID  0Af4Y000003OePkSAK
       Polling for Deployment Status
       Polling for Deployment Status
       Matching Rule for Account deactivated
```

_See code: [src\commands\sfpowerkit\org\matchingrule\deactivate.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/org/matchingrule/deactivate.ts)_


## `sfpowerkit:org:orgwideemail:create`

Create organisation wide email address

```
USAGE
  $ sfdx sfpowerkit:org:orgwideemail:create -e <email> -n <string>  [-p] [-u <string>] [--apiversion <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -e, --address=emailaddress                      (required) Email Address
  -n, --displayname=displayname                   (required) Display name of the org wide email
  -p, --allprofile                                (Optional) Specify if the orgwide email is available for all profile
  -u, --targetusername=targetusername             username or alias for the target org; overrides default target org

  --json                                          format output as json

  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this
                                                  command invocation

EXAMPLE
    $ sfdx sfpowerkit:org:orgwideemail:create -e test@example.com -n TestEmail -p -u sandbox
      Creating email test@example.com
      Org wide email created with Id 0D20E00000003wtSAA
      Run the folowing command to verify it
      sfdx sfpowerkit:org:orgwideemail:verify -i 0D20E00000003wtSAA -u test-qvoqbs1ofjd0@example.com
```

_See code: [src\commands\sfpowerkit\org\orgwideemail\create.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/org/orgwideemail/create.ts)_


## `sfpowerkit:org:orgwideemail:verify`

Verify organisation wide email address

```
USAGE
  $ sfdx sfpowerkit:org:orgwideemail:verify -i <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -i, --emailid=emailid                           (required) Org Wide Email Id
  -u, --targetusername=targetusername             username or alias for the target org; overrides default target org

  --json                                          format output as json

  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this
                                                  command invocation

EXAMPLE
    $ sfdx sfpowerkit:org:orgwideemail:verify -i 0D20E00000003wtSAA -u sandbox
      Verify email 0D21l0000008QgYCAU
      Org wide email address verified
```

_See code: [src\commands\sfpowerkit\org\orgwideemail\verify.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/org/orgwideemail/verify.ts)_


## `sfpowerkit:org:trigger:deactivate`

Deactivates a trigger in the target org

```
USAGE
  $ sfdx sfpowerkit:org:trigger:deactivate -n <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -n, --name=name                                 (required) Name of the ApexTrigger
  -u, --targetusername=targetusername              username or alias for the target org; overrides default target org

  --json                                          format output as json

  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this
                                                  command invocation

EXAMPLE
    $ sfdx sfpowerkit:org:trigger:deactivate -n AccountTrigger -u sandbox
    Polling for Retrieval Status
    Preparing Deactivation
    Deploying Deactivated ApexTrigger with ID  0Af4Y000003Q7GySAK
    Polling for Deployment Status
    Polling for Deployment Status
    ApexTrigger AccountTrigger deactivated
```

_See code: [src\commands\sfpowerkit\org\trigger\deactivate.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/org/trigger/deactivate.ts)_

## `sfpowerkit:org:trigger:activate`

Activates a trigger in the target org

```
USAGE
  $ sfdx sfpowerkit:org:trigger:activate -n <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -n, --name=name                                 (required) Name of the ApexTrigger
  -u, --targetusername=targetusername              username or alias for the target org; overrides default target org

  --json                                          format output as json

  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this
                                                  command invocation

EXAMPLE
    $ sfdx sfpowerkit:org:trigger:deactivate -n AccountTrigger -u sandbox
    Polling for Retrieval Status
    Preparing Activation
    Deploying Activated ApexTrigger with ID  0Af4Y000003Q7GySAK
    Polling for Deployment Status
    Polling for Deployment Status
    ApexTrigger AccountTrigger Ativated
```

_See code: [src\commands\sfpowerkit\org\trigger\activate.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/org/trigger/activate.ts)_



## `sfpowerkit:org:healthcheck`

Gets the  health details of an org against the Salesforce baseline

```
USAGE
  $ sfdx sfpowerkit:org:healthcheck [-u <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal]

OPTIONS
  -u, --targetusername=targetusername             username or alias for the target org; overrides default target org
  --apiversion=apiversion                         override the api version used for api requests made by this command
  --json                                          format output as json
  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this command invocation

EXAMPLE
  $ sfdx sfpowerkit:org:healthcheck  -u myOrg@example.com
     Successfully Retrived the healthstatus of the org
```

_See code: [src\commands\sfpowerkit\org\healthcheck.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/org/healthcheck.ts)_

## `sfpowerkit:org:orgcoverage`

Gets the apex tests coverage of an org

```
USAGE
  $ sfdx sfpowerkit:org:orgcoverage [-u <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal]

OPTIONS
  -u, --targetusername=targetusername             username or alias for the target org; 
  --apiversion=apiversion                         override the api version used for api requests made by this command
  --json                                          format output as json
  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this command invocation

EXAMPLE
  $ sfdx sfpowerkit:org:orgcoverage  -u myOrg@example.com
     Successfully Retrieved the Apex Test Coverage of the org 00D0k000000DmdpEAC
     coverage:85
```

_See code: [src\commands\sfpowerkit\org\orgcoverage.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/org/orgcoverage.ts)_


## `sfpowerkit:org:sandbox:create`

Creates a sandbox using the tooling api, ensure the user has the required permissions before using this command

```
USAGE
  $ sfdx sfpowerkit:org:sandbox:create -n <string> -d <string> -l <string> [-a <string>] [-f <string>] [-v 
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

  -v, --targetdevhubusername=targetdevhubusername         (required) username or alias for the dev hub org; overrides default dev hub org

  --apiversion=apiversion                                 override the api version used for api requests made by this
                                                          command

  --json                                                  format output as json

  --loglevel=(trace|debug|info|warn|error|fatal)          [default: warn] logging level for this command invocation

EXAMPLE
  $ sfdx sfpowerkit:org:sandbox:create -d Testsandbox -l DEVELOPER -n test2 -v myOrg@example.com
     Successfully Enqueued Creation of Sandbox
```

_See code: [src\commands\sfpowerkit\org\sandbox\create.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/org/sandbox/create.ts)_

## ` sfpowerkit:org:sandbox:info`

Gets the status of a sandbox

```
USAGE
  $ sfdx sfpowerkit:org:sandbox:info -n <string> [-s] [-v <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal]

OPTIONS
  -n, --name=name                                 (required) Name of the sandbox
  -s, --showonlylatest                            Shows only the latest info of the sandbox record
  -v, --targetdevhubusername=targetdevhubusername (required) username or alias for the dev hub org; overrides default dev hub org
  --apiversion=apiversion                         override the api version used for api requests made by this command
  --json                                          format output as json
  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this command invocation

EXAMPLE
  $ sfdx sfpowerkit:org:sandbox:info -n test2  -u myOrg@example.com
     Successfully Enqueued Refresh of Sandbox
```

_See code: [src\commands\sfpowerkit\org\sandbox\info.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/org/sandbox/info.ts)_

## `sfpowerkit:org:sandbox:refresh`

Refresh a sandbox using the tooling api, ensure the user has the required permissions before using this command

```
USAGE
  $ sfdx sfpowerkit:org:sandbox:refresh -n <string> [-f <string>] [-v <string>] [--apiversion <string>] [--json] 
  [--loglevel trace|debug|info|warn|error|fatal]

OPTIONS
  -f, --clonefrom=clonefrom                       A reference to the ID of a SandboxInfo that serves as the source org
                                                  for a cloned sandbox.

  -n, --name=name                                 (required) Name of the sandbox

  -v, --targetdevhubusername=targetdevhubusername  (required) username or alias for the dev hub org; overrides default dev hub org

  --apiversion=apiversion                         override the api version used for api requests made by this command

  --json                                          format output as json

  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this command invocation

EXAMPLE
  $ sfdx sfpowerkit:org:sandbox:refresh -n test2  -f sitSandbox -u myOrg@example.com
     Successfully Enqueued Refresh of Sandbox
```

_See code: [src\commands\sfpowerkit\org\sandbox\refresh.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/org/sandbox/refresh.ts)_


## `sfpowerkit:org:scratchorg:usage`

Gets the active count of scratch org by users in a devhub

```
USAGE
  $ sfdx sfpowerkit:org:scratchorg:usage -v <string> 
  [--loglevel trace|debug|info|warn|error|fatal]

OPTIONS
  -v, --targetdevhubusername=targetdevhubusername  (required) username or alias for the dev hub org; overrides default dev hub org


EXAMPLE
  $ sfdx sfpowerkit:org:scratchorg:usage -v devhub
    Active Scratch Orgs Remaining: 42 out of 100
    Daily Scratch Orgs Remaining: 171 out of 200

    IN_USE             SIGNUPEMAIL
    ─────────────────  ─────────────────
    2                  XYZ@KYZ.COM
    2                  JFK@KYZ.COM
    Total number of records retrieved: 4.
```

_See code: [src\commands\sfpowerkit\org\scratchorg\usage.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/org/scratchorg/usage.ts)_


## `sfpowerkit:org:scratchorg:delete`

Delete the scratch org for a paritcular user

```
USAGE
  $ sfdx sfpowerkit:org:scratchorg:delete -v <string>  -e <string>
  [--loglevel trace|debug|info|warn|error|fatal]

OPTIONS
  -v, --targetdevhubusername=targetdevhubusername  (required) username or alias for the dev hub org; overrides default dev hub org
  
  -e, --email=email                                (required) Email of the user account's whose scratch org to be deleted


EXAMPLE
  $ sfdx sfpowerkit:org:scratchorg:delete  -e xyz@kyz.com -v devhub
    Found Scratch Org Ids for user xyz@kyz.com
    2AS6F000000XbxVWAS
    Deleting Scratch Orgs
    Deleted Scratch Org 2AS6F000000XbxVWAS
```

_See code: [src\commands\sfpowerkit\org\scratchorg\usage.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/org/scratchorg/usage.ts)_


## `sfpowerkit:package:dependencies:install`

Install dependencies of a package

```
USAGE
  $ sfdx sfpowerkit:package:dependencies:install [-p <string>] [-k <string>] [-b <string>] [-w <string>] [-r] [-v 
  <string>] [-a] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]

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

  -a, --apexcompileonlypackage=apexcompileonlypackage  Compile the apex only in the package, by default only the
                                                    compilation of the apex in the entire org is triggered  
  --apiversion=apiversion                          override the api version used for api requests made by this command

  --json                                           format output as json

  --loglevel=(trace|debug|info|warn|error|fatal)   [default: warn] logging level for this command invocation

EXAMPLE
  $ sfpowerkit package:dependencies:install -u MyScratchOrg -v MyDevHub -k "1:MyPackage1Key 2: 3:MyPackage3Key" -b "DEV"
```

_See code: [src\commands\sfpowerkit\package\dependencies\install.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/package/dependencies/install.ts)_


## `sfpowerkit:package:applypatch`

Retrieves and applies the patch, Useful after a package upgrade in a CD Environmen

```
USAGE
  $ sfdx sfpowerkit:package:applypatch -n <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -n, --name=name                                                                   (required) Name of the static resource to be patched
  -u, --targetusername=targetusername                                               username or alias for the target org; overrides default target org
  --apiversion=apiversion                                                           override the api version used for api requests made by this command
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for this command invocation

EXAMPLE
  $ sfdx sfpowerkit:package:applypatch -n customer_picklist -u sandbox
  Preparing Patch
  Deploying Patch with ID  0Af4Y000003Q7GySAK
  Polling for Deployment Status
  Polling for Deployment Status
  Patch customer_picklist Deployed successfully.
```

_See code: [src\commands\sfpowerkit\package\applypatch.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/package/applypatch.ts)_


## `sfpowerkit:package:valid`

Validates a package to check whether it only contains valid metadata as per metadata coverage

```
USAGE
  $ sfdx sfpowerkit:package:valid [-n <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]

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
_See code: [src\commands\sfpowerkit\package\valid.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/package/valid.ts)_

## `sfpowerkit:source:customlabel:create`

Creates a custom label (with default namespace) with parameters
```

USAGE
  $ sfdx sfpowerkit:source:customlabel:create -n <string> -v <string> -s <string> [-c <string>] [-l <string>] [-p <string>] [-i] [-u <string>] 
  [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -c, --categories=categories                                                       Comma Separated Category Values

  -i, --ignorenamespace                                                             Ignores the addition of the namespace into the fullname 
                                                                                    (API Name)

  -l, --language=language                                                           Language of the custom label (Default: en_US)

  -n, --fullname=fullname                                                           (required) Name of the custom label (API Name)

  -p, --protected=protected                                                         Protected State of the custom label (Default: false)

  -s, --shortdescription=shortdescription                                           (required) Short Description of the custom label

  -u, --targetusername=targetusername                                               username or alias for the target org; overrides default 
                                                                                    target org

  -v, --value=value                                                                 (required) Value of the custom label

  --apiversion=apiversion                                                           override the api version used for api requests made by this 
                                                                                    command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for this command invocation

EXAMPLE
  $ sfdx sfpowerkit:source:customlabel:create -u fancyScratchOrg1 -n FlashError -v "Memory leaks aren't for the faint hearted" -s "A flashing 
  error"
     Created CustomLabel FlashError in Target Org
```

## `sfpowerkit:source:customlabel:clean`

Removes the namespace from the custom labels

```
USAGE
  $ sfdx sfpowerkit:source:customlabel:clean -p <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -p, --path=path                                                                   (required) Path to the CustomLabels.labels-meta.xml file

  -u, --targetusername=targetusername                                               username or alias for the target org; overrides default 
                                                                                    target org

  --apiversion=apiversion                                                           override the api version used for api requests made by this 
                                                                                    command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for this command invocation

EXAMPLE
  $ sfdx sfpowerkit:source:customlabel:clean -p path/to/customlabelfile.xml
       Cleaned The Custom Labels
``
```

## `sfpowerkit:source:apextestsuite:convert`

Converts an apex test suite to its consituent apex classes as a single line separated by commas, so that it can be used for metadata api deployment

```
USAGE
  $ sfdx sfpowerkit:source:apextestsuite:convert  -n <string> [  -p <string> ] [  -o <string> ] [--json] [--loglevel trace|debug|info|warn|error|fatal]

OPTIONS
  -n, --name=name                                 (required) the name of the apextestsuite (the file name minus the apex test suite)
  -p, --package=package                           [default:picks up the default package] The package where the apex test suite exists
  -o, --pathoverride=pathoverride                 [default:/main/default] Use this if your path to test suite is in a different folder location
                                                   within the package directory

  --json                                          format output as json
  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this command invocation

EXAMPLE
  $  sfdx sfpowerkit:source:apextestsuite:convert -n MyApexTestSuite 
    "ABC2,ABC1Test"    
```

## `sfpowerkit:source:picklist:generatepatch`

Search picklist fields from Standatd/ custom objects inside project and create a static resource file with picklist fields, used to solve the picklist upgrade issue in dx unlock package. Custom metadata picklist fields will be ignored. 

```
USAGE
  $ sfdx sfpowerkit:source:picklist:generatepatch [-p <string>] [-d <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --objectsdir=objectsdir                                                       Path for Objects folder located in project
  -p, --package=package                                                             Name of the package to generate the picklist patch
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for this command invocation

EXAMPLE
  $ sfdx sfpowerkit:source:picklist:generatepatch -p Core -d src/core/main/default/objects/
  Scanning for fields of type picklist
  Found 30 fields of type picklist
  Source was successfully converted to Metadata API format and written to the location: .../temp_sfpowerkit/mdapi
  Generating static resource file : src/core/main/default/staticresources/Core_picklist.resource-meta.xml
  Patch Core_picklist generated successfully.
```
_See code: [src\commands\sfpowerkit\source\picklist\generatepatch.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/source/picklist/generatepatch.ts)_


## `sfpowerkit:source:permissionset:generatepatch`

Search permissionsets inside project and create a static resource file with permissionsets, used to solve the recordtype assignment upgrade issue in dx unlock package

```
USAGE
  $ sfdx sfpowerkit:source:permissionset:generatepatch [-p <string>] [-d <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --permsetdir=permsetdir                                                       Path for permissionset folder located in project
  -p, --package=package                                                             Name of the package to generate the permissionset patch
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for this command invocation

EXAMPLE
  $ sfdx sfpowerkit:source:permissionset:generatepatch -p Core -d src/core/main/default/permissionsets
  Scanning for permissionsets
  Found 30 permissionsets
  Source was successfully converted to Metadata API format and written to the location: .../temp_sfpowerkit/mdapi
  Generating static resource file : src/core/main/default/staticresources/Core_permissionsets.resource-meta.xml
  Patch Core_permissionsets generated successfully.
```
_See code: [src\commands\sfpowerkit\source\permissionset\generatepatch.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/source/permissionset/generatepatch.ts)_


## `sfpowerkit:project:diff`

Generate a subset of the project base on a diff file generated by a git diff --raw command. You can ommit the diff file and provide the revisionFrom and optionally revisionTo insted.
```

USAGE
  $ sfdx sfpowerkit:project:diff  -d <string> [-f <string>] [  -e <string> ] [  -r <string> ] [  -t <string> ] [--json] [--loglevel trace|debug|info|warn|error|fatal]

OPTIONS
  -d, --output=output                             (required) the output dir where the files will be placed
  -f, --difffile=difffile                         the diff file generate with the command [git diff --raw] you can skip this parameter and set the revisionfrom and optionally revisionto parameter
  -e, --encoding=encoding                         [default:utf8] diff file encoding
  -r, --revisionfrom=revisionfrom                 base revision to generate the diff. required if diff file ommited
  -t, --revisionto=revisionto                     [default:head]target revision to generate the diff 

  --json                                          format output as json
  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this command invocation

EXAMPLE
  $  sfdx sfpowerkit:project:diff --revisionfrom revisionfrom --revisionto revisionto --output OutputFolder  
  {
  "status": 0,
  "result": {
    "deleted": [],
    "addedEdited": [
      "scripts\\Alias.sh",
      "sfdx-project.json",
    ]
   }
  }
```

 