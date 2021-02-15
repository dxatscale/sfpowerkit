import { FileProperties } from "../schema";
import { Org, LoggerLevel } from "@salesforce/core";
import { METADATA_INFO } from "../metadataInfo";
import * as _ from "lodash";
import BaseMetadataRetriever from "./baseMetadataRetriever";
import MetadataFiles from "../metadataFiles";
import { SFPowerkit } from "./../../../sfpowerkit";

export default class RecordTypeRetriever {
  private static instance: RecordTypeRetriever;
  private static data: FileProperties[];
  private constructor(public org: Org) {
    this.org = org;
  }

  public static getInstance(org: Org): RecordTypeRetriever {
    if (!RecordTypeRetriever.instance) {
      RecordTypeRetriever.instance = new RecordTypeRetriever(org);
    }
    return RecordTypeRetriever.instance;
  }

  public async getrecordTypes(): Promise<FileProperties[]> {
    if (
      RecordTypeRetriever.data === undefined ||
      RecordTypeRetriever.data.length == 0
    ) {
      const apiversion: string = await SFPowerkit.getApiVersion();
      let items = await this.org.getConnection().metadata.list(
        {
          type: METADATA_INFO.RecordType.xmlName,
        },
        apiversion
      );
      if (items === undefined || items === null) {
        items = [];
      }
      RecordTypeRetriever.data = items;
    }

    return RecordTypeRetriever.data;
  }

  public async recordTypeExists(recordType: string): Promise<boolean> {
    let found = false;
    //Look first in project files
    if (!_.isNil(METADATA_INFO.RecordType.components)) {
      found = METADATA_INFO.RecordType.components.includes(recordType);
    }
    if (!found && !MetadataFiles.sourceOnly) {
      //not found, check on the org
      let recordTypes = await this.getrecordTypes();
      let foundRecordType = recordTypes.find((rt) => {
        return rt.fullName === recordType;
      });
      found = !_.isNil(foundRecordType);
    }
    return found;
  }
}
