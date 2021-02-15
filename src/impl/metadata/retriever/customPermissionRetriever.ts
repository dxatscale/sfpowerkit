import { FileProperties } from "../schema";
import { Org } from "@salesforce/core";
import * as _ from "lodash";
import { METADATA_INFO } from "../metadataInfo";
import MetadataFiles from "../metadataFiles";
import { SFPowerkit } from "./../../../sfpowerkit";

const QUERY = "SELECT Id, DeveloperName, NamespacePrefix From CustomPermission";
export default class CustomPermissionRetriever {
  private static instance: CustomPermissionRetriever;
  private static data: FileProperties[];
  private constructor(public org: Org) {
    this.org = org;
  }

  public static getInstance(org: Org): CustomPermissionRetriever {
    if (!CustomPermissionRetriever.instance) {
      CustomPermissionRetriever.instance = new CustomPermissionRetriever(org);
    }
    return CustomPermissionRetriever.instance;
  }

  public async getCustomPermissions(): Promise<FileProperties[]> {
    if (
      CustomPermissionRetriever.data === undefined ||
      CustomPermissionRetriever.data.length == 0
    ) {
      const apiversion: string = await SFPowerkit.getApiVersion();
      let items = await this.org.getConnection().metadata.list(
        {
          type: METADATA_INFO.CustomPermission.xmlName,
        },
        apiversion
      );
      if (items === undefined || items === null) {
        items = [];
      }
      CustomPermissionRetriever.data = items;
    }
    return CustomPermissionRetriever.data;
  }

  public async customPermissionExists(
    customPermissionStr: string
  ): Promise<boolean> {
    let found = false;
    //Look first in project files
    if (!_.isNil(METADATA_INFO.CustomPermission.components)) {
      found = METADATA_INFO.CustomPermission.components.includes(
        customPermissionStr
      );
    }
    if (!found && !MetadataFiles.sourceOnly) {
      //not found, check on the org
      let custumPermissions = await this.getCustomPermissions();
      let foundCp = custumPermissions.find((customPermission) => {
        return customPermission.fullName === customPermissionStr;
      });
      found = !_.isNil(foundCp);
    }
    return found;
  }
}
