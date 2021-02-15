import { Org } from "@salesforce/core";
import * as _ from "lodash";
import { METADATA_INFO } from "../metadataInfo";
import { FileProperties } from "../schema";
import MetadataFiles from "../metadataFiles";
import { SFPowerkit } from "./../../../sfpowerkit";

export default class CustomApplicationRetriever {
  private static instance: CustomApplicationRetriever;
  private static data: FileProperties[];
  private constructor(public org: Org) {
    this.org = org;
  }

  public static getInstance(org: Org): CustomApplicationRetriever {
    if (!CustomApplicationRetriever.instance) {
      CustomApplicationRetriever.instance = new CustomApplicationRetriever(org);
    }
    return CustomApplicationRetriever.instance;
  }

  public async getApps(): Promise<FileProperties[]> {
    if (
      CustomApplicationRetriever.data === undefined ||
      CustomApplicationRetriever.data.length == 0
    ) {
      const apiversion: string = await SFPowerkit.getApiVersion();
      let items = await this.org.getConnection().metadata.list(
        {
          type: METADATA_INFO.CustomApplication.xmlName,
        },
        apiversion
      );
      if (items === undefined || items === null) {
        items = [];
      }
      CustomApplicationRetriever.data = items;
    }
    return CustomApplicationRetriever.data;
  }

  public async appExists(application: string): Promise<boolean> {
    let found = false;
    //Look first in project files
    if (!_.isNil(METADATA_INFO.CustomApplication.components)) {
      found = METADATA_INFO.CustomApplication.components.includes(application);
    }
    if (!found && !MetadataFiles.sourceOnly) {
      //not found, check on the org
      let apps = await this.getApps();
      let foundApp = apps.find((app) => {
        return app.fullName === application;
      });
      found = !_.isNil(foundApp);
    }
    return found;
  }
}
