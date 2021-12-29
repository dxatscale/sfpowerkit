import { SFPowerkit } from "../../../sfpowerkit";
import MetadataFiles from "../../metadata/metadataFiles";
import * as fs from "fs-extra";
import * as path from "path";
import * as xml2js from "xml2js";
import { METADATA_INFO } from "../../metadata/metadataInfo";
import Profile, { ProfileFieldLevelSecurity } from "../../metadata/schema";
import * as util from "util";
import * as _ from "lodash";
import ProfileActions from "./profileActions";
import FileUtils from "../../../utils/fileutils";
import ProfileWriter from "../../../impl/metadata/writer/profileWriter";
import { LoggerLevel } from "@salesforce/core";
import UserPermissionBuilder from "../../metadata/builder/userPermissionBuilder";
import MetadataRetriever from "../../metadata/retriever/metadataRetriever";
import ProfileRetriever from "../../metadata/retriever/profileRetriever";
import { Worker } from 'worker_threads';

export default class ProfileReconcile extends ProfileActions {
  metadataFiles: MetadataFiles;

  public async reconcile(
    srcFolders: string[],
    profileList: string[],
    destFolder: string
  ): Promise<string[]> {
    //Get supported permissions from the org

    this.createDestinationFolder(destFolder);
    SFPowerkit.log(
      `ProfileList ${JSON.stringify(profileList)}`,
      LoggerLevel.TRACE
    );

    if (_.isNil(srcFolders) || srcFolders.length === 0) {
      srcFolders = await SFPowerkit.getProjectDirectories();
    }

    //Fetch all the metadata in the project directory
    this.metadataFiles = this.fetchMetadataFilesFromAllPackageDirectories(
      srcFolders
    );
    SFPowerkit.log(
      `Project Directories ${JSON.stringify(srcFolders)}`,
      LoggerLevel.TRACE
    );

    //Translate the provided profileList if any with proper extension
    profileList = profileList.map((element) => {
      return element + METADATA_INFO.Profile.sourceExtension;
    });

    SFPowerkit.log(
      `Profiles Found in Entire Drirectory ${METADATA_INFO.Profile.files.length}`,
      LoggerLevel.TRACE
    );

    //Find Profiles to Reconcile
    let profilesToReconcile = this.findProfilesToReconcile(profileList);

    return this.runWorkers(profilesToReconcile, destFolder);
  }

  private runWorkers(profilesToReconcile:string[], destFolder){
    let workerCount=0;
    let finishedWorkerCount =0;
    let chunk=10; // One worker to process 10 profiles
    let i:number,
      j:number;

    let result: string[] = []; 

    let workerPromise = new Promise<string[]>((resolve, reject)=>{
      for (i = 0, j = profilesToReconcile.length; i < j; i += chunk) {
        workerCount++;
        let temparray:string[] = profilesToReconcile.slice(i, i + chunk);
        const worker = new Worker(path.resolve(__dirname, './worker.js') , {
          workerData: {
            profileChunk: temparray,
            destFolder: destFolder,
            targetOrg:  this.org.getUsername(),
            loglevel:  SFPowerkit.logLevelString,
            isJsonFormatEnabled:  SFPowerkit.isJsonFormatEnabled,
            path: './reconcileWorker.ts'
          }
        });
         
        worker.on('message', (data) => {
          result.push(...data);
        });

        worker.on('error', reject);
        worker.on('exit', (code) => {
          finishedWorkerCount++;
          SFPowerkit.log(`Worker exited. Worker Count: ${workerCount}, Finished Worker Count: ${finishedWorkerCount}`, LoggerLevel.DEBUG);
          if (code !== 0)
            //reject(new Error(`Worker stopped with exit code ${code}`));
            SFPowerkit.log(
              `Worker stopped with exit code ${code}`,
              LoggerLevel.ERROR
            );

          if(workerCount===finishedWorkerCount){
            resolve(result);
          }
        });
      }
    });
    return workerPromise;
  }

