//Code is basically same from https://github.com/texei/texei-sfdx-plugin
// Just updated it for the revised cli core

import { core, flags, SfdxCommand } from "@salesforce/command";
import { SfdxError, Connection } from "@salesforce/core";
import { PackageDetail } from "../../../../impl/dependency/dependencyApi";
import dependencyApi from "../../../../impl/dependency/dependencyApi";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages("sfpowerkit", "install");

export default class Tree extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    "$ sfdx sfpowerkit:dependency:tree:package -u MyScratchOrg -p 04txxxxxxxxxx"
  ];

  protected static flagsConfig = {
    package: flags.string({
      char: "p",
      required: true,
      description:
        "package name, package version id, subscriber id that is installed in the org"
    }),
    result: flags.enum({
      description: "Dependency result in package or metadata",
      default: "metadata",
      char: "r",
      required: false,
      options: ["package", "metadata"]
    })
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;
  protected conn: Connection;
  protected installedPackagesMap: Map<string, PackageDetail>;
  protected dependencyMap: Map<string, string[]>;
  public async run(): Promise<any> {
    this.conn = this.org.getConnection();
    this.installedPackagesMap = await dependencyApi.getForcePackageInstalledList(
      this.conn
    );

    let requestPackage: PackageDetail;
    for (let pkg of this.installedPackagesMap.values()) {
      if (
        pkg.Id === this.flags.package ||
        pkg.Name === this.flags.package ||
        pkg.VersionId === this.flags.package
      ) {
        requestPackage = pkg;
        break;
      }
    }
    if (!requestPackage) {
      throw new SfdxError(
        `Unable to find the package ${
          this.flags.package
        } in ${this.org.getUsername()} org.`
      );
    }

    let packageMembers: string[] = await dependencyApi.getMemberFromPackage(
      this.conn,
      requestPackage.Id
    );
    this.dependencyMap = await dependencyApi.getdependencyMap(
      this.conn,
      packageMembers
    );

    if (this.dependencyMap.size) {
      if (this.flags.result === "metadata") {
        this.getDependentMetadatResult();
      } else {
        this.getDependentPackageResult();
      }
    }

    return 0;
  }
  private async getDependentPackageResult() {
    let pkgMemberMap: Map<
      string,
      string
    > = await dependencyApi.getMemberVsPackageMap(this.conn);
    let pkgdependency: Map<string, Set<string>> = new Map<
      string,
      Set<string>
    >();
    let memberList: Set<string> = new Set<string>();
    for (let member of this.dependencyMap.keys()) {
      this.dependencyMap.get(member).forEach(dependency => {
        memberList = pkgdependency.get(member) || new Set<string>();
        memberList.add(
          pkgMemberMap.has(dependency)
            ? this.installedPackagesMap.get(pkgMemberMap.get(dependency)).Name
            : "Org"
        );
        pkgdependency.set(member, memberList);
      });
    }
    console.log(pkgdependency);
  }
  private async getDependentMetadatResult() {
    console.log(this.dependencyMap);
  }
}
