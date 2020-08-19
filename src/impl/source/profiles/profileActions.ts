import { METADATA_INFO } from "../../metadata/metadataInfo";
import { SFPowerkit, LoggerLevel } from "../../../sfpowerkit";
import * as path from "path";
import FileUtils from "../../../utils/fileutils";
import { retrieveMetadata } from "../../../utils/retrieveMetadata";

import { Connection, Org } from "@salesforce/core";
import ProfileRetriever from "../../metadata/retriever/profileRetriever";
import MetadataFiles from "../../../impl/metadata/metadataFiles";
import * as util from "util";
import * as _ from "lodash";
import * as fs from "fs-extra";
import * as xml2js from "xml2js";
import ProfileWriter from "../../../impl/metadata/writer/profileWriter";
import Profile from "../../../impl/metadata/schema";

export default abstract class ProfileActions {
  protected conn: Connection;
  protected debugFlag: boolean;
  protected profileRetriever: ProfileRetriever;
  protected metadataFiles: MetadataFiles;

  public constructor(public org: Org, debugFlag?: boolean) {
    if (this.org !== undefined) {
      this.conn = this.org.getConnection();
    }
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
    SFPowerkit.log(
      "getProfileFullNamesWithLocalStatus: Loading metadata files",
      LoggerLevel.DEBUG
    );
    let metadataFiles = METADATA_INFO.Profile.files || [];

    SFPowerkit.log("Generating path for new profiles", LoggerLevel.DEBUG);
    //generate path for new profiles
    let profilePath = path.join(process.cwd(), "main", "default", "profiles");
    try {
      profilePath = path.join(
        process.cwd(),
        await SFPowerkit.getDefaultFolder(),
        "main",
        "default",
        "profiles"
      );
    } catch (e) {}

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

  protected async readProfileFromFS(
    srcFolders: string[],
    profileList: string[]
  ) {
    if (_.isNil(srcFolders) || srcFolders.length === 0) {
      srcFolders = await SFPowerkit.getProjectDirectories();
    }
    this.metadataFiles = new MetadataFiles();
    srcFolders.forEach(srcFolder => {
      let normalizedPath = path.join(process.cwd(), srcFolder);
      this.metadataFiles.loadComponents(normalizedPath);
    });

    profileList = profileList.map(element => {
      return element + METADATA_INFO.Profile.sourceExtension;
    });

    if (!MetadataFiles.sourceOnly) {
      await this.profileRetriever.loadSupportedPermissions();
    }

    let profiles: Profile[] = [];
    for (let count = 0; count < METADATA_INFO.Profile.files.length; count++) {
      let profileComponent = METADATA_INFO.Profile.files[count];
      if (
        profileList.length == 0 ||
        profileList.includes(path.basename(profileComponent))
      ) {
        SFPowerkit.log(
          "Reconciling profile " + path.basename(profileComponent),
          LoggerLevel.INFO
        );

        let profileXmlString = fs.readFileSync(profileComponent);
        const parser = new xml2js.Parser({ explicitArray: true });
        const parseString = util.promisify(parser.parseString);
        let parseResult = await parseString(profileXmlString);
        let profileWriter = new ProfileWriter();

        let profileObj: Profile = profileWriter.toProfile(parseResult.Profile); // as Profile
        profiles.push(profileObj);
      }
    }
    return profiles;
  }
  protected async readProfileFromOrg(conn: Connection, profileList: string[]) {
    SFPowerkit.log("Retrieving profiles", LoggerLevel.DEBUG);
    SFPowerkit.log("Requested  profiles are..", LoggerLevel.DEBUG);
    SFPowerkit.log(profileList, LoggerLevel.DEBUG);

    let profileStatus = await this.getProfileFullNamesWithLocalStatus(
      profileList
    );
    SFPowerkit.log(profileStatus, LoggerLevel.DEBUG);

    let metadataFiles = _.union(profileStatus.added, profileStatus.updated);

    metadataFiles.sort();

    SFPowerkit.log(metadataFiles, LoggerLevel.TRACE);
    let profileNames: string[] = [];

    for (let profileComponent of metadataFiles) {
      var profileName = path.basename(
        profileComponent,
        METADATA_INFO.Profile.sourceExtension
      );
      profileNames.push(profileName);
    }

    let i: number,
      j: number,
      chunk: number = 10;
    let temparray;
    SFPowerkit.log(
      "Number of profiles found in the target org " + profileNames.length,
      LoggerLevel.INFO
    );

    let profiles: Profile[] = [];

    for (i = 0, j = profileNames.length; i < j; i += chunk) {
      temparray = profileNames.slice(i, i + chunk);
      //SfPowerKit.ux.log(temparray.length);
      let start = i + 1;
      let end = i + chunk;
      SFPowerkit.log(
        "Loading profiles in batches " + start + " to " + end,
        LoggerLevel.INFO
      );

      let metadataList = (await this.profileRetriever.loadProfiles(
        temparray,
        conn
      )) as Profile[];

      profiles.push(...metadataList);
    }
    return profiles;
  }
}