  public getReconcilePromise(profileComponent:string, destFolder:string):Promise<string[]>{
    let reconcilePromise = new Promise<string[]>((resolve, reject) => {
      let result: string[] = []; // Handle result of command execution
      SFPowerkit.log(
        "Reconciling profile " + profileComponent,
        LoggerLevel.INFO
      );
      let profileXmlString = fs.readFileSync(profileComponent);
      const parser = new xml2js.Parser({ explicitArray: true });
      const parseString = util.promisify(parser.parseString);
      parseString(profileXmlString).then(parseResult =>{
        let profileWriter = new ProfileWriter();
        let profileObj: Profile = profileWriter.toProfile(parseResult.Profile); // as Profile
        return profileObj;
      }).then(profileObj=>{
        return this.reconcileProfile(profileObj);
      }).then(profileObj=>{
        //write profile back
        let outputFile = profileComponent;
        if (!_.isNil(destFolder)) {
          outputFile = path.join(destFolder, path.basename(profileComponent));
        }
        let profileWriter = new ProfileWriter();
        profileWriter.writeProfile(profileObj, outputFile);
        result.push(outputFile);
        resolve(result);
        return result;
      }).catch(error=>{
        SFPowerkit.log(
          "|Error whipe processing file " + profileComponent + '. ERROR Message: ' + error.message,
          LoggerLevel.ERROR
        );
      });
    });
    return reconcilePromise;
  }
  private findProfilesToReconcile(profileList: string[]) {
    let profilesToReconcile;
    if (profileList.length > 0) {
      profilesToReconcile = [];
      profileList.forEach((profile) => {
        METADATA_INFO.Profile.files.forEach((file) => {
          if (path.basename(file) === profile) {
            profilesToReconcile.push(file);
          }
        });
      });
    } else {
      profilesToReconcile = METADATA_INFO.Profile.files;
    }
    return profilesToReconcile;
  }

  private fetchMetadataFilesFromAllPackageDirectories(srcFolders: string[]) {
    let metadataFiles = new MetadataFiles();
    srcFolders.forEach((srcFolder) => {
      let normalizedPath = path.join(process.cwd(), srcFolder);
      metadataFiles.loadComponents(normalizedPath);
    });
    return metadataFiles;
  }

  private createDestinationFolder(destFolder: string) {
    if (!_.isNil(destFolder)) {
      FileUtils.mkDirByPathSync(destFolder);
    }
  }

  private async removeUserPermissionNotAvailableInOrg(
    profileObj: Profile,
    supportedPermissions: string[]
  ) {
    if (
      profileObj.userPermissions !== undefined &&
      profileObj.userPermissions.length > 0
    ) {
      //Remove permission that are not present in the target org
      profileObj.userPermissions = profileObj.userPermissions.filter(
        (permission) => {
          let supported = supportedPermissions.includes(permission.name);
          return supported;
        }
      );
    }
  }

  private async removePermissionsBasedOnProjectConfig(profileObj: Profile) {
    let pluginConfig = await SFPowerkit.getConfig();
    let ignorePermissions = pluginConfig.ignoredPermissions || [];
    if (
      profileObj.userPermissions !== undefined &&
      profileObj.userPermissions.length > 0
    ) {
      profileObj.userPermissions = profileObj.userPermissions.filter(
        (permission) => {
          let supported = !ignorePermissions.includes(permission.name);
          return supported;
        }
      );
    }
  }

  private removeUnsupportedUserPermissions(profileObj: Profile) {
    //if sourceonly mode load profileRetriever
    if (MetadataFiles.sourceOnly && !this.profileRetriever) {
      this.profileRetriever = new ProfileRetriever(null, false);
    }
    let unsupportedLicencePermissions = this.profileRetriever.getUnsupportedLicencePermissions(
      profileObj.userLicense
    );
    if (
      profileObj.userPermissions != null &&
      profileObj.userPermissions.length > 0
    ) {
      profileObj.userPermissions = profileObj.userPermissions.filter(
        (permission) => {
          let supported = !unsupportedLicencePermissions.includes(
            permission.name
          );
          return supported;
        }
      );
    }
  }

