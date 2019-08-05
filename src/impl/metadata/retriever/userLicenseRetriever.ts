import { UserLicence } from "../schema";
import { Org } from "@salesforce/core";
import _ from "lodash";
import BaseMetadataRetriever from "../../metadata/retriever/baseMetadataretriever";

const QUERY = "Select Id, Name, LicenseDefinitionKey From UserLicense";
export default class UserLicenseRetriever extends BaseMetadataRetriever<
  UserLicence
> {
  private static instance: UserLicenseRetriever;
  private constructor(public org: Org) {
    super(org, false);
    super.setQuery(QUERY);
  }

  public static getInstance(org: Org): UserLicenseRetriever {
    if (!UserLicenseRetriever.instance) {
      UserLicenseRetriever.instance = new UserLicenseRetriever(org);
    }
    return UserLicenseRetriever.instance;
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
    let foundLicense = licenses.find(aLicense => {
      return aLicense.Name === license;
    });
    return !_.isNil(foundLicense);
  }
}
