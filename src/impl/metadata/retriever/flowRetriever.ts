import { FileProperties } from "../schema";
import { Org } from "@salesforce/core";
import * as _ from "lodash";
import { METADATA_INFO } from "../metadataInfo";
import MetadataFiles from "../metadataFiles";
import { SFPowerkit } from "./../../../sfpowerkit";

export default class FlowRetriever {
  private static instance: FlowRetriever;
  private static data: FileProperties[];
  private constructor(public org: Org) {
    this.org = org;
  }

  public static getInstance(org: Org): FlowRetriever {
    if (!FlowRetriever.instance) {
      FlowRetriever.instance = new FlowRetriever(org);
    }
    return FlowRetriever.instance;
  }

  public async getFlows(): Promise<FileProperties[]> {
    if (FlowRetriever.data === undefined || FlowRetriever.data.length == 0) {
      const apiversion: string = await SFPowerkit.getApiVersion();
      let items = await this.org.getConnection().metadata.list(
        {
          type: METADATA_INFO.Flow.xmlName,
        },
        apiversion
      );
      if (items === undefined || items === null) {
        items = [];
      }
      FlowRetriever.data = items;
    }
    return FlowRetriever.data;
  }

  public async flowExists(flowStr: string): Promise<boolean> {
    let found = false;
    //Look first in project files
    if (!_.isNil(METADATA_INFO.Flow.components)) {
      found = METADATA_INFO.Flow.components.includes(flowStr);
    }
    if (!found && !MetadataFiles.sourceOnly) {
      //not found, check on the org
      let flows = await this.getFlows();
      let foundFlow = flows.find((flow) => {
        return flow.fullName === flowStr;
      });
      found = !_.isNil(foundFlow);
    }
    return found;
  }
}