  private async cleanupUserLicenses(profileObj: Profile) {
    if (!MetadataFiles.sourceOnly) {
      //Manage licences
      let userLicenseRetriever = new MetadataRetriever(
        this.conn,
        "UserLicense",
        METADATA_INFO
      );
      const isSupportedLicence = await userLicenseRetriever.isComponentExistsInTheOrg(
        profileObj.userLicense
      );
      if (!isSupportedLicence) {
        delete profileObj.userLicense;
      }
    }
  }

  private async reconcileApp(profileObj: Profile): Promise<void> {
    let customApplications = new MetadataRetriever(
      this.conn,
      METADATA_INFO.CustomApplication.xmlName,
      METADATA_INFO
    );
    if (profileObj.applicationVisibilities !== undefined) {
      let validArray = [];
      for (let i = 0; i < profileObj.applicationVisibilities.length; i++) {
        let cmpObj = profileObj.applicationVisibilities[i];
        let exist = await customApplications.isComponentExistsInProjectDirectoryOrInOrg(
          cmpObj.application
        );
        if (exist) {
          validArray.push(cmpObj);
        }
      }
      SFPowerkit.log(
        `Application Visiblitilties reduced from ${profileObj.applicationVisibilities.length}  to  ${validArray.length}`,
        LoggerLevel.DEBUG
      );
      profileObj.applicationVisibilities = validArray;
    }
  }

  private async reconcileClasses(profileObj: Profile): Promise<void> {
    let apexClasses = new MetadataRetriever(
      this.conn,
      METADATA_INFO.ApexClass.xmlName,
      METADATA_INFO
    );

    if (profileObj.classAccesses !== undefined) {
      if (!Array.isArray(profileObj.classAccesses)) {
        profileObj.classAccesses = [profileObj.classAccesses];
      }
      let validArray = [];
      for (let i = 0; i < profileObj.classAccesses.length; i++) {
        let cmpObj = profileObj.classAccesses[i];
        let exists = await apexClasses.isComponentExistsInProjectDirectoryOrInOrg(
          cmpObj.apexClass
        );
        if (exists) {
          validArray.push(cmpObj);
        }
      }

      SFPowerkit.log(
        `Class Access reduced from ${profileObj.classAccesses.length}  to  ${validArray.length}`,
        LoggerLevel.DEBUG
      );
      profileObj.classAccesses = validArray;
    }
  }

  private async reconcileFields(profileObj: Profile): Promise<void> {
    if (profileObj.fieldPermissions) {
      if (!Array.isArray(profileObj.fieldPermissions)) {
        profileObj.fieldPermissions = [profileObj.fieldPermissions];
      }
      let validArray: ProfileFieldLevelSecurity[] = [];
      for (let i = 0; i < profileObj.fieldPermissions.length; i++) {
        let fieldRetriever = new MetadataRetriever(
          this.conn,
          METADATA_INFO.CustomField.xmlName,
          METADATA_INFO
        );
        let cmpObj = profileObj.fieldPermissions[i];
        let parent = cmpObj.field.split(".")[0];
        let exists = await fieldRetriever.isComponentExistsInProjectDirectoryOrInOrg(
          cmpObj.field,
          parent
        );
        if (exists) {
          validArray.push(cmpObj);
        }
      }
      SFPowerkit.log(
        `Fields Level Permissions reduced from ${profileObj.fieldPermissions.length}  to  ${validArray.length}`,
        LoggerLevel.DEBUG
      );
      profileObj.fieldPermissions = validArray;
    }
  }

