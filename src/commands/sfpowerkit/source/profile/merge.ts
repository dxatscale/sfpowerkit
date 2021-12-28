import {
  flags,
  FlagsConfig,
  SfdxResult,
} from "@salesforce/command";

import { Messages, SfdxError } from "@salesforce/core";

import * as _ from "lodash";
import { SFPowerkit } from "../../../../sfpowerkit";
import * as path from "path";
import { METADATA_INFO } from "../../../../impl/metadata/metadataInfo";
import ProfileRetriever from "../../../../impl/metadata/retriever/profileRetriever";
import ProfileMerge from "../../../../impl/source/profiles/profileMerge";
import SFPowerkitCommand from "../../../../sfpowerkitCommand";

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages("sfpowerkit", "profile_merge");

export default class Merge extends SFPowerkitCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:source:profile:merge -u sandbox`,
    `$ sfdx sfpowerkit:source:profile:merge -f force-app -n "My Profile" -r -u sandbox`,
    `$ sfdx sfpowerkit:source:profile:merge -f "module1, module2, module3" -n "My Profile1, My profile2"  -u sandbox`,
  ];

  //public static args = [{ name: 'file' }];

  protected static flagsConfig: FlagsConfig = {
    // flag with a value (-n, --name=VALUE)
    folder: flags.array({
      char: "f",
      description: messages.getMessage("folderFlagDescription"),
      required: false,
      map: (f: string) => f.trim(),
    }),
    profilelist: flags.array({
      char: "n",
      description: messages.getMessage("profileListFlagDescription"),
      required: false,
      map: (n: string) => n.trim(),
    }),
    metadata: flags.array({
      char: "m",
      description: messages.getMessage("metadataFlagDescription"),
      required: false,
      delimiter: ",",
      map: (val: string) => {
        let parts = val.split(":");
        return {
          MetadataType: parts[0].trim(),
          ApiName: parts.length >= 2 ? parts[1].trim() : "*",
        };
      },
    }),
    delete: flags.boolean({
      char: "d",
      description: messages.getMessage("deleteFlagDescription"),
      required: false,
    }),
    loglevel: flags.enum({
      description: "logging level for this command invocation",
      default: "info",
      required: false,
      options: [
        "trace",
        "debug",
        "info",
        "warn",
        "error",
        "fatal",
        "TRACE",
        "DEBUG",
        "INFO",
        "WARN",
        "ERROR",
        "FATAL",
      ],
    }),
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  //protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;

  public static result: SfdxResult = {
    tableColumnData: {
      columns: [
        { key: "state", label: "State" },
        { key: "fullName", label: "Full Name" },
        { key: "type", label: "Type" },
        { key: "path", label: "Path" },
      ],
    },
    display() {
      if (Array.isArray(this.data) && this.data.length) {
        this.ux.table(this.data, this.tableColumnData);
      }
    },
  };

  public async execute(): Promise<any> {
    let argFolder = this.flags.folder;
    let argProfileList = this.flags.profilelist;
    let argMetadatas = this.flags.metadata;

    let metadatas = undefined;
    let invalidArguments = [];

    if (argMetadatas !== undefined) {
      metadatas = {};
      ProfileRetriever.supportedMetadataTypes.forEach((val) => {
        metadatas[val] = [];
      });
      for (let i = 0; i < argMetadatas.length; i++) {
        if (
          ProfileRetriever.supportedMetadataTypes.includes(
            argMetadatas[i].MetadataType
          )
        ) {
          metadatas[argMetadatas[i].MetadataType].push(argMetadatas[i].ApiName);
        } else {
          invalidArguments.push(argMetadatas[i].MetadataType);
        }
      }
      if (invalidArguments.length > 0) {
        throw new SfdxError(
          "Metadata(s) " +
            invalidArguments.join(", ") +
            " is/are not supported.",
          "InvalidArgumentError"
        );
      }
    }

    if (!_.isNil(argFolder) && argFolder.length !== 0) {
      SFPowerkit.setDefaultFolder(argFolder[0]);
    }
    ``;

    const profileUtils = new ProfileMerge(
      this.org,
      this.flags.loglevel == "debug"
    );

    let mergedProfiles = await profileUtils.merge(
      argFolder,
      argProfileList || [],
      metadatas,
      this.flags.delete
    );

    let result = [];
    if (mergedProfiles.added) {
      mergedProfiles.added.forEach((file) => {
        result.push({
          state: "Add",
          fullName: path.basename(file, METADATA_INFO.Profile.sourceExtension),
          type: "Profile",
          path: path.relative(process.cwd(), file),
        });
      });
    }
    if (mergedProfiles.updated) {
      mergedProfiles.updated.forEach((file) => {
        result.push({
          state: "Merged",
          fullName: path.basename(file, METADATA_INFO.Profile.sourceExtension),
          type: "Profile",
          path: path.relative(process.cwd(), file),
        });
      });
    }
    if (this.flags.delete) {
      if (mergedProfiles.deleted) {
        mergedProfiles.deleted.forEach((file) => {
          result.push({
            state: "Deleted",
            fullName: path.basename(
              file,
              METADATA_INFO.Profile.sourceExtension
            ),
            type: "Profile",
            path: path.relative(process.cwd(), file),
          });
        });
      }
    } else {
      if (mergedProfiles.deleted) {
        mergedProfiles.deleted.forEach((file) => {
          result.push({
            state: "Skipped",
            fullName: path.basename(
              file,
              METADATA_INFO.Profile.sourceExtension
            ),
            type: "Profile",
            path: path.relative(process.cwd(), file),
          });
        });
      }
    }

    return result;
  }
}
