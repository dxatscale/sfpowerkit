import BaseUtils from "./baseUtils";
import { CustomApplication } from "./schema";
import { Org } from "@salesforce/core";
import _ from "lodash";
import { METADATA_INFO } from "../shared/metadataInfo";

const QUERY =
  "Select Id, NamespacePrefix, DeveloperName, Label From CustomApplication ";
export default class AppUtils extends BaseUtils<CustomApplication> {
  private static instance: AppUtils;
  private constructor(public org: Org) {
    super(org, true);
    super.setQuery(QUERY);
  }

  public static getInstance(org: Org): AppUtils {
    if (!AppUtils.instance) {
      AppUtils.instance = new AppUtils(org);
    }
    return AppUtils.instance;
  }

  public async getObjects(): Promise<CustomApplication[]> {
    if (
      (this.data === undefined || this.data.length == 0) &&
      !this.dataLoaded
    ) {
      super.setQuery(QUERY);
      let apps = await super.getObjects();
      for (let i = 0; i < apps.length; i++) {
        let app = apps[i];
        if (!_.isNil(app.NamespacePrefix)) {
          app.FullName = `${app.NamespacePrefix}__${app.DeveloperName}`;
        } else {
          app.FullName = app.DeveloperName;
        }
      }
      this.data = apps;
      this.dataLoaded = true;
    }
    return this.data;
  }
  public async getApps(): Promise<CustomApplication[]> {
    return await this.getObjects();
  }

  public async appExists(application: string): Promise<boolean> {
    let found = false;
    //Look first in project files
    if (!_.isNil(METADATA_INFO.CustomApplication.components)) {
      found = METADATA_INFO.CustomApplication.components.includes(application);
    }
    if (!found) {
      //not found, check on the org
      let apps = await this.getApps();
      let foundApp = apps.find(app => {
        return app.FullName === application;
      });
      found = !_.isNil(foundApp);
    }
    return found;
  }
}