  private async reconcileLayouts(profileObj: Profile): Promise<void> {
    let layoutRetreiver = new MetadataRetriever(
      this.conn,
      METADATA_INFO.Layout.xmlName,
      METADATA_INFO
    );
    let recordTypeRetriever = new MetadataRetriever(
      this.conn,
      METADATA_INFO.RecordType.xmlName,
      METADATA_INFO
    );

    if (profileObj.layoutAssignments !== undefined) {
      var validArray = [];
      for (
        let count = 0;
        count < profileObj.layoutAssignments.length;
        count++
      ) {
        let cmpObj = profileObj.layoutAssignments[count];
        let exist =
          (await layoutRetreiver.isComponentExistsInProjectDirectoryOrInOrg(
            cmpObj.layout
          )) &&
          (_.isNil(cmpObj.recordType) ||
            (await recordTypeRetriever.isComponentExistsInProjectDirectoryOrInOrg(
              cmpObj.recordType
            )));
        if (exist) {
          validArray.push(cmpObj);
        }
      }
      SFPowerkit.log(
        `Layout Assignnments reduced from ${profileObj.layoutAssignments.length}  to  ${validArray.length}`,
        LoggerLevel.DEBUG
      );
      profileObj.layoutAssignments = validArray;
    }
  }

  private async reconcileObjects(profileObj: Profile): Promise<void> {
    let objectPermissionRetriever = new MetadataRetriever(
      this.conn,
      "ObjectPermissions",
      METADATA_INFO
    );
    let objectRetriever = new MetadataRetriever(
      this.conn,
      METADATA_INFO.CustomObject.xmlName,
      METADATA_INFO
    );

    if (profileObj.objectPermissions !== undefined) {
      if (!Array.isArray(profileObj.objectPermissions)) {
        profileObj.objectPermissions = [profileObj.objectPermissions];
      }
      let validArray = [];
      for (let i = 0; i < profileObj.objectPermissions.length; i++) {
        let cmpObj = profileObj.objectPermissions[i];

        //Check Object exist in Source Directory
        let exist = await objectRetriever.isComponentExistsInProjectDirectory(
          cmpObj.object
        );
        if (!exist)
          exist = await objectPermissionRetriever.isComponentExistsInTheOrg(
            cmpObj.object
          );

        if (exist) {
          validArray.push(cmpObj);
        }
      }
      SFPowerkit.log(
        `Object Permissions reduced from ${profileObj.objectPermissions.length}  to  ${validArray.length}`,
        LoggerLevel.DEBUG
      );
      profileObj.objectPermissions = validArray;
    }
  }

  private async reconcileCustomMetadata(profileObj: Profile): Promise<void> {
    let objectRetriever = new MetadataRetriever(
      this.conn,
      METADATA_INFO.CustomObject.xmlName,
      METADATA_INFO
    );

    if (profileObj.customMetadataTypeAccesses !== undefined) {
      if (!Array.isArray(profileObj.customMetadataTypeAccesses)) {
        profileObj.customMetadataTypeAccesses = [
          profileObj.customMetadataTypeAccesses,
        ];
      }
      let validArray = [];
      for (let i = 0; i < profileObj.customMetadataTypeAccesses.length; i++) {
        let cmpCM = profileObj.customMetadataTypeAccesses[i];
        let exist = await objectRetriever.isComponentExistsInProjectDirectoryOrInOrg(
          cmpCM.name
        );
        if (exist) {
          validArray.push(cmpCM);
        }
      }
      SFPowerkit.log(
        `CustomMetadata Access reduced from ${profileObj.customMetadataTypeAccesses.length}  to  ${validArray.length}`,
        LoggerLevel.DEBUG
      );
      profileObj.customMetadataTypeAccesses = validArray;
    }
  }

  private async reconcileCustomSettings(profileObj: Profile): Promise<void> {
    let objectRetriever = new MetadataRetriever(
      this.conn,
      METADATA_INFO.CustomObject.xmlName,
      METADATA_INFO
    );

    if (profileObj.customSettingAccesses !== undefined) {
      if (!Array.isArray(profileObj.customSettingAccesses)) {
        profileObj.customSettingAccesses = [profileObj.customSettingAccesses];
      }
      let validArray = [];
      for (let i = 0; i < profileObj.customSettingAccesses.length; i++) {
        let cmpCS = profileObj.customSettingAccesses[i];
        let exist = await objectRetriever.isComponentExistsInProjectDirectoryOrInOrg(
          cmpCS.name
        );
        if (exist) {
          validArray.push(cmpCS);
        }
      }
      SFPowerkit.log(
        `CustomSettings Access reduced from ${profileObj.customSettingAccesses.length}  to  ${validArray.length}`,
        LoggerLevel.DEBUG
      );
      profileObj.customSettingAccesses = validArray;
    }
  }

