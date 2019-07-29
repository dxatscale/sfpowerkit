import BaseUtils from "./baseUtils";
import { TabDefinition } from "./schema";
import { Org } from "@salesforce/core";
import { METADATA_INFO } from "./metadataInfo";
import _ from "lodash";

const QUERY =
  "SELECT Id,  Name, SobjectName, DurableId, IsCustom, Label FROM TabDefinition ";
export default class TabUtils extends BaseUtils<TabDefinition> {
  private static instance:TabUtils;
  private constructor(public org: Org) {
    super(org, true);
    super.setQuery(QUERY);
  }

  public static getInstance(org: Org): TabUtils {
    if (!TabUtils.instance) {
      TabUtils.instance = new TabUtils(org);
    }
    return TabUtils.instance;
  }

  public async getObjects(): Promise<TabDefinition[]> {
    if (
      ( this.data === undefined ||
        this.data.length == 0) &&
      !this.dataLoaded
    ) {
      super.setQuery(QUERY);
      let tabs = await super.getObjects();
      this.data=tabs
      this.dataLoaded=true
    }
    return this.data
  }
  public async getTabs(): Promise<TabDefinition[]> {
    return await this.getObjects();
  }
  public async tabExists(tab: string): Promise<boolean> {
    let found = false;
    //Look first in project files
    if (!_.isNil(METADATA_INFO.CustomTab.components)) {
      found = METADATA_INFO.CustomTab.components.includes(tab);
    }
    if (!found) {
      //not found, check on the org
      let tabs = await this.getTabs();
      let foundTab = tabs.find(t => {
        return t.Name === tab;
      });
      found = !_.isNil(foundTab);
    }
    return found;
  }
}
