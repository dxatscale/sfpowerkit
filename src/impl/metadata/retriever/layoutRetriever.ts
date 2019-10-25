import { Layout } from "../schema";
import { Org } from "@salesforce/core";
import { METADATA_INFO } from "../metadataInfo";
import _ from "lodash";
import BaseMetadataRetriever from "./baseMetadataRetriever";
import EntityDefinitionRetriever from "./entityDefinitionRetriever";
import MetadataFiles from "../metadataFiles";

const QUERY =
  "SELECT Id, Name, EntityDefinitionId, NamespacePrefix From Layout ";

export default class LayoutRetriever extends BaseMetadataRetriever<Layout> {
  private static instance: LayoutRetriever;
  private constructor(public org: Org) {
    super(org, true);
    super.setQuery(QUERY);
  }

  public static getInstance(org: Org): LayoutRetriever {
    if (!LayoutRetriever.instance) {
      LayoutRetriever.instance = new LayoutRetriever(org);
    }
    return LayoutRetriever.instance;
  }

  public async getObjects(): Promise<Layout[]> {
    if (
      (this.data === undefined || this.data.length == 0) &&
      !this.dataLoaded
    ) {
      let entityDefinitionRetriever = EntityDefinitionRetriever.getInstance(
        this.org
      );

      super.setQuery(QUERY);
      let layouts = await super.getObjects();
      for (let i = 0; i < layouts.length; i++) {
        layouts[
          i
        ].ObjectName = await entityDefinitionRetriever.getObjectNameByDurableId(
          layouts[i].EntityDefinitionId
        );

        let namespace = "";
        if (
          layouts[i].NamespacePrefix !== undefined &&
          layouts[i].NamespacePrefix !== "" &&
          layouts[i].NamespacePrefix !== null &&
          layouts[i].NamespacePrefix !== "null"
        ) {
          namespace = layouts[i].NamespacePrefix + "__";
        }
        if (layouts[i].ObjectName !== null && layouts[i].ObjectName !== "") {
          layouts[i].FullName =
            layouts[i].ObjectName +
            "-" +
            namespace +
            layouts[i].Name.replace("/", "%2F");
        } else {
          layouts[i].FullName =
            layouts[i].EntityDefinitionId +
            "-" +
            namespace +
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
    if (!found && !MetadataFiles.sourceOnly) {
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
