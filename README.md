# sfpowerkit

[![NPM](https://img.shields.io/npm/v/sfpowerkit.svg)](https://www.npmjs.com/package/sfpowerkit) ![npm (tag)](https://img.shields.io/npm/v/sfpowerkit/beta) [![Build status](https://dev.azure.com/dxatscale/sfpowerkit/_apis/build/status/SFPowerkit-CI?branchName=master)](https://dev.azure.com/dxatscale/SFPowerkit/_build/latest?definitionId=5) [![Greenkeeper badge](https://badges.greenkeeper.io/Accenture/sfpowerkit.svg)](https://greenkeeper.io/)![npm](https://img.shields.io/npm/dw/sfpowerkit)

A Salesforce DX Plugin with multiple functionalities aimed at improving development and operational workflows
Read the blog here https://accenture.github.io/blog/2019/06/27/sfpowerkit.html

## Installation

To install the stable version from the release branch, use the following command

```
$ sfdx plugins:install sfpowerkit
```

If you need to install automatically the plugin, via a CI process or Dockerfile, use the following line:

```
$ echo 'y' | sfdx plugins:install sfpowerkit
```

Beta versions are the latest versions that are in being reviewed/ undergoing testing etc and built from the master branch and can be downloaded using the following command

```
$ sfdx plugins:install sfpowerkit@beta
```

To review a pull request (for contributors/reviewers), the best option is to clone the repository, checkout to the particular branch and utilize the following command from the project directory

```
$ sfdx plugins:link
```

<!-- commands -->

## Commands

- [Source Related Functionalities](#source-related-functionalities)
  - [`sfpowerkit:source:pmd`](#sfpowerkitsourcepmd)
  - [`sfpowerkit:source:profile:retrieve`](#sfpowerkitsourceprofileretrieve)
  - [`sfpowerkit:source:profile:reconcile`](#sfpowerkitsourceprofilereconcile)
  - [`sfpowerkit:source:profile:merge`](#sfpowerkitsourceprofilemerge)
  - [`sfpowerkit:source:customlabel:create`](#sfpowerkitsourcecustomlabelcreate)
  - [`sfpowerkit:source:customlabel:reconcile`](#sfpowerkitsourcecustomlabelreconcile)
  - [`sfpowerkit:source:customlabel:buildmanifest`](#sfpowerkitsourcecustomlabelbuildmanifest)
  - [`sfpowerkit:source:apextestsuite:convert`](#sfpowerkitsourceapextestsuiteconvert)
  - [`sfpowerkit:project:diff`](#sfpowerkitprojectdiff)
  - [`sfpowerkit:project:orgdiff`](#sfpowerkitprojectorgdiff)
  - [`sfpowerkit:project:manifest:diff`](#sfpowerkitprojectmanifestdiff)
  - [`sfpowerkit:project:manifest:merge`](#sfpowerkitprojectmanifestmerge)
- [Unlocked Package Related Functionalities](#unlocked-package-related-functionalities)
  - [`sfpowerkit:package:dependencies:install`](#sfpowerkitpackagedependenciesinstall)
  - [`sfpowerkit:package:version:codecoverage`](#sfpowerkitpackageversioncodecoverage)
  - [`sfpowerkit:package:version:info`](#sfpowerkitpackageversioninfo)
  - [`sfpowerkit:package:valid`](#sfpowerkitpackagevalid)
- [Org Related Functionalities](#org-related-functionalities)
  - [`sfpowerkit:org:destruct`](#sfpowerkitorgdestruct)
  - [`sfpowerkit:org:connectedapp:create`](#sfpowerkitorgconnectedappcreate)
  - [`sfpowerkit:org:connectedapp:retrieve`](#sfpowerkitorgconnectedappretrieve)
  - [`sfpowerkit:org:duplicaterule:deactivate`](#sfpowerkitorgduplicateruledeactivate)
  - [`sfpowerkit:org:duplicaterule:activate`](#sfpowerkitorgduplicateruleactivate)
  - [`sfpowerkit:org:matchingrule:deactivate`](#sfpowerkitorgmatchingruledeactivate)
  - [`sfpowerkit:org:matchingrule:activate`](#sfpowerkitorgmatchingruleactivate)
  - [`sfpowerkit:org:trigger:deactivate`](#sfpowerkitorgtriggerdeactivate)
  - [`sfpowerkit:org:trigger:activate`](#sfpowerkitorgtriggeractivate)
  - [`sfpowerkit:org:healthcheck`](#sfpowerkitorghealthcheck)
  - [`sfpowerkit:org:manifest:build`](#sfpowerkitorgmanifestbuild)
  - [`sfpowerkit:org:orgcoverage`](#sfpowerkitorgorgcoverage)
  - [`sfpowerkit:org:profile:diff`](#sfpowerkitorgprofilediff)
  - [`sfpowerkit:org:sandbox:create`](#sfpowerkitorgsandboxcreate)
  - [`sfpowerkit:org:sandbox:info`](#sfpowerkitorgsandboxinfo)
  - [`sfpowerkit:org:sandbox:refresh`](#sfpowerkitorgsandboxrefresh)
  - [`sfpowerkit:org:scratchorg:usage`](#sfpowerkitorgscratchorgusage)
  - [`sfpowerkit:org:scratchorg:delete`](#sfpowerkitorgscratchorgdelete)
  - [`sfpowerkit:org:relaxiprange`](#sfpowerkitorgrelaxiprange)
  - [`sfpowerkit:auth:login`](#sfpowerkitauthlogin)
- [Dependency Functionalities](#dependency-functionalities)
  - [`sfpowerkit:dependency:tree:package [Beta]`](#sfpowerkitdependencytreepackage-Beta)
- [ScratchOrg Pooling Related Functionalities](#scratchorg-pooling-related-functionalities-beta)
  - [`sfpowerkit:pool:create`](#sfpowerkitpoolcreate)
  - [`sfpowerkit:pool:fetch`](#sfpowerkitpoolfetch)
  - [`sfpowerkit:pool:list`](#sfpowerkitpoollist)
  - [`sfpowerkit:pool:delete`](#sfpowerkitpooldelete)
    <!-- commands -->

## Source Related Functionalities

These commands manipulate the metadata configuration/code locally or during the packaging process.

## `sfpowerkit:source:pmd`

This command is a wrapper around PMD ( downloads PMD for the first time) with some predefined defaults, such as ruleset, output format, output file. The command is to be run from the project directory

```

USAGE
  $ sfdx sfpowerkit:source:pmd [-d <string>] [-r <string>] [-f <string>] [-o <string>] [--javahome <string>] [--supressoutput] [--version <string> [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --directory=directory       [default: Default project directory as mentioned in sfdx-project.json ] Override this to set a different directory in the project folder
  -f, --format=format             [default: text] The format for the pmd output, Possible values are available at https://pmd.github.io/latest/pmd_userdocs_cli_reference.html#available-report-formats
  -o, --report=report             [default: pmd-output] The path to where the output of the analysis should be written
  -r, --ruleset=ruleset           [default: [sfpowerkit](https://github.com/Accenture/sfpowerkit/blob/master/resources/pmd-ruleset.xml)] The pmd ruleset that will be utilzied for analyzing  the apex classes,  Checkout https://pmd.github.io/pmd_userdocs_making_rulesets.html to create your own ruleset
  --javahome=javahome             The command will try to locate the javahome path to execute PMD  automatically, set this flag to override it to  another javahome path
  --supressoutput                 [default: false] Supress the ouptut of the analysis to be displayed in the console
  --version=version               [default: 6.18.0] [default: 6.18.0] The version of the pmd to be utilized for the analysis, this version will be downloaded to sfpowerkit's cache directory
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for this command invocation

EXAMPLE
  $ sfdx sfpowerkit:source:pmd

```

_See code: [src\commands\sfpowerkit\source\pmd.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/source/pmd.ts)_

## `sfpowerkit:source:profile:retrieve`

Retrieve profiles from the salesforce org with all its associated permissions. Common use case for this command is to migrate profile changes from a integration environment to other higher environments [overcomes SFDX CLI Profile retrieve issue where it doesnt fetch the full profile unless the entire metadata is present in source], or retrieving profiles from production to lower environments for testing.

```

USAGE
  $ sfdx sfpowerkit:source:profile:retrieve [-f <array>] [-n <array>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -f, --folder=folder                             retrieve only updated versions of profiles found in this directory, If ignored, all profiles will be retrieved.
  -n, --profilelist=profilelist                   comma separated list of profiles to be retrieved. Use it for selectively retrieving an existing profile or retrieving a new profile
  -d, --delete                                    set this flag to delete profile files that does not exist in the org, when retrieving in bulk
  -u, --targetusername=targetusername             username or alias for the target org; overrides default target org
  --apiversion=apiversion                         override the api version used for api requests made by this command
  --json                                          format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for this command invocation

EXAMPLES
  $ sfdx sfpowerkit:source:profile:retrieve -u prod
  $ sfdx sfpowerkit:source:profile:retrieve  -f force-app -n "My Profile"  -u prod
  $ sfdx sfpowerkit:source:profile:retrieve  -f "module1, module2, module3" -n "My Profile1, My profile2"  -u prod
```

_See code: [src\commands\sfpowerkit\profile\retrieve.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/profile/retrieve.ts)_

## `sfpowerkit:source:profile:reconcile`

This command is used in the lower environments such as ScratchOrgs , Development / System Testing Sandboxes, where a retrieved profile from production has to be cleaned up only for the metadata that is contained in the environment or base it only as per the metadata that is contained in the packaging directory.

Please read more about the command especially for ignoring user permissions [here](https://github.com/Accenture/sfpowerkit/wiki/Profile-Reconcile-:-Ignore-User-Permissions)

```

USAGE
  $ sfdx sfpowerkit:source:profile:reconcile [-f <array>] [-n <array>] [-u <string>] [--apiversion <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -f, --folder=folder                               path to the project folder, if the profiles are reconciled in source only mode
  -d, --destfolder=destfolder                       the destination folder for reconciled profiles, if omitted existing profiles will be reconciled and will be rewritten in the current location
  -n, --profilelist=profilelist                     list of profiles to be reconciled. If ommited, all the profiles components will be reconciled.
  -s, --sourceonly                                  set this flag to reconcile profiles only against component available in the project only. Configure ignored perissions in sfdx-project.json file in the array plugins->sfpowerkit->ignoredPermissions.
  -u, --targetorg=targetorg                         org against which profiles will be reconciled. this parameter can be ommited if sourceonly flag is used.
  --apiversion=apiversion                           override the api version used for api requests made by this command
  --json                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for this command invocation

EXAMPLES
  $ sfdx sfpowerkit:source:profile:reconcile  --folder force-app -d destfolder -s
  $ sfdx sfpowerkit:source:profile:reconcile  --folder force-app,module2,module3 -u sandbox -d destfolder
  $ sfdx sfpowerkit:source:profile:reconcile  -u myscratchorg -d destfolder
```

_See code: [src\commands\sfpowerkit\profile\reconcile.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/profile/reconcile.ts)_

## `sfpowerkit:source:profile:merge`

This command is used in the lower environments such as ScratchOrgs , Development / System Testing Sandboxes, inorder to apply the changes made in the environment to retrieved profile, so that it can be deployed to the higher environments

```

USAGE
  $ sfdx sfpowerkit:source:profile:merge [-f <array>] [-n <array>] [-m <array>] [-u <string>] [--apiversion <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -f, --folder=folder                                 path to the folder which contains the profiles to be merged,if project contain multiple package directories, please provide a comma seperated list, if omitted, all the package directories will be checked for profiles
  -m, --metadata=metadata                             comma separated list of metadata for which the permissions will be retrieved.
  -n, --profilelist=profilelist                       comma separated list of profiles. If ommited, all the profiles found in the folder(s) will be merged
  -d, --delete                                        set this flag to delete profile files that does not exist in the org.
  -u, --targetusername=targetusername                 username or alias for the target org; overrides default target org

  --apiversion=apiversion                             override the api version used for api requests made by this command

  --json                                              format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for this command invocation

EXAMPLES
  $ sfdx sfpowerkit:source:profile:merge -u sandbox
  $ sfdx sfpowerkit:source:profile:merge -f force-app -n "My Profile" -r -u sandbox
  $ sfdx sfpowerkit:source:profile:merge -f "module1, module2, module3" -n "My Profile1, My profile2"  -u sandbox
```

_See code: [src\commands\sfpowerkit\profile\merge.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/profile/merge.ts)_

## `sfpowerkit:source:customlabel:create`

Custom Labels are org wide, hence when the metadata is pulled down from scratch org, the entire custom label metadata file is pulled down in a package repo. This results in often packaging failures, when developers forget to clean the customlabels only to contain what the package needs, as unlocked package does not support duplicate items.The custom labels has to be then cleaned up per package.

This command is a helper command to create customlabel with pacakage names prepended for easy reconcilation.

```

USAGE
  $ sfdx sfpowerkit:source:customlabel:create -n <string> -v <string> -s <string> [-c <string>] [-l <string>] [-p <string>] [-i] [-u <string>]
  [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -c, --categories=categories                                                       Comma Separated Category Values

  -l, --language=language                                                           Language of the custom label (Default: en_US)

  -n, --fullname=fullname                                                           (required) Name of the custom label (API Name)

  -p, --protected=protected                                                         Protected State of the custom label (Default: false)

  -s, --shortdescription=shortdescription                                           (required) Short Description of the custom label

  -u, --targetusername=targetusername                                               username or alias for the target org; overrides default
                                                                                    target org

  -v, --value=value                                                                 (required) Value of the custom label

  --package                                                                         Name of the package that needs to be appended, omit this if ignore namespace is used

  -i, --ignorepackage                                                             Ignores the addition of the namespace into the fullname
                                                                                    (API Name)

  --apiversion=apiversion                                                           override the api version used for api requests made by this
                                                                                    command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for this command invocation

EXAMPLE
  $ sfdx sfpowerkit:source:customlabel:create -u fancyScratchOrg1 -n FlashError -v "Memory leaks aren't for the faint hearted" -s "A flashing
  error" --package core
     Created CustomLabel FlashError in target org with core_  prefix, You may now pull and utilize the customlabel:reconcile command
```

## `sfpowerkit:source:customlabel:reconcile`

Custom Labels are org wide, hence when the metadata is pulled down from scratch org, the entire custom label metadata file is pulled down in a package repo. This results in often packaging failures, when developers forget to clean the customlabels only to contain what the package needs, as unlocked package does not support duplicate items.The custom labels has to be then cleaned up per package.

This command reconcile the updated custom labels to include only the labels that have the API name starting with package name (packagename\_ ) or created using the custom label create command

```
USAGE
  $ sfdx sfpowerkit:source:customlabel:reconcile -d <string> -p <string>  [--apiversion <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --path=path                                                                   (required) Path to the CustomLabels.labels-meta.xml file

  -p, --package                                                                     (required) Name of the package

  --apiversion=apiversion                                                           override the api version used for api requests made by this
                                                                                    command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for this command invocation

EXAMPLE
  $ sfdx sfpowerkit:source:customlabel:reconcile -d path/to/customlabelfile.xml -p core
  Package ::: core
  Reconciled The Custom Labels, only to have core labels (labels with full name beginning with core_)
```

## `sfpowerkit:source:customlabel:buildmanifest`

This Command is used to build package.xml with all customlabels as members rather than wildcard \*. sfdx force:source:convert creates a package.xml with customlabels wildcard, this command helps to update the package.xml with list of label names.

```
USAGE
  $ sfdx sfpowerkit:source:customlabel:buildmanifest -p <array> -x <string> [--apiversion <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -p, --path=path                                                                   (required) Path to the CustomLabels.labels-meta.xml file
  -x, --manifest=manifest                                                           (required) path to existing package.xml file or create new package.xml
  --apiversion=apiversion                                                           The api version to be used create package.xml
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: info] [default: info] logging level for this command invocation

EXAMPLE
  $ sfdx sfpowerkit:source:customlabel:buildmanifest -p project1/path/to/customlabelfile.xml -x mdapiout/package.xml
  $ sfdx sfpowerkit:source:customlabel:buildmanifest -p project1/path/to/customlabelfile.xml,project2/path/to/customlabelfile.xml -x mdapiout/package.xml
```

## `sfpowerkit:source:apextestsuite:convert`

Converts an apex test suite to its consituent apex classes as a single line separated by commas, so that it can be used along with metadata validate only deployment

```
USAGE
  $ sfdx sfpowerkit:source:apextestsuite:convert  -n <string> [--json] [--loglevel trace|debug|info|warn|error|fatal]

OPTIONS
  -n, --name=name                                 (required) the name of the apextestsuite (the file name minus the apex test suite)

  --json                                          format output as json
  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this command invocation

EXAMPLE
  $  sfdx sfpowerkit:source:apextestsuite:convert -n MyApexTestSuite
    "ABC2,ABC1Test"
```

## `sfpowerkit:project:diff`

Generate a delta 'changeset' between two diff commits so that the incremental changes can be deployed to the target org.To be used for an org based deployment when the size of the metadata is large that the project cannot not be deployed in a single attempt.

This command works with a source format based repository only. Utilize the command during a transition phase where an org is transformed to a modular architecture composing of multiple projects.

```

USAGE
  $ sfdx sfpowerkit:project:diff -d <string> [-r <string>] [-t <string>] [-x] [-b <array>] [-p <array>] [--apiversion <string>] [--json]
  [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -b, --bypass=bypass                                                               list of path to ignore, if diff found on the repo
  -d, --output=output                                                               (required)  The output dir where the incremental project will be created

  -p, --packagedirectories=packagedirectories                                       project paths to run diff, if this is passed then override the path in sfdx-project.json

  -r, --revisionfrom=revisionfrom                                                   Base revision from where diff is to be generated, required if diff file is ommited

  -t, --revisionto=revisionto                                                       [default:HEAD] Target revision to generate the diff

  -x, --generatedestructive                                                         If set to true, the command will also generate a destructiveChangePost.xml file in the
                                                                                    output folder.

  --apiversion=apiversion                                                           override the api version used for api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: info] logging level for this command invocation

EXAMPLE
  $  sfdx sfpowerkit:project:diff --revisionfrom revisionfrom --revisionto revisionto --output OutputFolder
```

## `sfpowerkit:project:orgdiff`

Compare source files of a project against the salesforce org and display differences. The command also add diff conflict markers in changed files to let the developer accept or reject changes manually using a git merge tool. The idea behind this command is used to track changes done on an unlocked package or a modular repo against the changes done in a higher environment. This command is not yet ready to work on a single repo against the whole metadata in the org

```

USAGE
  $ sfdx sfpowerkit:project:orgdiff -f <array> [-c] [-o json|csv] [-u <string>] [--apiversion <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -c, --noconflictmarkers                                                           If set to true, the command will not add diff conflict marker to each compared file.

  -f, --filesorfolders=filesorfolders                                               (required) List of fils or folder to compare. Should be only Apex classes, trigger, Aura
                                                                                    Components, Lightning Web Components or any unsplitted metadata.

  -o, --outputformat=(json|csv)                                                     [default: json]The format for the diff output, Possible values are json/csv.

  -u, --targetusername=targetusername                                               username or alias for the target org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: info] logging level for this command invocation

EXAMPLES
  $ sfdx sfpowerkit:project:orgdiff --folder directory --noconflictmarkers --targetusername sandbox
  $ sfdx sfpowerkit:project:orgdiff  --filename fileName --targetusername sandbox
```

## `sfpowerkit:project:manifest:diff`

Generate a diff between two manifest files. This command is used to useful to generate a report on what is the difference between two org's. Use sfpowerkit org: manifest:build or similar to generate manifests

```
USAGE
  $ sfdx sfpowerkit:project:manifest:diff -s <string> -t <string> -d <string> [-f json|csv|xml] [--apiversion <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --output=output                                                               (required) path to the diff output package.xml
  -f, --format=(json|csv|xml)                                                       [default: json] The format for the output, Possible values are json/csv/xml
  -s, --sourcepath=sourcepath                                                       (required) Paths to the source package.xml file
  -t, --targetpath=targetpath                                                       (required) Paths to the target package.xml file
  --apiversion=apiversion                                                           The api version to be used create package.xml
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: info] [default: info] logging level for this command invocation

EXAMPLE
  $ sfdx sfpowerkit:project:manifest:diff -s source/package.xml -t target/package.xml -d output
```

## `sfpowerkit:project:manifest:merge`

Merge multiple package.xml into single collective package.xml

```
USAGE
  $ sfdx sfpowerkit:project:manifest:merge -p <array> -d <string> [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --manifest=manifest                                                           (required) output path to create collective package.xml
  -p, --path=path                                                                   (required) Paths to the package.xml file
  --apiversion=apiversion                                                           The api version to be used create package.xml
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: info] [default: info] logging level for this command invocation

EXAMPLE
  $ sfdx sfpowerkit:project:manifest:merge -p project1/path/to/package.xml -d result/package.xml
  $ sfdx sfpowerkit:project:manifest:merge -p project1/path/to/package.xml,project2/path/to/package.xml -d result/package.xml
```

## Unlocked Package Related Functionalities

Various helper commands in aiding with Salesforce DX Unlocked Package Development

## `sfpowerkit:package:dependencies:install`

Install unlocked package dependencies of a package

```
USAGE
  $ sfdx sfpowerkit:package:dependencies:install [-p <string>] [-k <string>] [-b <string>] [-t <string>] [-w <string>] [-r] [-o] [-a] [--usedependencyvalidatedpackages] [-f <array>] [-v <string>] [-u
  <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -a, --apexcompileonlypackage                                                      Compile the apex only in the package, by default only the compilation of the apex in the entire org is triggered

  -b, --branch=branch                                                               The package version’s branch (format is packagename:branchname --> core:branchname consumer:branchname
                                                                                    packageN:branchname)

  -f, --filterpaths=filterpaths                                                     In a mono repo project, filter packageDirectories using path and install dependent packages only for the specified path

  -k, --installationkeys=installationkeys                                           Installation key for key-protected packages (format is packagename:key --> core:key nCino:key vlocity:key to allow
                                                                                    some packages without installation key)

  -o, --updateall                                                                   Update all packages even if they are installed in the target org

  -p, --individualpackage=individualpackage                                         Installs a specific package especially for upgrade scenario

  -r, --noprompt                                                                    Allow Remote Site Settings and Content Security Policy websites to send or receive data without confirmation

  -t, --tag=tag                                                                     The package version’s tag (format is packagename:tag --> core:tag consumer:tag packageN:tag)

  --usedependencyvalidatedpackages                                                  Use dependency validated packages that matches the version number schema provide

  -u, --targetusername=targetusername                                               Username or alias for the target org; overrides default target org

  -v, --targetdevhubusername=targetdevhubusername                                   Username or alias for the dev hub org; overrides default dev hub org

  -w, --wait=wait                                                                   Number of minutes to wait for installation status (also used for publishwait). Default is 10

  --apiversion=apiversion                                                           Override the api version used for api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for this command invocation



EXAMPLE
  $ sfdx sfpowerkit:package:dependencies:install -u MyScratchOrg -v MyDevHub -k "MyPackage1:Key MyPackage3:Key" -b "DEV"
```

_See code: [src\commands\sfpowerkit\package\dependencies\install.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/package/dependencies/install.ts)_

## `sfpowerkit:package:version:codecoverage`

This command is used to get the apex test coverage details of an unlocked package

```
USAGE
  $ sfdx sfpowerkit:package:version:codecoverage [-p <string>] [-n <string>] [-i <array>] [-v <string>] [--apiversion <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -i, --versionid=versionid                                                         Package version Id to check the code coverage

  -n, --versionnumber=versionnumber                                                 The complete version number format is major.minor.patch (Beta build)—for example, 1.2.0 (Beta 5),
                                                                                    packageName is required when packageVersionNumber is used

  -p, --package=package                                                             Name of the unlocked package to check the code coverage, packageVersionNumber is required when packageName
                                                                                    is used

  -v, --targetdevhubusername=targetdevhubusername                                   username or alias for the dev hub org; overrides default dev hub org

  --apiversion=apiversion                                                           API version

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: info] [default: info] logging level for this command invocation

EXAMPLES
  $ sfdx sfpowerkit:package:version:codecoverage -v myOrg@example.com -i 04tXXXXXXXXXXXXXXX

  $ sfdx sfpowerkit:package:version:codecoverage -v myOrg@example.com -i 04tXXXXXXXXXXXXXXX,04tXXXXXXXXXXXXXXX,04tXXXXXXXXXXXXXXX

  $ sfdx sfpowerkit:package:version:codecoverage -v myOrg@example.com -p core -n 1.2.0.45

  $ sfdx sfpowerkit:package:version:codecoverage -v myOrg@example.com -p 0HoXXXXXXXXXXXXXXX -n 1.2.0.45
```

_See code: [src\commands\sfpowerkit\package\version\codecoverage.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/package/version/codecoverage.ts)_

## `sfpowerkit:package:version:info`

This command is used to fetch the version number, namespace prefix, and version id of all the installed managed/unmanaged packages in an org.

```
USAGE
  $ sfdx sfpowerkit:package:version:info  -u <string> [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -u, --targetusername=targetusername                                               username or alias for the target org; overrides default target org

  --apiversion=apiversion                                                           API version

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: info] [default: info] logging level for this command invocation

EXAMPLE
  $ sfdx sfpowerkit:package:version:info -u myOrg@example.com
```

_See code: [src\commands\sfpowerkit\package\version\codecoverage.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/package/version/codecoverage.ts)_

## `sfpowerkit:package:valid`

Validates a package directory to check whether it only contains valid metadata as per metadata coverage

```
USAGE
  $ sfdx sfpowerkit:package:valid [-n <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]

OPTIONS
  -b, --bypass=bypass                                                               metadatatypes to skip the package validation check
  -n, --package=package                           the package to analyze
  --json                                          format output as json
  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this command invocation

EXAMPLE
  $ sfdx sfpowerkit:package:valid -n testPackage -b sharingrules,sharingownerrule
     Now analyzing testPackage
  Converting package testPackage
  Source was successfully converted to Metadata API format and written to the location:
  D:projects	estPackage	emp_sfpowerkitmdapi
  Elements supported included in your package testPackage are
  AuraDefinitionBundle
  CustomApplication
  ApexClass
  ContentAsset
  WorkflowRule
  --------------------------------------------------------------------------------
  Unsupported elements to bypass in your package sample are
  sharingrules
  sharingownerrule
  --------------------------------------------------------------------------------
```

_See code: [src\commands\sfpowerkit\package\valid.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/package/valid.ts)_

## Org Related Functionalities

These commands are helpful in managing functionalities are related to a Salesforce Org

## `sfpowerkit:org:destruct`

This is a helper command to ease the deployment of destructiveChanges.xml. The command will create the empty package.xml and package the passed destructive manifest and deploy it to the org

```
USAGE
  $ sfdx sfpowerkit:org:destruct -m <filepath>  [-u <string>] [--apiversion  <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]

OPTIONS
  -m, --manifest                                 (required) The path to xml containing the members that need to be destructed,follow the instructions here to                                                create such a file [here](https://developer.salesforce.com/docs/atlas.en-us.daas.meta/daas/daas_destructive_changes.htm)

  -u, --targetusername=targetusername             username or alias for the target org; overrides default target org

  --apiversion=apiversion                         override the api version used for api requests made by this command

  --json                                          format output as json

  --loglevel=(trace|debug|info|warn|error|fatal)  [default: info] logging level for this command invocation

EXAMPLE
  $ sfdx sfpowerkit:org:destruct -u myOrg@example.com -m destructiveChanges.xml

```

_See code: [src\commands\sfpowerkit\org\destruct.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/org/destruct.ts)_

## `sfpowerkit:org:connectedapp:create`

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

## `sfpowerkit:org:connectedapp:retrieve`

Useful if you want to retreive a connected app key especially in CI/CD system after a sandbox refresh. Use the auth command to login to the sandbox and then use this command. Use JSON format if you want to retrieve the entire metadata of the connected app, Without the json flag, it only displays the key

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

Deactivates a duplicate rule in the target org. Deactivate active rules before pushing the changes to the target org

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

## `sfpowerkit:org:duplicaterule:activate`

Activates a matching rule in the target org

```
USAGE
  $ sfdx sfpowerkit:org:duplicaterule:activate -n <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -n, --name=name                                 (required) Name of the duplicate rule

  -u, --targetusername=targetusername              username or alias for the target org; overrides default target org

  --json                                          format output as json

  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this
                                                  command invocation

EXAMPLE
   $ sfdx sfpowerkit:org:duplicaterule:activate -n Account.CRM_Account_Rule_1 -u sandbox
    Polling for Retrieval Status
    Retrieved Duplicate Rule  with label : CRM Account Rule 2
    Preparing Activation
    Deploying Activated Rule with ID  0Af4Y000003OdTWSA0
    Polling for Deployment Status
    Polling for Deployment Status
    Duplicate Rule CRM Account Rule 2 Activated
```

_See code: [src\commands\sfpowerkit\org\duplicaterule\activate.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/org/activate.ts)_

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

## `sfpowerkit:org:matchingrule:activate`

Activates a matching rule in the target org, Please ensure all duplicate rules are activated before using this

```
USAGE
  $ sfdx sfpowerkit:org:matchingrule:activate -n <string> [-u <string>] [--apiversion <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -n, --name=name                                 (required) Name of the object
  -u, --targetusername=targetusername              username or alias for the target org; overrides default target org

  --json                                          format output as json

  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this
                                                  command invocation

EXAMPLE
   $ sfdx sfpowerkit:org:matchingrules:activate -n Account -u sandbox
    Polling for Retrieval Status
    Retrieved Matching Rule  for Object : Account
    Preparing Activation
    Deploying Activated Rule with ID  0Af4Y000003OdTWSA0
    Polling for Deployment Status
    Polling for Deployment Status
    Matching Rule for  Account activated
```

_See code: [src\commands\sfpowerkit\org\matchingrule\activate.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/org/matchingrule/activate.ts)_

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
    $ sfdx sfpowerkit:org:trigger:activate -n AccountTrigger -u sandbox
    Polling for Retrieval Status
    Preparing Activation
    Deploying Activated ApexTrigger with ID  0Af4Y000003Q7GySAK
    Polling for Deployment Status
    Polling for Deployment Status
    ApexTrigger AccountTrigger Ativated
```

_See code: [src\commands\sfpowerkit\org\trigger\activate.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/org/trigger/activate.ts)_

## `sfpowerkit:org:healthcheck`

Gets the health details of an org against the Salesforce baseline

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

## `sfpowerkit:org:manifest:build`

Generate a complete manifest of all the metadata from the specified org. Once the manifest is generated use source:retrieve or mdapi:retrieve to retrieve the metadata.

```
USAGE
  $ sfdx sfpowerkit:org:manifest:build [-q <string>] [-x] [-o <filepath>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]

OPTIONS
  -o, --outputfile=outputfile                      The output path where the manifest file will be created

  -q, --quickfilter=quickfilter                    comma separated values  of metadata type, member or file names to be excluded while building the manifest

  -u, --targetusername=targetusername              username or alias for the target org; overrides default
                                                   target org

  -x, --excludemanaged                             exclude managed packages components from the manifest

  --apiversion=apiversion                          override the api version used for api requests made by this
                                                   command

  --json                                           format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for this command invocation

EXAMPLES
  $ sfdx sfpowerkit:org:manifest:build --targetusername myOrg@example.com -o package.xml
       <?xml version="1.0" encoding="UTF-8"?>
       <Package xmlns="http://soap.sforce.com/2006/04/metadata">...</Package>

  $ sfdx sfpowerkit:org:manifest:build --targetusername myOrg@example.com -o package.xml -q 'ApexClass, CustomObject, Report'
       <?xml version="1.0" encoding="UTF-8"?>
       <Package xmlns="http://soap.sforce.com/2006/04/metadata">...</Package>
```

_See code: [src\commands\sfpowerkit\org\manifest\build.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/org/manifest/build.ts)_

## `sfpowerkit:org:orgcoverage`

Gets the apex tests coverage of an org

```
USAGE
  $ sfdx sfpowerkit:org:orgcoverage [-d <string>] [-f json|csv] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --output=output                                                               The output dir where the output will be created
  -f, --format=(json|csv)                                                           The format for the test result output, Possible values are json/csv
  -u, --targetusername=targetusername                                               username or alias for the target org; overrides default target org
  --apiversion=apiversion                                                           override the api version used for api requests made by this command
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for this command invocation

EXAMPLE
  $ sfdx sfpowerkit:org:orgcoverage  -u myOrg@example.com
    sfdx sfpowerkit:org:orgcoverage  -u myOrg@example.com -d testResult -f csv
    sfdx sfpowerkit:org:orgcoverage  -u myOrg@example.com -d testResult -f json


    Successfully Retrieved the Apex Test Coverage of the org XXXX
    coverage:85
     ID                 PACKAGE       NAME                  TYPE          PERCENTAGE    COMMENTS                              UNCOVERED LINES
     ───────            ────────      ──────────────────    ────────      ──────────    ───────────────────────────────────   ──────────────────
     01pxxxx            core          sampleController      ApexClass     100%
     01pxxxx            core          sampletriggerHandler  ApexClass     80%           Looks fine but target more than 85%   62;76;77;
     01pxxxx            consumer      sampleHelper          ApexClass     72%           Action required                       62;76;77;78;98;130;131
     01qxxxx            consumer      sampleTrigger         ApexTrigger   100%
    Output testResult/output.csv is generated successfully
```

_See code: [src\commands\sfpowerkit\org\orgcoverage.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/org/orgcoverage.ts)_

## `sfpowerkit:org:profile:diff`

Compare profiles from project against target org or between two orgs (source and target).

```
USAGE
  $ sfdx sfpowerkit:org:profile:diff [-p <array>] [-s <string>] [-d <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --output=output                                                               Output folder. Provide the output folder if comparing profiles from source org.
  -p, --profilelist=profilelist                                                     List of profiles to compare, comma separated profile names. If not provided and no sourceusername
                                                                                    is provided, all profiles from the source folder will be processed.
  -s, --sourceusername=sourceusername                                               Source org. If no profile is provided in the profilelist parameter, all the profile from this org
                                                                                    will be fetched
  -u, --targetusername=targetusername                                               username or alias for the target org; overrides default target org
  --apiversion=apiversion                                                           override the api version used for api requests made by this command
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: info] logging level for this command invocation

EXAMPLES
  $ sfdx sfpowerkit:org:profile:diff --profilelist profilenames --targetusername username (Compare liste profiles path against target org)
  $ sfdx sfpowerkit:org:profile:diff --targetusername username (compare all profile in the project against the target org)
  $ sfdx sfpowerkit:org:profile:diff --sourceusername sourcealias --targetusername username (compare all profile in the source org against the target org)
```

_See code: [src\commands\sfpowerkit\org\profile\diff.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/org/profile/diff.ts)_

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

## `sfpowerkit:org:sandbox:info`

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

## `sfpowerkit:org:relaxiprange`

This command sets ip range in Network access to relax security setting for a particular salesforce environment

```
USAGE
  $ sfdx sfpowerkit:org:relaxiprange -r <array> [-u <string>] [--apiversion <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -r, --range=range                                                                 (required) List of ip range with comma separated. eg,
                                                                                    122.0.0.0-122.255.255.255,49.0.0.0-49.255.255.255

  -u, --targetusername=targetusername                                               username or alias for the target org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: info] logging level for this command invocation

EXAMPLE
  sfdx sfpowerkit:org:relaxiprange -u sandbox -r "122.0.0.0-122.255.255.255,49.0.0.0-49.255.255.255"
```

## `sfpowerkit:auth:login`

Allows to authenticate against an org using username/password and Security Token. Security Token requirement
can be removed by ensuring the particular user profile is allowed to connect to Salesforce from different IP
ranges.

```
USAGE
  $ sfdx sfpowerkit:auth:login -u <string> -p <string>  [-s <string>] [ -r <url> ]  [-a <string>]  [--apiversion
  <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]

OPTIONS
  -u, --username=username                         (required) Username of the org

  -p, --password=password                          (required) Password of the org

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

## Dependency Functionalities

## `sfpowerkit:dependency:tree:package [BETA]`

This command is used to compute the dependency tree details of an unlocked package

```
USAGE
  $ sfdx sfpowerkit:dependency:tree:package -n <string> -d <string> [-p] [-s] [-f json|csv] [-u <string>] [--apiversion <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -o, --output=output                                                               (required) path to create the output
  -f, --format=(json|csv)                                                           [default: json] format of the output file to create
  -n, --package=package                                                             (required) package name, package version id, subscriber id that is installed in the org
  -p, --packagefilter                                                               output result will filter only dependent packages
  -s, --showall                                                                     Indclude all items with/without dependency in the result
  -u, --targetusername=targetusername                                               username or alias for the target org; overrides default target org
  --apiversion=apiversion                                                           override the api version used for api requests made by this command
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: info] [default: info] logging level for this command invocation

EXAMPLES
  $ sfdx sfpowerkit:dependency:tree:package -u MyScratchOrg -n 04txxxxxxxxxx -o outputdir -f json
  $ sfdx sfpowerkit:dependency:tree:package -u MyScratchOrg -n 04txxxxxxxxxx -o outputdir -f csv
  $ sfdx sfpowerkit:dependency:tree:package -u MyScratchOrg -n 04txxxxxxxxxx -o outputdir -f csv -p
  $ sfdx sfpowerkit:dependency:tree:package -u MyScratchOrg -n 04txxxxxxxxxx -o outputdir -f csv -s
```

_See code: [src\commands\sfpowerkit\dependency\tree\package.ts](https://github.com/Accenture/sfpowerkit/blob/master/src/commands/sfpowerkit/dependency/tree/package.ts)_

## ScratchOrg Pooling Related Functionalities [BETA]

Commands to create and maintain a pool of scratchorgs. Details on getting started are available [here](https://github.com/Accenture/sfpowerkit/wiki/Getting-started-with-ScratchOrg-Pooling)

This command is of sufficient quality, however proceed with caution while adopting in your workflow

## `sfpowerkit:pool:create`

Creates a pool of prebuilt scratchorgs, which can the be consumed by users or CI

```
USAGE
  $ sfdx sfpowerkit:pool:create -f <filepath> [-v <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -f, --configfilepath=configfilepath                                               (required) Relative Path to the pool configuration json file. The schema of the file could be found in
                                                                                    the Wiki

  -v, --targetdevhubusername=targetdevhubusername                                   username or alias for the dev hub org; overrides default dev hub org

  --apiversion=apiversion                                                           override the api version used for api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: info] logging level for this command invocation

EXAMPLES
  $ sfdx sfpowerkit:pool:create -f config\core_poolconfig.json
  $ sfdx sfpowerkit:pool:create -f config\core_poolconfig.json -v devhub
```

## `sfpowerkit:pool:fetch`

Gets an active/unused scratch org from the scratch org pool

```
USAGE
  $ sfdx sfpowerkit:pool:fetch -t <string> [-m] [-v <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -m, --mypool                                                                      Filter the tag for any additions created  by the executor of the command
  -t, --tag=tag                                                                     (required) tag used to identify the scratch org pool
  -v, --targetdevhubusername=targetdevhubusername                                   username or alias for the dev hub org; overrides default dev hub org
  --apiversion=apiversion                                                           override the api version used for api requests made by this command
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for this command invocation

EXAMPLES
  $ sfdx sfpowerkit:pool:fetch -t core
  $ sfdx sfpowerkit:pool:fetch -t core -v devhub
  $ sfdx sfpowerkit:pool:fetch -t core -v devhub -m
```

## `sfpowerkit:pool:list`

Retrieves a list of active scratch org and details from any pool. If this command is run with -m|--mypool, the command will retrieve the passwords for the pool created by the user who is executing the command.

```
USAGE
  $ sfdx sfpowerkit:pool:list [-t <string>] [-m] [-a] [-v <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -a, --allscratchorgs                                                              Gets all used and unused Scratch orgs from pool
  -m, --mypool                                                                      Filter the tag for any additions created  by the executor of the command
  -t, --tag=tag                                                                     tag used to identify the scratch org pool
  -v, --targetdevhubusername=targetdevhubusername                                   username or alias for the dev hub org; overrides default dev hub org
  --apiversion=apiversion                                                           override the api version used for api requests made by this command
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for this command invocation

EXAMPLES
  $ sfdx sfpowerkit:pool:list -t core
  $ sfdx sfpowerkit:pool:list -t core -v devhub
  $ sfdx sfpowerkit:pool:list -t core -v devhub -m
  $ sfdx sfpowerkit:pool:list -t core -v devhub -m -a
```

## `sfpowerkit:pool:delete`

Deletes the pooled scratch orgs from the Scratch Org Pool

```
USAGE
  $ sfdx sfpowerkit:pool:delete -t <string> [-m] [-a] [-v <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -a, --allscratchorgs                                                              Deletes all used and unused Scratch orgs from pool by the tag
  -m, --mypool                                                                      Filter only Scratch orgs created by current user in the pool
  -t, --tag=tag                                                                     (required) tag used to identify the scratch org pool
  -v, --targetdevhubusername=targetdevhubusername                                   username or alias for the dev hub org; overrides default dev hub org
  --apiversion=apiversion                                                           override the api version used for api requests made by this command
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for this command invocation

EXAMPLES
  $ sfdx sfpowerkit:pool:delete -t core
  $ sfdx sfpowerkit:pool:delete -t core -v devhub
  $ sfdx sfpowerkit:pool:delete -t core -v devhub -m
  $ sfdx sfpowerkit:pool:delete -t core -v devhub -m -a
```
