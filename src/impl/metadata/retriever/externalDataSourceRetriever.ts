import { FileProperties } from "../schema";
import { Org } from "@salesforce/core";
import * as _ from "lodash";
import { METADATA_INFO } from "../metadataInfo";
import MetadataFiles from "../metadataFiles";
import { SFPowerkit } from "./../../../sfpowerkit";
export default class ExternalDataSourceRetriever {
  private static instance: ExternalDataSourceRetriever;
  private static data: FileProperties[];
  private constructor(public org: Org) {
    this.org = org;
  }

  public static getInstance(org: Org): ExternalDataSourceRetriever {
    if (!ExternalDataSourceRetriever.instance) {
      ExternalDataSourceRetriever.instance = new ExternalDataSourceRetriever(
        org
      );
    }
    return ExternalDataSourceRetriever.instance;
  }

  public async getExternalDataSources(): Promise<FileProperties[]> {
    if (
      ExternalDataSourceRetriever.data === undefined ||
      ExternalDataSourceRetriever.data.length == 0
    ) {
      const apiversion: string = await SFPowerkit.getApiVersion();
      let items = await this.org.getConnection().metadata.list(
        {
          type: METADATA_INFO.ExternalDataSource.xmlName,
        },
        apiversion
      );
      if (items === undefined || items === null) {
        items = [];
      }
      ExternalDataSourceRetriever.data = items;
    }
    return ExternalDataSourceRetriever.data;
  }

  public async externalDataSourceExists(dataSource: string): Promise<boolean> {
    let found = false;
    //Look first in project files
    if (!_.isNil(METADATA_INFO.ExternalDataSource.components)) {
      found = METADATA_INFO.ExternalDataSource.components.includes(dataSource);
    }
    if (!found && !MetadataFiles.sourceOnly) {
      //not found, check on the org
      let dataSources = await this.getExternalDataSources();
      let foundDts = dataSources.find((dts) => {
        return dts.fullName === dataSource;
      });
      found = !_.isNil(foundDts);
    }
    return found;
  }
}
