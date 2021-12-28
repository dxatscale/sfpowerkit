import { SFPowerkit, LoggerLevel } from "../../../sfpowerkit";
import MetadataFiles from "../../metadata/metadataFiles";
import * as fs from "fs-extra";
import * as path from "path";
import { METADATA_INFO } from "../../metadata/metadataInfo";
import Profile from "../../../impl/metadata/schema";
import * as _ from "lodash";
import ProfileActions from "./profileActions";
import ProfileWriter from "../../../impl/metadata/writer/profileWriter";
import { ProgressBar } from "../../../ui/progressBar";
import MetadataRetriever from "../../metadata/retriever/metadataRetriever";

const unsupportedprofiles = [];

export default class ProfileSync extends ProfileActions {
  metadataFiles: MetadataFiles;

  public async sync(
    srcFolders: string[],
    profiles?: string[],
    isdelete?: boolean
  ): Promise<{
    added: string[];
    deleted: string[];
    updated: string[];
  }> {
    SFPowerkit.log("Retrieving profiles", LoggerLevel.DEBUG);
    if (!_.isNil(profiles) && profiles.length !== 0) {
      SFPowerkit.log("Requested  profiles are..", LoggerLevel.DEBUG);
      SFPowerkit.log(profiles, LoggerLevel.DEBUG);
    }

    let fetchNewProfiles = _.isNil(srcFolders) || srcFolders.length === 0;
    if (fetchNewProfiles) {
      srcFolders = await SFPowerkit.getProjectDirectories();
    }

    this.metadataFiles = new MetadataFiles();

    SFPowerkit.log("Source Folders are", LoggerLevel.DEBUG);
    SFPowerkit.log(srcFolders, LoggerLevel.DEBUG);

    for (let i = 0; i < srcFolders.length; i++) {
      let srcFolder = srcFolders[i];
      let normalizedPath = path.join(process.cwd(), srcFolder);
      this.metadataFiles.loadComponents(normalizedPath);
    }

    //get local profiles when profile path is provided
    if (!fetchNewProfiles && profiles.length < 1) {
      METADATA_INFO.Profile.files.forEach((element) => {
        let oneName = path.basename(
          element,
          METADATA_INFO.Profile.sourceExtension
        );
        profiles.push(oneName);
      });
    }

    //let profileList: string[] = [];
    let profileNames: string[] = [];
    let profilePathAssoc = {};
    let profileStatus = await this.getProfileFullNamesWithLocalStatus(profiles);

    let metadataFiles = [];
    if (fetchNewProfiles) {
      //Retriving local profiles and anything extra found in the org
      metadataFiles = _.union(profileStatus.added, profileStatus.updated);
    } else {
      //Retriving only local profiles
      metadataFiles = profileStatus.updated;
      profileStatus.added = [];
    }
    metadataFiles.sort();
    SFPowerkit.log(profileStatus, LoggerLevel.DEBUG);

    SFPowerkit.log(metadataFiles, LoggerLevel.TRACE);

    if (metadataFiles.length > 0) {
      for (let i = 0; i < metadataFiles.length; i++) {
        let profileComponent = metadataFiles[i];
        let profileName = path.basename(
          profileComponent,
          METADATA_INFO.Profile.sourceExtension
        );

        let supported = !unsupportedprofiles.includes(profileName);
        if (supported) {
          profilePathAssoc[profileName] = profileComponent;
          profileNames.push(profileName);
        }
      }

      let i: number,
        j: number,
        chunk = 10;
      let temparray;
      SFPowerkit.log(
        `Number of profiles found in the target org ${profileNames.length}`,
        LoggerLevel.INFO
      );

      let progressBar = new ProgressBar().create(
        `Loading profiles in batches `,
        ` Profiles`,
        LoggerLevel.INFO
      );
      progressBar.start(profileNames.length);
      for (i = 0, j = profileNames.length; i < j; i += chunk) {
        temparray = profileNames.slice(i, i + chunk);

        let metadataList = await this.profileRetriever.loadProfiles(temparray);

        let profileWriter = new ProfileWriter();
        for (let count = 0; count < metadataList.length; count++) {
          let profileObj = metadataList[count] as Profile;
          SFPowerkit.log("Reconciling  Tabs", LoggerLevel.DEBUG);
          await this.reconcileTabs(profileObj);
          let filePath = profilePathAssoc[profileObj.fullName];
          if(filePath){
            profileWriter.writeProfile(
              profileObj,
              profilePathAssoc[profileObj.fullName]
            );
          }
          else{
            SFPowerkit.log("File path not found...", LoggerLevel.DEBUG);
          }
          //profileList.push(profileObj.fullName);
        }
        progressBar.increment(j - i > chunk ? chunk : j - i);
      }
      progressBar.stop();
    } else {
      SFPowerkit.log(`No Profiles found to retrieve`, LoggerLevel.INFO);
    }

    if (profileStatus.deleted && isdelete) {
      profileStatus.deleted.forEach((file) => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });
    }
    return Promise.resolve(profileStatus);
  }

  private async reconcileTabs(profileObj: Profile): Promise<void> {
    let tabRetriever = new MetadataRetriever(
      this.org.getConnection(),
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
}
