import { CustomPermission } from "../schema";
import { Org } from "@salesforce/core";
import * as _ from "lodash";
import { METADATA_INFO } from "../metadataInfo";
import BaseMetadataRetriever from "./baseMetadataRetriever";
import MetadataFiles from "../metadataFiles";

const QUERY = "SELECT Id, DeveloperName, NamespacePrefix From CustomPermission";
export default class CustomPermissionRetriever extends BaseMetadataRetriever<
  CustomPermission
> {
  private static instance: CustomPermissionRetriever;
  private constructor(public org: Org) {
    super(org, false);
    super.setQuery(QUERY);
  }

  public static getInstance(org: Org): CustomPermissionRetriever {
    if (!CustomPermissionRetriever.instance) {
      CustomPermissionRetriever.instance = new CustomPermissionRetriever(org);
    }
    return CustomPermissionRetriever.instance;
  }

  public async getObjects(): Promise<CustomPermission[]> {
    if (
      (this.data === undefined || this.data.length == 0) &&
      !this.dataLoaded
    ) {
      super.setQuery(QUERY);
      let customPermissions = await super.getObjects();
      if (customPermissions != undefined && customPermissions.length > 0) {
        for (let i = 0; i < customPermissions.length; i++) {
          let cp = customPermissions[i];
          if (!_.isNil(cp.NamespacePrefix)) {
            cp.FullName = `${cp.NamespacePrefix}__${cp.DeveloperName}`;
          } else {
            cp.FullName = cp.DeveloperName;
          }
        }
      }

      this.data = customPermissions;
      this.dataLoaded = true;
    }
    return this.data;
  }

  public async getCustomPermissions(): Promise<CustomPermission[]> {
    return await this.getObjects();
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
        return customPermission.FullName === customPermissionStr;
      });
      found = !_.isNil(foundCp);
    }
    return found;
  }
}
