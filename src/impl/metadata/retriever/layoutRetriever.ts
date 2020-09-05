import { Layout } from "../schema";
import { core } from "@salesforce/command";
import { METADATA_INFO } from "../metadataInfo";
import * as _ from "lodash";
import BaseMetadataRetriever from "./baseMetadataRetriever";
import MetadataFiles from "../metadataFiles";

const QUERY =
  "SELECT Id, Name, EntityDefinition.QualifiedApiName, EntityDefinitionId, NamespacePrefix From Layout  ";

export default class LayoutRetriever extends BaseMetadataRetriever<Layout> {
  private static instance: LayoutRetriever;
  private constructor(public org: core.Org) {
    super(org, true);
    super.setQuery(QUERY);
  }

  public static getInstance(org: core.Org): LayoutRetriever {
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
      super.setQuery(QUERY);
      let layouts = await super.getObjects();
      for (let i = 0; i < layouts.length; i++) {
        let namespace = "";
        if (
          layouts[i].NamespacePrefix !== undefined &&
          layouts[i].NamespacePrefix !== "" &&
          layouts[i].NamespacePrefix !== null &&
          layouts[i].NamespacePrefix !== "null"
        ) {
          namespace = layouts[i].NamespacePrefix + "__";
        }
        if (
          layouts[i].EntityDefinition !== null &&
          layouts[i].EntityDefinition !== undefined
        ) {
          layouts[i].FullName =
            layouts[i].EntityDefinition.QualifiedApiName +
            "-" +
            namespace +
            layouts[i].Name.replace(/%/g, "%25")
              .replace(/\//g, "%2F")
              .replace(new RegExp(/\\/, "g"), "%5C")
              .replace(/\(/g, "%28")
              .replace(/\)/g, "%29")
              .replace(/#/g, "%23")
              .replace(/\$/g, "%24")
              .replace(/&/g, "%26")
              .replace(/~/g, "%7E")
              .replace(/\[/g, "%5B")
              .replace(/\]/g, "%5D")
              .replace(/\^/g, "%5E")
              .replace(/\{/g, "%7B")
              .replace(/\}/g, "%7D")
              .replace(/\|/g, "%7C")
              .replace(/@/g, "%40")
              .replace(/'/g, "%27");
        } else {
          layouts[i].FullName =
            layouts[i].EntityDefinitionId +
            "-" +
            namespace +
            layouts[i].Name.replace(/%/g, "%25")
              .replace(/\//g, "%2F")
              .replace(new RegExp(/\\/, "g"), "%5C")
              .replace(/\(/g, "%28")
              .replace(/\)/g, "%29")
              .replace(/#/g, "%23")
              .replace(/\$/g, "%24")
              .replace(/&/g, "%26")
              .replace(/~/g, "%7E")
              .replace(/\[/g, "%5B")
              .replace(/\]/g, "%5D")
              .replace(/\^/g, "%5E")
              .replace(/\{/g, "%7B")
              .replace(/\}/g, "%7D")
              .replace(/\|/g, "%7C")
              .replace(/@/g, "%40")
              .replace(/'/g, "%27");
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
      let foundLayout = layouts.find((l) => {
        return l.FullName === layout;
      });
      found = !_.isNil(foundLayout);
    }
    return found;
  }
}
