import { METADATA_INFO } from "../../metadata/metadataInfo";
import { SFPowerkit, LoggerLevel } from "../../../sfpowerkit";
import * as path from "path";
import FileUtils from "../../../utils/fileutils";
import { retrieveMetadata } from "../../../utils/retrieveMetadata";

import { Connection, Org } from "@salesforce/core";
import ProfileRetriever from "../../metadata/retriever/profileRetriever";

export default abstract class ProfileActions {
  protected conn: Connection;
  private debugFlag: boolean;
  protected profileRetriever: ProfileRetriever;

  public constructor(public org: Org, debugFlag?: boolean) {
    if (this.org) {
      this.conn = this.org.getConnection();
      this.profileRetriever = new ProfileRetriever(
        org.getConnection(),
        debugFlag
      );
    }
    this.debugFlag = debugFlag;
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
      updated: [],
    };
    let metadataFiles = METADATA_INFO.Profile.files || [];

    //generate path for new profiles
    let profilePath = path.join(
      process.cwd(),
      await SFPowerkit.getDefaultFolder(),
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

    // Query the profiles from org
    const profiles = await retrieveMetadata(
      [{ type: "Profile", folder: null }],
      this.conn
    );

    if (profileNames && profileNames.length > 0) {
      for (let i = 0; i < profileNames.length; i++) {
        let profileName = profileNames[i];
        let found = false;

        for (let j = 0; j < metadataFiles.length; j++) {
          let profileComponent = metadataFiles[j];
          let oneName = path.basename(
            profileComponent,
            METADATA_INFO.Profile.sourceExtension
          );
          if (profileName === oneName) {
            profilesStatus.updated.push(profileComponent);
            found = true;
            break;
          }
        }

        if (!found) {
          for (let k = 0; k < profiles.length; k++) {
            if (profiles[k] === profileName) {
              let newProfilePath = path.join(
                profilePath,
                profiles[k] + METADATA_INFO.Profile.sourceExtension
              );
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
      SFPowerkit.log(
        "Load new profiles from server into the project directory",
        LoggerLevel.DEBUG
      );

      profilesStatus.deleted = metadataFiles.filter((file) => {
        let oneName = path.basename(
          file,
          METADATA_INFO.Profile.sourceExtension
        );
        return !profiles.includes(oneName);
      });
      profilesStatus.updated = metadataFiles.filter((file) => {
        let oneName = path.basename(
          file,
          METADATA_INFO.Profile.sourceExtension
        );
        return profiles.includes(oneName);
      });

      if (profiles && profiles.length > 0) {
        let newProfiles = profiles.filter((profileObj) => {
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
          SFPowerkit.log("New profiles founds", LoggerLevel.DEBUG);
          for (let i = 0; i < newProfiles.length; i++) {
            SFPowerkit.log(newProfiles[i], LoggerLevel.DEBUG);
            let newPRofilePath = path.join(
              profilePath,
              newProfiles[i] + METADATA_INFO.Profile.sourceExtension
            );
            profilesStatus.added.push(newPRofilePath);
          }
        } else {
          SFPowerkit.log(
            "No new profile found, Updating existing profiles",
            LoggerLevel.INFO
          );
        }
      }
    }
    return Promise.resolve(profilesStatus);
  }
}
