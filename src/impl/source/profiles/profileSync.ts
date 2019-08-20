import { SFPowerkit } from "../../../sfpowerkit";
import MetadataFiles from "../../metadata/metadataFiles";
import * as fs from "fs";
import * as path from "path";
import { METADATA_INFO } from "../../metadata/metadataInfo";
import Profile from "../../../impl/metadata/schema";
import _ from "lodash";
import ProfileActions from "./profileActions";
import ProfileWriter from "../../../impl/metadata/writer/profileWriter";

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
    if (this.debugFlag) {
      SFPowerkit.ux.log("Retrieving profiles");
      SFPowerkit.ux.log("Requested  profiles are..");
      SFPowerkit.ux.logJson(profiles);
      SFPowerkit.ux.log("Retrieving profiles");
    }

    let fetchNewProfiles = _.isNil(srcFolders) || srcFolders.length === 0;
    if (fetchNewProfiles) {
      srcFolders = await SFPowerkit.getProjectDirectories();
    }

    this.metadataFiles = new MetadataFiles();

    if (this.debugFlag) {
      SFPowerkit.ux.log("Source Folders are");
      SFPowerkit.ux.logJson(srcFolders);
    }

    for (let i = 0; i < srcFolders.length; i++) {
      let srcFolder = srcFolders[i];
      let normalizedPath = path.join(process.cwd(), srcFolder);
      this.metadataFiles.loadComponents(normalizedPath);
    }

    let profileList: string[] = [];
    let profileNames: string[] = [];
    let profilePathAssoc = {};
    let profileStatus = await this.getProfileFullNamesWithLocalStatus(profiles);
    if (this.debugFlag) SFPowerkit.ux.logJson(profileStatus);
    let metadataFiles = profileStatus.updated || [];
    if (fetchNewProfiles) {
      metadataFiles = _.union(profileStatus.added, profileStatus.updated);
    } else {
      metadataFiles = profileStatus.added;
    }
    metadataFiles.sort();

    if (this.debugFlag) SFPowerkit.ux.logJson(metadataFiles);

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
    SFPowerkit.ux.log(
      "Number of profiles found in the target org " + profileNames.length
    );
    for (i = 0, j = profileNames.length; i < j; i += chunk) {
      temparray = profileNames.slice(i, i + chunk);
      //SfPowerKit.ux.log(temparray.length);
      let start = i + 1;
      let end = i + chunk;
      SFPowerkit.ux.log("Loading profiles in batches " + start + " to " + end);

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
        //SfPowerKit.ux.log("Profile " + profileObj.fullName + " Sync!");
        profileList.push(profileObj.fullName);
      }
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
