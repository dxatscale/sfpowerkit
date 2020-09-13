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
      METADATA_INFO.Profile.files.forEach(element => {
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
      for (var i = 0; i < metadataFiles.length; i++) {
        var profileComponent = metadataFiles[i];
        var profileName = path.basename(
          profileComponent,
          METADATA_INFO.Profile.sourceExtension
        );

        var supported = !unsupportedprofiles.includes(profileName);
        if (supported) {
          profilePathAssoc[profileName] = profileComponent;
          profileNames.push(profileName);
        }
      }

      var i: number,
        j: number,
        chunk: number = 10;
      var temparray;
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

        var metadataList = await this.profileRetriever.loadProfiles(
          temparray,
          this.conn
        );

        let profileWriter = new ProfileWriter();
        for (var count = 0; count < metadataList.length; count++) {
          var profileObj = metadataList[count] as Profile;

          profileWriter.writeProfile(
            profileObj,
            profilePathAssoc[profileObj.fullName]
          );
          //profileList.push(profileObj.fullName);
        }
        progressBar.increment(j - i > chunk ? chunk : j - i);
      }
      progressBar.stop();
    } else {
      SFPowerkit.log(`No Profiles found to retrieve`, LoggerLevel.INFO);
    }

    if (profileStatus.deleted && isdelete) {
      profileStatus.deleted.forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });
    }
    return Promise.resolve(profileStatus);
  }
}
