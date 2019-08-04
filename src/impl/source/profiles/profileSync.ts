import { Org } from "@salesforce/core";
import { Connection } from "@salesforce/core";
import { SfPowerKit } from "../../../sfpowerkit";
import MetadataFiles from "../../../shared/metadataFiles";
import * as fs from "fs";
import * as path from "path";
import xml2js = require("xml2js");
import { METADATA_INFO } from "../../../shared/metadataInfo";
import ProfileRetriever from "../../metadata/retriever/profileRetriever";
import FileUtils from "../../../shared/fileutils";
import { retrieveMetadata } from "../../../shared/retrieveMetadata";
import Profile from "../../../impl/metadata/schema";
import _ from "lodash";

const unsupportedprofiles = [];

export default class ProfileSync {
  conn: Connection;
  metadataFiles: MetadataFiles;
  profileRetriever: ProfileRetriever;

  public constructor(public org: Org, private debugFlag?: boolean) {
    this.conn = this.org.getConnection();
    this.profileRetriever = new ProfileRetriever(org, debugFlag);
  }

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
    let profileStatus = await this.getMetadataComponents(profiles);
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

        profileObj = await this.profileRetriever.handlePermissions(profileObj);

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

  private async getMetadataComponents(
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
