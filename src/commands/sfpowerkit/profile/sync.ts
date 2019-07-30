import { core, SfdxCommand, flags, FlagsConfig } from "@salesforce/command";

import { SfdxProject } from "@salesforce/core";
import _ from "lodash";
import AcnProfileUtils from "../../../shared/profileUtils";
import { SfPowerKit } from "../../../shared/sfpowerkit";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "profile_sync");

export default class Sync extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:source:profile:sync -u prod`,
    `$ sfdx sfpowerkit:source:profile:sync  -f force-app -n "My Profile" -r -u prod`,
    `$ sfdx sfpowerkit:source:profile:sync  -f "module1, module2, module3" -n "My Profile1, My profile2"  -u prod`
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
    })
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;
  public async run(): Promise<any> {
    SfPowerKit.ux=this.ux;

    let argFolder: string = this.flags.folder;
    let argProfileList: string[] = this.flags.profilelist;

    var folders: string[] = [];
    if (_.isNil(argFolder) || argFolder === "") {
      const dxProject = await SfdxProject.resolve();
      const project = await dxProject.retrieveSfdxProjectJson();

      let packages = project.get("packageDirectories") as any[] || [];
      packages.forEach(element => {
        
        folders.push(element.path);
        if(element.default){
          SfPowerKit.defaultFolder=element.path;
        }
      
      });
    }

    const profileUtils = new AcnProfileUtils(this.org);

    let syncPofles = await profileUtils.sync(
      folders,
      argProfileList || []
    );

    return syncPofles;
  }
}
