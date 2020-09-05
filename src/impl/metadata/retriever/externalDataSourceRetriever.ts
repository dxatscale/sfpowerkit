import { ExternalDataSource } from "../schema";
import { core } from "@salesforce/command";
import * as _ from "lodash";
import { METADATA_INFO } from "../metadataInfo";
import BaseMetadataRetriever from "./baseMetadataRetriever";
import MetadataFiles from "../metadataFiles";

const QUERY =
  "SELECT Id, DeveloperName, NamespacePrefix From ExternalDataSource";
export default class ExternalDataSourceRetriever extends BaseMetadataRetriever<
  ExternalDataSource
> {
  private static instance: ExternalDataSourceRetriever;
  private constructor(public org: core.Org) {
    super(org, false);
    super.setQuery(QUERY);
  }

  public static getInstance(org: core.Org): ExternalDataSourceRetriever {
    if (!ExternalDataSourceRetriever.instance) {
      ExternalDataSourceRetriever.instance = new ExternalDataSourceRetriever(
        org
      );
    }
    return ExternalDataSourceRetriever.instance;
  }

  public async getObjects(): Promise<ExternalDataSource[]> {
    if (
      (this.data === undefined || this.data.length == 0) &&
      !this.dataLoaded
    ) {
      super.setQuery(QUERY);
      let dataSources = await super.getObjects();
      for (let i = 0; i < dataSources.length; i++) {
        let dts = dataSources[i];
        if (!_.isNil(dts.NamespacePrefix)) {
          dts.FullName = `${dts.NamespacePrefix}__${dts.DeveloperName}`;
        } else {
          dts.FullName = dts.DeveloperName;
        }
      }
      this.data = dataSources;
      this.dataLoaded = true;
    }
    return this.data;
  }
  public async getExternalDataSources(): Promise<ExternalDataSource[]> {
    return await this.getObjects();
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
        return dts.FullName === dataSource;
      });
      found = !_.isNil(foundDts);
    }
    return found;
  }
}
