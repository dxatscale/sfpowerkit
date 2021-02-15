import { FileProperties } from "../schema";
import { Org } from "@salesforce/core";
import { METADATA_INFO } from "../metadataInfo";
import * as _ from "lodash";
import { SFPowerkit } from "./../../../sfpowerkit";
import MetadataFiles from "../metadataFiles";

export default class LayoutRetriever {
  private static instance: LayoutRetriever;
  private static data: FileProperties[];
  private constructor(public org: Org) {
    this.org = org;
  }

  public static getInstance(org: Org): LayoutRetriever {
    if (!LayoutRetriever.instance) {
      LayoutRetriever.instance = new LayoutRetriever(org);
    }
    return LayoutRetriever.instance;
  }

  public async getLayouts(): Promise<FileProperties[]> {
    if (
      LayoutRetriever.data === undefined ||
      LayoutRetriever.data.length == 0
    ) {
      let apiversion: string = await SFPowerkit.getApiVersion();
      let layouts = await this.org.getConnection().metadata.list(
        {
          type: METADATA_INFO.Layout.xmlName,
        },
        apiversion
      );
      if (layouts != undefined && layouts.length > 0) {
        for (let i = 0; i < layouts.length; i++) {
          if (
            layouts[i].namespacePrefix !== undefined &&
            layouts[i].namespacePrefix !== "" &&
            layouts[i].namespacePrefix !== null &&
            layouts[i].namespacePrefix !== "null"
          ) {
            //apend namespacePrefix in layout
            layouts[i].fullName = layouts[i].fullName.replace(
              "-",
              `-${layouts[i].namespacePrefix}__`
            );
          }
          //Describe result is already encoded
          /*layouts[i].fullName = layouts[i].fullName.replace(/%/g, "%25")
          layouts[i].fullName = layouts[i].fullName.replace(/\//g, "%2F")
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
              .replace(/'/g, "%27");*/
        }
      } else {
        layouts = [];
      }
      LayoutRetriever.data = layouts;
    }
    return LayoutRetriever.data;
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
        return l.fullName === layout;
      });
      found = !_.isNil(foundLayout);
    }
    return found;
  }
}