  private async reconcileExternalDataSource(
    profileObj: Profile
  ): Promise<void> {
    let externalDataSourceRetriever = new MetadataRetriever(
      this.conn,
      METADATA_INFO.ExternalDataSource.xmlName,
      METADATA_INFO
    );

    if (profileObj.externalDataSourceAccesses !== undefined) {
      if (!Array.isArray(profileObj.externalDataSourceAccesses)) {
        profileObj.externalDataSourceAccesses = [
          profileObj.externalDataSourceAccesses,
        ];
      }
      let validArray = [];
      for (let i = 0; i < profileObj.externalDataSourceAccesses.length; i++) {
        let dts = profileObj.externalDataSourceAccesses[i];
        let exist = await externalDataSourceRetriever.isComponentExistsInProjectDirectoryOrInOrg(
          dts.externalDataSource
        );
        if (exist) {
          validArray.push(dts);
        }
      }
      SFPowerkit.log(
        `ExternalDataSource Access reduced from ${profileObj.externalDataSourceAccesses.length}  to  ${validArray.length}`,
        LoggerLevel.DEBUG
      );
      profileObj.externalDataSourceAccesses = validArray;
    }
  }

  private async reconcileFlow(profileObj: Profile): Promise<void> {
    let flowRetreiver = new MetadataRetriever(
      this.conn,
      METADATA_INFO.Flow.xmlName,
      METADATA_INFO
    );

    if (profileObj.flowAccesses !== undefined) {
      if (!Array.isArray(profileObj.flowAccesses)) {
        profileObj.flowAccesses = [profileObj.flowAccesses];
      }
      let validArray = [];
      for (let i = 0; i < profileObj.flowAccesses.length; i++) {
        let flow = profileObj.flowAccesses[i];
        let exist = await flowRetreiver.isComponentExistsInProjectDirectoryOrInOrg(
          flow.flow
        );
        if (exist) {
          validArray.push(flow);
        }
      }
      SFPowerkit.log(
        `Flow Access reduced from ${profileObj.flowAccesses.length}  to  ${validArray.length}`,
        LoggerLevel.DEBUG
      );
      profileObj.flowAccesses = validArray;
    }
  }

  private async reconcileLoginFlow(profileObj: Profile): Promise<void> {
    let apexPageRetriver = new MetadataRetriever(
      this.conn,
      METADATA_INFO.ApexPage.xmlName,
      METADATA_INFO
    );

    let flowRetreiver = new MetadataRetriever(
      this.conn,
      METADATA_INFO.Flow.xmlName,
      METADATA_INFO
    );

    if (profileObj.loginFlows !== undefined) {
      if (!Array.isArray(profileObj.loginFlows)) {
        profileObj.loginFlows = [profileObj.loginFlows];
      }
      let validArray = [];
      for (let i = 0; i < profileObj.loginFlows.length; i++) {
        let loginFlow = profileObj.loginFlows[i];
        if (loginFlow.flow !== undefined) {
          let exist = await flowRetreiver.isComponentExistsInProjectDirectoryOrInOrg(
            loginFlow.flow
          );
          if (exist) {
            validArray.push(loginFlow);
          }
        } else if (loginFlow.vfFlowPage !== undefined) {
          let exist = await apexPageRetriver.isComponentExistsInProjectDirectoryOrInOrg(
            loginFlow.vfFlowPage
          );
          if (exist) {
            validArray.push(loginFlow);
          }
        }
      }
      SFPowerkit.log(
        `LoginFlows reduced from ${profileObj.loginFlows.length}  to  ${validArray.length}`,
        LoggerLevel.DEBUG
      );
      profileObj.loginFlows = validArray;
    }
  }

