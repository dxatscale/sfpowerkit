import BaseUtils from "./baseUtils";
import { UserLicence } from "./schema";
import { Org } from "@salesforce/core";
import _ from "lodash";

const QUERY =
  "Select Id, Name, LicenseDefinitionKey From UserLicense";
export default class UserLicenceUtils extends BaseUtils<UserLicence> {
  private static instance: UserLicenceUtils;
  private constructor(public org: Org) {
    super(org, false);
    super.setQuery(QUERY);
  }

  public static getInstance(org: Org): UserLicenceUtils {
    if (!UserLicenceUtils.instance) {
      UserLicenceUtils.instance = new UserLicenceUtils(org);
    }
    return UserLicenceUtils.instance;
  }

  public async getObjects(): Promise<UserLicence[]> {
    if (
      (this.data === undefined || this.data.length == 0) &&
      !this.dataLoaded
    ) {
      super.setQuery(QUERY);
      this.data = await super.getObjects();
      this.dataLoaded = true;
    }
    return this.data;
  }
  public async getUserLicenses(): Promise<UserLicence[]> {
    return await this.getObjects();
  }

  public async userLicenseExists(license: string): Promise<boolean> {
    let licenses = await this.getUserLicenses();
    let foundLicense=licenses.find(aLicense => {
      return aLicense.Name === license;
    });
    return !_.isNil(foundLicense)
  }
}
