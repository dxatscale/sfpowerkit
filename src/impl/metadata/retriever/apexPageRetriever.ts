import { FileProperties } from "../schema";
import { Org } from "@salesforce/core";
import * as _ from "lodash";
import { METADATA_INFO } from "../metadataInfo";
import { SFPowerkit } from "./../../../sfpowerkit";
import MetadataFiles from "../metadataFiles";

const QUERY = "Select Id, Name, NameSpacePrefix From ApexPage";
export default class ApexPageRetriever {
  private static instance: ApexPageRetriever;
  private static data: FileProperties[];
  private constructor(public org: Org) {
    this.org = org;
  }

  public static getInstance(org: Org): ApexPageRetriever {
    if (!ApexPageRetriever.instance) {
      ApexPageRetriever.instance = new ApexPageRetriever(org);
    }
    return ApexPageRetriever.instance;
  }

  public async getPages(): Promise<FileProperties[]> {
    if (
      ApexPageRetriever.data === undefined ||
      ApexPageRetriever.data.length == 0
    ) {
      const apiversion: string = await SFPowerkit.getApiVersion();
      let items = await this.org.getConnection().metadata.list(
        {
          type: METADATA_INFO.ApexPage.xmlName,
        },
        apiversion
      );
      if (items === undefined || items === null) {
        items = [];
      }
      ApexPageRetriever.data = items;
    }
    return ApexPageRetriever.data;
  }

  public async pageExists(page: string): Promise<boolean> {
    let found = false;
    //Look first in project files
    if (!_.isNil(METADATA_INFO.ApexPage.components)) {
      found = METADATA_INFO.ApexPage.components.includes(page);
    }
    if (!found && !MetadataFiles.sourceOnly) {
      //not found, check on the org
      let pages = await this.getPages();
      let foundPage = pages.find((p) => {
        return p.fullName === page;
      });
      found = !_.isNil(foundPage);
    }
    return found;
  }
}
