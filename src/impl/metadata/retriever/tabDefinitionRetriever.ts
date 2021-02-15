import { Org } from "@salesforce/core";
import { METADATA_INFO } from "../metadataInfo";
import * as _ from "lodash";
import { FileProperties } from "../schema";
import MetadataFiles from "../metadataFiles";
import { SFPowerkit } from "./../../../sfpowerkit";

const QUERY =
  "SELECT Id,  Name, SobjectName, DurableId, IsCustom, Label FROM TabDefinition ";
export default class TabDefinitionRetriever {
  private static instance: TabDefinitionRetriever;
  private static data: FileProperties[];
  private constructor(public org: Org) {
    this.org = org;
  }

  public static getInstance(org: Org): TabDefinitionRetriever {
    if (!TabDefinitionRetriever.instance) {
      TabDefinitionRetriever.instance = new TabDefinitionRetriever(org);
    }
    return TabDefinitionRetriever.instance;
  }

  public async getTabs(): Promise<FileProperties[]> {
    if (
      TabDefinitionRetriever.data === undefined ||
      TabDefinitionRetriever.data.length == 0
    ) {
      const apiversion: string = await SFPowerkit.getApiVersion();
      let items = await this.org.getConnection().metadata.list(
        {
          type: METADATA_INFO.CustomTab.xmlName,
        },
        apiversion
      );
      if (items === undefined || items === null) {
        items = [];
      }
      TabDefinitionRetriever.data = items;
    } else {
      TabDefinitionRetriever.data = [];
    }
    return TabDefinitionRetriever.data;
  }

  public async tabExists(tab: string): Promise<boolean> {
    let found = false;
    //Look first in project files
    if (!_.isNil(METADATA_INFO.CustomTab.components)) {
      found = METADATA_INFO.CustomTab.components.includes(tab);
    }
    if (!found && !MetadataFiles.sourceOnly) {
      //not found, check on the org
      let tabs = await this.getTabs();
      let foundTab = tabs.find((t) => {
        return t.fullName === tab;
      });
      found = !_.isNil(foundTab);
    }
    return found;
  }
}
