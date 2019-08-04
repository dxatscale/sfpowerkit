import { Org } from "@salesforce/core";
import { Connection } from "@salesforce/core";
import { SfPowerKit } from "../../../sfpowerkit";
import MetadataFiles from "../../../shared/metadataFiles";
import * as fs from "fs";
import * as path from "path";
import { METADATA_INFO } from "../../../shared/metadataInfo";
import Profile from "../../../impl/metadata/schema";
import _ from "lodash";
import ProfileActions from "./profileActions";

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
    if (this.debugFlag) SfPowerKit.ux.log("Retrieving profiles");
    this.metadataFiles = new MetadataFiles();
    for (let i = 0; i < srcFolders.length; i++) {
      let srcFolder = srcFolders[i];
      let normalizedPath = path.join(process.cwd(), srcFolder);
      this.metadataFiles.loadComponents(normalizedPath);
    }
    let profileList: string[] = [];
    let profileNames: string[] = [];
    let profilePathAssoc = {};
    let profileStatus = await this.getProfileFullNamesWithLocalStatus(profiles);
    let metadataFiles = _.union(profileStatus.added, profileStatus.updated);
    metadataFiles.sort();
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
    SfPowerKit.ux.log(
      "Number of profiles found in the target org " + profileNames.length
    );
    for (i = 0, j = profileNames.length; i < j; i += chunk) {
      temparray = profileNames.slice(i, i + chunk);
      //SfPowerKit.ux.log(temparray.length);
      let start = i + 1;
      let end = i + chunk;
      SfPowerKit.ux.log("Loading profiles in batches " + start + " to " + end);

      var metadataList = await this.profileRetriever.loadProfiles(
        temparray,
        this.conn
      );
      for (var count = 0; count < metadataList.length; count++) {
        var profileObj = metadataList[count] as Profile;

        await this.profileRetriever.writeProfile(
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
