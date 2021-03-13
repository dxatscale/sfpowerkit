# Prerequisite for ScratchOrg Pooling

Deploy the following additions to standard object "ScratchOrgInfo" such as a custom fields, validation rule, and workflow to a DevHub as prerequisites to enable the associated scratch org pool commands to work.

## Installing the Unlocked package to your DevHub from URL

1. Login to your DevHub
2. Click [here](https://login.salesforce.com/packaging/installPackage.apexp?p0=04t1P000000gOkXQAU) to install the **sfpower-scratchorg-pool** unlocked package into your DevHub.
3. Select **Install for Admin Only**

## Installing the Unlocked package to your DevHub from CLI

```
git clone https://github.com/Accenture/sfpowerkit

cd sfpowerkit/src_salesforce_packages/scratchorgpool

sfdx force:package:install -p sfpower-scratchorg-pool@1.0.0-1 -u Devhub -r -a package -s AdminsOnly -w 30
```

## Deploy the app to your DevHub from CLI

Install the supporting fields and validation rule to DevHub

```
git clone https://github.com/Accenture/sfpowerkit

cd sfpowerkit/src_salesforce_packages/scratchorgpool

sfdx force:source:deploy -p force-app -u Devhub -w 30
```
