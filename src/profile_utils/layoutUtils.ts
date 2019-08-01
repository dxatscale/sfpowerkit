import BaseUtils from "./baseUtils";
import { Layout } from "./schema";
import EntityDefinitionUtils from "./entityDefinitionUtils";
import { Org } from "@salesforce/core";
import { METADATA_INFO } from "../shared/metadataInfo";
import _ from "lodash";

const QUERY = "SELECT Id, Name, EntityDefinitionId, NamespacePrefix From Layout ";

export default class LayoutUtils extends BaseUtils<Layout> {
  private static instance: LayoutUtils;
  private constructor(public org: Org) {
    super(org, true);
    super.setQuery(QUERY);
  }

  public static getInstance(org: Org): LayoutUtils {
    if (!LayoutUtils.instance) {
      LayoutUtils.instance = new LayoutUtils(org);
    }
    return LayoutUtils.instance;
  }

  public async getObjects(): Promise<Layout[]> {
    if (
      ( this.data === undefined ||
        this.data.length == 0) &&
      !this.dataLoaded
    ) {
      let entityDefinitionUtils = EntityDefinitionUtils.getInstance(
        this.org
      );

      super.setQuery(QUERY);
      let layouts = await super.getObjects();
      for (let i = 0; i < layouts.length; i++) {
        layouts[i].ObjectName = await entityDefinitionUtils.getObjectNameByDurableId(
          layouts[i].EntityDefinitionId
        );

        let namespace=""
        if(layouts[i].NamespacePrefix!==undefined && layouts[i].NamespacePrefix!=="" && layouts[i].NamespacePrefix!==null && layouts[i].NamespacePrefix!=="null"){
          namespace=layouts[i].NamespacePrefix+"__"
        }
        if (layouts[i].ObjectName !== null && layouts[i].ObjectName !== "") {
          layouts[i].FullName =
            layouts[i].ObjectName + "-" + namespace + layouts[i].Name.replace("/", "%2F");
        } else {
          layouts[i].FullName =
            layouts[i].EntityDefinitionId +
            "-" + namespace +
            layouts[i].Name.replace("/", "%2F");
        }
      }
      this.data = layouts;
      this.dataLoaded = true;
    }
    return this.data;
  }
  public async getLayouts(): Promise<Layout[]> {
    return await this.getObjects();
  }

  public async layoutExists(layout: string): Promise<boolean> {
    let found = false;
    //Look first in project files
    if (!_.isNil(METADATA_INFO.Layout.components)) {
      found = METADATA_INFO.Layout.components.includes(layout);
    }
    if (!found) {
      //not found, check on the org
      let layouts = await this.getLayouts();
      let foundLayout = layouts.find(l => {
        return l.FullName === layout;
      });
      found = !_.isNil(foundLayout);
    }
    return found;
  }

}
