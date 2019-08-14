import {
  core,
  SfdxCommand,
  flags,
  FlagsConfig,
  SfdxResult
} from "@salesforce/command";

import { SfdxProject } from "@salesforce/core";
import _ from "lodash";
import { SfPowerKit } from "../../../../sfpowerkit";
import * as path from "path";
import { METADATA_INFO } from "../../../../shared/metadataInfo";
import ProfileSync from "../../../../impl/source/profiles/profileSync";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "profile_retrieve");

export default class Retrieve extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:source:profile:retrieve -u prod`,
    `$ sfdx sfpowerkit:source:profile:retrieve  -f force-app -n "My Profile" -u prod`,
    `$ sfdx sfpowerkit:source:profile:retrieve  -f "module1, module2, module3" -n "My Profile1, My profile2"  -u prod`
  ];

  //public static args = [{ name: 'file' }];

  protected static flagsConfig: FlagsConfig = {
    folder: flags.array({
      char: "f",
      description: messages.getMessage("folderFlagDescription"),
      required: false,
      map: (f: string) => f.trim()
    }),
    profilelist: flags.array({
      char: "n",
      description: messages.getMessage("profileListFlagDescription"),
      required: false,
      map: (p: string) => p.trim()
    }),
    delete: flags.boolean({
      char: "d",
      description: messages.getMessage("deleteFlagDescription"),
      required: false
    })
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;

  public static result: SfdxResult = {
    tableColumnData: {
      columns: [
        { key: "state", label: "State" },
        { key: "fullName", label: "Full Name" },
        { key: "type", label: "Type" },
        { key: "path", label: "Path" }
      ]
    },
    display() {
      if (Array.isArray(this.data) && this.data.length) {
        this.ux.table(this.data, this.tableColumnData);
      }
    }
  };

  public async run(): Promise<any> {
    SfPowerKit.ux = this.ux;

    let argFolder: string = this.flags.folder;
    let argProfileList: string[] = this.flags.profilelist;

    let folders: string[] = [];
    if (!_.isNil(argFolder) && argFolder.length !== 0) {
      SfPowerKit.setDefaultFolder(argFolder[0]);
      folders.push(...argFolder);
    }

    const profileUtils = new ProfileSync(
      this.org,
      this.flags.loglevel == "debug"
    );

    let syncPofles = await profileUtils.sync(
      folders,
      argProfileList || [],
      this.flags.delete
    );

    let result = [];
    if (syncPofles.added) {
      syncPofles.added.forEach(file => {
        result.push({
          state: "Add",
          fullName: path.basename(file, METADATA_INFO.Profile.sourceExtension),
          type: "Profile",
          path: path.relative(process.cwd(), file)
        });
      });
    }
    if (syncPofles.updated) {
      syncPofles.updated.forEach(file => {
        result.push({
          state: "Updated",
          fullName: path.basename(file, METADATA_INFO.Profile.sourceExtension),
          type: "Profile",
          path: path.relative(process.cwd(), file)
        });
      });
    }
    if (syncPofles.deleted && this.flags.delete) {
      syncPofles.deleted.forEach(file => {
        result.push({
          state: "Deleted",
          fullName: path.basename(file, METADATA_INFO.Profile.sourceExtension),
          type: "Profile",
          path: path.relative(process.cwd(), file)
        });
      });
    }
    return result;
  }
}
