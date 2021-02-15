import { FileProperties } from "../schema";
import { Org } from "@salesforce/core";
import * as _ from "lodash";
import { METADATA_INFO } from "../metadataInfo";
import MetadataFiles from "../metadataFiles";
import { SFPowerkit } from "./../../../sfpowerkit";

export default class ApexClassRetriever {
  private static instance: ApexClassRetriever;
  private static data: FileProperties[];
  private constructor(public org: Org) {
    this.org = org;
  }

  public static getInstance(org: Org): ApexClassRetriever {
    if (!ApexClassRetriever.instance) {
      ApexClassRetriever.instance = new ApexClassRetriever(org);
    }
    return ApexClassRetriever.instance;
  }

  public async getClasses(): Promise<FileProperties[]> {
    if (
      ApexClassRetriever.data === undefined ||
      ApexClassRetriever.data.length == 0
    ) {
      const apiversion: string = await SFPowerkit.getApiVersion();
      let items = await this.org.getConnection().metadata.list(
        {
          type: METADATA_INFO.ApexClass.xmlName,
        },
        apiversion
      );
      if (items === undefined || items === null) {
        items = [];
      }
      ApexClassRetriever.data = items;
    }
    return ApexClassRetriever.data;
  }

  public async classExists(cls: string): Promise<boolean> {
    let found = false;
    //Look first in project files
    if (!_.isNil(METADATA_INFO.ApexClass.components)) {
      found = METADATA_INFO.ApexClass.components.includes(cls);
    }
    if (!found && !MetadataFiles.sourceOnly) {
      //not found, check on the org
      let classes = await this.getClasses();
      let foundCls = classes.find((aCls) => {
        return aCls.fullName === cls;
      });
      found = !_.isNil(foundCls);
    }
    return found;
  }
}
