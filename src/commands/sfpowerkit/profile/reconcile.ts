import { core, SfdxCommand, flags, FlagsConfig } from "@salesforce/command";

import { SfdxProject } from "@salesforce/core";
import _ from "lodash";
import AcnProfileUtils from "../../../profile_utils/profileUtils";
import { SfPowerKit } from "../../../shared/sfpowerkit";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "profile_reconcile");

export default class Reconcile extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:profile:reconcile  --folder force-app`,
    `$ sfdx sfpowerkit:profile:reconcile  --folder force-app,module2,module3 -u sandbox`,
    `$ sfdx sfpowerkit:profile:reconcile  -u myscratchorg`
  ];

  //public static args = [{name: 'file'}];

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
      description: messages.getMessage("nameFlagDescription"),
      required: false,
      map: (n: string) => n.trim()
    })
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  //protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  //protected static requiresProject = false;
  public async run(): Promise<any> {
    // tslint:disable-line:no-any
    SfPowerKit.ux = this.ux;

    let argFolder = this.flags.folder;
    let argProfileList = this.flags.profilelist;

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

    var profileUtils = new AcnProfileUtils(this.org);
    var reconcileProfiles = await profileUtils.reconcile(
      argFolder,
      argProfileList || []
    );

    // Return an object to be displayed with --json
    return { ReconciledProfile: reconcileProfiles };
  }
}
