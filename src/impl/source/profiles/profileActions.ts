import { METADATA_INFO } from "../../../shared/metadataInfo";
import { SfPowerKit } from "../../../sfpowerkit";
import * as path from "path";
import FileUtils from "../../../shared/fileutils";
import { retrieveMetadata } from "../../../shared/retrieveMetadata";
import { Org } from "@salesforce/core";
import { Connection } from "@salesforce/core";
import ProfileRetriever from "../../metadata/retriever/profileRetriever";

export default abstract class ProfileActions {
  protected conn: Connection;
  protected debugFlag: boolean;
  protected profileRetriever: ProfileRetriever;

  public constructor(public org: Org, debugFlag?: boolean) {
    this.conn = this.org.getConnection();
    this.debugFlag = debugFlag;
    this.profileRetriever = new ProfileRetriever(org, debugFlag);
  }

  protected async getProfileFullNamesWithLocalStatus(
    profileNames: string[]
  ): Promise<{
    added: string[];
    deleted: string[];
    updated: string[];
  }> {
    let profilesStatus = {
      added: [],
      deleted: [],
      updated: []
    };
    let metadataFiles = METADATA_INFO.Profile.files || [];
    //generate path for new profiles
    let profilePath = path.join(
      process.cwd(),
      SfPowerKit.defaultFolder,
      "main",
      "default",
      "profiles"
    );
    if (metadataFiles && metadataFiles.length > 0) {
      profilePath = path.dirname(metadataFiles[0]);
    } else {
      //create folder structure
      FileUtils.mkDirByPathSync(profilePath);
    }

    if (profileNames && profileNames.length > 0) {
      metadataFiles = [];
      for (let i = 0; i < profileNames.length; i++) {
        let profileName = profileNames[i];
        let found = false;
        for (let j = 0; j < METADATA_INFO.Profile.files.length; j++) {
          let profileComponent = METADATA_INFO.Profile.files[j];
          let oneName = path.basename(
            profileComponent,
            METADATA_INFO.Profile.sourceExtension
          );
          if (profileName === oneName) {
            //metadataFiles.push(profileComponent);
            profilesStatus.updated.push(profileComponent);
            found = true;
            break;
          }
        }
        //Query the profile from the server

        let profiles = await retrieveMetadata(
          [{ type: "Profile", folder: null }],
          this.conn
        );

        if (!found) {
          for (let k = 0; k < profiles.length; k++) {
            if (profiles[k] === profileName) {
              let newProfilePath = path.join(
                profilePath,
                profiles[k] + METADATA_INFO.Profile.sourceExtension
              );
              //metadataFiles.push(newProfilePath);
              profilesStatus.added.push(newProfilePath);
              found = true;
              break;
            }
          }
        }
        if (!found) {
          profilesStatus.deleted.push(profileName);
        }
      }
    } else {
      if (this.debugFlag)
        SfPowerKit.ux.log(
          "Load new profiles from server into the project directory"
        );
      // Query the org
      const profiles = await retrieveMetadata(
        [{ type: "Profile", folder: null }],
        this.conn
      );

      profilesStatus.deleted = metadataFiles.filter(file => {
        let oneName = path.basename(
          file,
          METADATA_INFO.Profile.sourceExtension
        );
        return !profiles.includes(oneName);
      });
      profilesStatus.updated = metadataFiles.filter(file => {
        let oneName = path.basename(
          file,
          METADATA_INFO.Profile.sourceExtension
        );
        return profiles.includes(oneName);
      });

      if (profiles && profiles.length > 0) {
        let newProfiles = profiles.filter(profileObj => {
          let found = false;
          for (let i = 0; i < profilesStatus.updated.length; i++) {
            let profileComponent = profilesStatus.updated[i];
            let oneName = path.basename(
              profileComponent,
              METADATA_INFO.Profile.sourceExtension
            );
            //escape some caracters
            let onlineName = profileObj.replace("'", "%27");
            onlineName = onlineName.replace("/", "%2F");
            if (onlineName === oneName) {
              found = true;
              break;
            }
          }
          return !found;
        });
        if (newProfiles && newProfiles.length > 0) {
          if (this.debugFlag) SfPowerKit.ux.log("New profiles founds");
          for (let i = 0; i < newProfiles.length; i++) {
            if (this.debugFlag) SfPowerKit.ux.log(newProfiles[i]);
            let newPRofilePath = path.join(
              profilePath,
              newProfiles[i] + METADATA_INFO.Profile.sourceExtension
            );
            //metadataFiles.push(newPRofilePath);
            profilesStatus.added.push(newPRofilePath);
          }
        } else {
          SfPowerKit.ux.log("No new profile found, Updating existing profiles");
        }
      }
    }
    //metadataFiles = metadataFiles.sort();
    return Promise.resolve(profilesStatus);
  }
}
