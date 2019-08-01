import { core, SfdxCommand, flags, FlagsConfig } from "@salesforce/command";

import { SfdxProject, SfdxError } from "@salesforce/core";
import AcnProfileUtils from "../../../profile_utils/profileUtils";
import _ from "lodash";
import { SfPowerKit } from "../../../shared/sfpowerkit";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "profile_merge");

export default class Merge extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:profile:merge -u sandbox`,
    `$ sfdx sfpowerkit:profile:merge -f force-app -n "My Profile" -r -u sandbox`,
    `$ sfdx sfpowerkit:profile:merge -f "module1, module2, module3" -n "My Profile1, My profile2"  -u sandbox`
  ];

  //public static args = [{ name: 'file' }];

  protected static flagsConfig: FlagsConfig = {
    // flag with a value (-n, --name=VALUE)
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
      map: (n: string) => n.trim()
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
          ApiName: parts.length >= 2 ? parts[1].trim() : "*"
        };
      }
    })
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  //protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;
  public async run(): Promise<any> {
    // tslint:disable-line:no-any
    SfPowerKit.ux = this.ux;

    let argFolder = this.flags.folder;
    let argProfileList = this.flags.profilelist;
    let argMetadatas = this.flags.metadata;

    let metadatas = undefined;
    let invalidArguments = [];

    if (argMetadatas !== undefined) {
      metadatas = {};
      AcnProfileUtils.supportedMetadataTypes.forEach(val => {
        metadatas[val] = [];
      });
      for (let i = 0; i < argMetadatas.length; i++) {
        if (
          AcnProfileUtils.supportedMetadataTypes.includes(
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

    if (_.isNil(argFolder) || argFolder.length === 0) {
      argFolder = [];
      const dxProject = await SfdxProject.resolve();
      const project = await dxProject.retrieveSfdxProjectJson();

      let packages = (project.get("packageDirectories") as any[]) || [];
      packages.forEach(element => {
        argFolder.push(element.path);
        if (element.default) {
          SfPowerKit.defaultFolder = element.path;
        }
      });
    } else {
      SfPowerKit.defaultFolder = argFolder[0];
    }

    const profileUtils = new AcnProfileUtils(this.org);

    var mergedProfiles = await profileUtils.merge(
      argFolder,
      argProfileList || [],
      metadatas
    );

    return mergedProfiles;
  }
}