  private async reconcileCustomPermission(profileObj: Profile): Promise<void> {
    let customPermissionsRetriever = new MetadataRetriever(
      this.conn,
      METADATA_INFO.CustomPermission.xmlName,
      METADATA_INFO
    );

    if (profileObj.customPermissions !== undefined) {
      if (!Array.isArray(profileObj.customPermissions)) {
        profileObj.customPermissions = [profileObj.customPermissions];
      }
      let validArray = [];
      for (let i = 0; i < profileObj.customPermissions.length; i++) {
        let customPermission = profileObj.customPermissions[i];
        let exist = await customPermissionsRetriever.isComponentExistsInProjectDirectoryOrInOrg(
          customPermission.name
        );
        if (exist) {
          validArray.push(customPermission);
        }
      }
      SFPowerkit.log(
        `CustomPermission reduced from ${profileObj.customPermissions.length}  to  ${validArray.length}`,
        LoggerLevel.DEBUG
      );
      profileObj.customPermissions = validArray;
    }
  }

  private async reconcilePages(profileObj: Profile): Promise<void> {
    let apexPageRetriver = new MetadataRetriever(
      this.conn,
      METADATA_INFO.ApexPage.xmlName,
      METADATA_INFO
    );

    if (profileObj.pageAccesses !== undefined) {
      if (!Array.isArray(profileObj.pageAccesses)) {
        profileObj.pageAccesses = [profileObj.pageAccesses];
      }
      let validArray = [];
      for (let i = 0; i < profileObj.pageAccesses.length; i++) {
        let cmpObj = profileObj.pageAccesses[i];
        let exist = await apexPageRetriver.isComponentExistsInProjectDirectoryOrInOrg(
          cmpObj.apexPage
        );
        if (exist) {
          validArray.push(cmpObj);
        }
      }
      SFPowerkit.log(
        `Page Access Permissions reduced from ${profileObj.pageAccesses.length}  to  ${validArray.length}`,
        LoggerLevel.DEBUG
      );
      profileObj.pageAccesses = validArray;
    }
  }

  private async reconcileRecordTypes(profileObj: Profile): Promise<void> {
    let recordTypeRetriever = new MetadataRetriever(
      this.conn,
      METADATA_INFO.RecordType.xmlName,
      METADATA_INFO
    );

    if (profileObj.recordTypeVisibilities !== undefined) {
      if (!Array.isArray(profileObj.recordTypeVisibilities)) {
        profileObj.recordTypeVisibilities = [profileObj.recordTypeVisibilities];
      }
      let validArray = [];
      for (let i = 0; i < profileObj.recordTypeVisibilities.length; i++) {
        let cmpObj = profileObj.recordTypeVisibilities[i];
        let exist = await recordTypeRetriever.isComponentExistsInProjectDirectoryOrInOrg(
          cmpObj.recordType
        );
        if (exist) {
          validArray.push(cmpObj);
        }
      }
      SFPowerkit.log(
        `Record Type Visibilities reduced from ${profileObj.recordTypeVisibilities.length}  to  ${validArray.length}`,
        LoggerLevel.DEBUG
      );
      profileObj.recordTypeVisibilities = validArray;
    }
  }

  private async reconcileTabs(profileObj: Profile): Promise<void> {
    let tabRetriever = new MetadataRetriever(
      this.conn,
      METADATA_INFO.CustomTab.xmlName,
      METADATA_INFO
    );

    if (profileObj.tabVisibilities !== undefined) {
      if (!Array.isArray(profileObj.tabVisibilities)) {
        profileObj.tabVisibilities = [profileObj.tabVisibilities];
      }
      let validArray = [];
      for (let i = 0; i < profileObj.tabVisibilities.length; i++) {
        let cmpObj = profileObj.tabVisibilities[i];
        let exist = await tabRetriever.isComponentExistsInProjectDirectoryOrInOrg(
          cmpObj.tab
        );
        if (exist) {
          validArray.push(cmpObj);
        }
      }
      SFPowerkit.log(
        `Tab Visibilities reduced from ${profileObj.tabVisibilities.length}  to  ${validArray.length}`,
        LoggerLevel.DEBUG
      );
      profileObj.tabVisibilities = validArray;
    }
  }

