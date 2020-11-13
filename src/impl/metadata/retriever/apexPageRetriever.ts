import { ApexPage } from "../schema";
import { Org } from "@salesforce/core";
import * as _ from "lodash";
import { METADATA_INFO } from "../metadataInfo";
import BaseMetadataRetriever from "./baseMetadataRetriever";
import MetadataFiles from "../metadataFiles";

const QUERY = "Select Id, Name, NameSpacePrefix From ApexPage";
export default class ApexPageRetriever extends BaseMetadataRetriever<ApexPage> {
  private static instance: ApexPageRetriever;
  private constructor(public org: Org) {
    super(org, true);
    super.setQuery(QUERY);
  }

  public static getInstance(org: Org): ApexPageRetriever {
    if (!ApexPageRetriever.instance) {
      ApexPageRetriever.instance = new ApexPageRetriever(org);
    }
    return ApexPageRetriever.instance;
  }

  public async getObjects(): Promise<ApexPage[]> {
    if (
      (this.data === undefined || this.data.length == 0) &&
      !this.dataLoaded
    ) {
      super.setQuery(QUERY);
      let pages = await super.getObjects();
      if (pages != undefined && pages.length > 0) {
        for (let i = 0; i < pages.length; i++) {
          let page = pages[i];
          if (!_.isNil(page.NamespacePrefix)) {
            page.FullName = `${page.NamespacePrefix}__${page.Name}`;
          } else {
            page.FullName = page.Name;
          }
        }
      }
      this.data = pages;
      this.dataLoaded = true;
    }
    return this.data;
  }
  public async getPages(): Promise<ApexPage[]> {
    return await this.getObjects();
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
        return p.FullName === page;
      });
      found = !_.isNil(foundPage);
    }
    return found;
  }
}