  private async fetchPermissions() {
    let permissionRetriever = new MetadataRetriever(
      this.conn,
      "UserPermissions",
      METADATA_INFO
    );
    let permissionSets = await permissionRetriever.getComponents();
    let supportedPermissions = permissionSets.map((elem) => {
      return elem.fullName;
    });
    return supportedPermissions;
  }

  private async reconcileUserPermissions(profileObj: Profile) {
    if (
      profileObj.userPermissions === undefined ||
      profileObj.userPermissions.length === 0
    ) {
      return;
    }

    //Delete all user Permissions if the profile is standard one
    let isCustom = profileObj.custom;
    if (!isCustom) {
      delete profileObj.userPermissions;
      return;
    }

    //Remove unsupported userPermission
    this.removeUnsupportedUserPermissions(profileObj);

    let userPermissionBuilder: UserPermissionBuilder = new UserPermissionBuilder();
    //IS sourceonly, use ignorePermission set in sfdxProject.json file
    if (MetadataFiles.sourceOnly) {
      await this.removePermissionsBasedOnProjectConfig(profileObj);

      await userPermissionBuilder.handlePermissionDependency(profileObj, []);
    } else {
      let supportedPermissions = await this.fetchPermissions();
      await this.removeUserPermissionNotAvailableInOrg(
        profileObj,
        supportedPermissions
      );

      await userPermissionBuilder.handlePermissionDependency(
        profileObj,
        supportedPermissions
      );
    }
  }

  private async reconcileProfile(profileObj: Profile): Promise<Profile> {
    SFPowerkit.log("Reconciling App", LoggerLevel.DEBUG);
    await this.reconcileApp(profileObj);
    SFPowerkit.log("Reconciling Classes", LoggerLevel.DEBUG);
    await this.reconcileClasses(profileObj);
    SFPowerkit.log("Reconciling Fields", LoggerLevel.DEBUG);
    await this.reconcileFields(profileObj);
    SFPowerkit.log("Reconciling Objects", LoggerLevel.DEBUG);
    await this.reconcileObjects(profileObj);
    SFPowerkit.log("Reconciling Pages", LoggerLevel.DEBUG);
    await this.reconcilePages(profileObj);
    SFPowerkit.log("Reconciling Layouts", LoggerLevel.DEBUG);
    await this.reconcileLayouts(profileObj);
    SFPowerkit.log("Reconciling Record Types", LoggerLevel.DEBUG);
    await this.reconcileRecordTypes(profileObj);
    SFPowerkit.log("Reconciling  Tabs", LoggerLevel.DEBUG);
    await this.reconcileTabs(profileObj);
    SFPowerkit.log("Reconciling  ExternalDataSources", LoggerLevel.DEBUG);
    await this.reconcileExternalDataSource(profileObj);
    SFPowerkit.log("Reconciling  CustomPermissions", LoggerLevel.DEBUG);
    await this.reconcileCustomPermission(profileObj);
    SFPowerkit.log("Reconciling  CustomMetadata", LoggerLevel.DEBUG);
    await this.reconcileCustomMetadata(profileObj);
    SFPowerkit.log("Reconciling  CustomSettings", LoggerLevel.DEBUG);
    await this.reconcileCustomSettings(profileObj);
    SFPowerkit.log("Reconciling  Flow", LoggerLevel.DEBUG);
    await this.reconcileFlow(profileObj);
    SFPowerkit.log("Reconciling  Login Flows", LoggerLevel.DEBUG);
    await this.reconcileLoginFlow(profileObj);
    SFPowerkit.log("Reconciling  User Licenses", LoggerLevel.DEBUG);
    await this.cleanupUserLicenses(profileObj);
    SFPowerkit.log("Reconciling  User Permissions", LoggerLevel.DEBUG);
    await this.reconcileUserPermissions(profileObj);
    return profileObj;
  }
}
