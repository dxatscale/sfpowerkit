import { Flow } from "../schema";
import { Org } from "@salesforce/core";
import * as _ from "lodash";
import { METADATA_INFO } from "../metadataInfo";
import BaseMetadataRetriever from "./baseMetadataRetriever";
import MetadataFiles from "../metadataFiles";
import { retrieveMetadata } from "../../../utils/retrieveMetadata";

const QUERY = "SELECT Id, MasterLabel, FullName  From Flow";
export default class FlowRetriever extends BaseMetadataRetriever<Flow> {
  private static instance: FlowRetriever;
  private constructor(public org: Org) {
    super(org, true);
    super.setQuery(QUERY);
  }

  public static getInstance(org: Org): FlowRetriever {
    if (!FlowRetriever.instance) {
      FlowRetriever.instance = new FlowRetriever(org);
    }
    return FlowRetriever.instance;
  }

  public async getObjects(): Promise<Flow[]> {
    if (
      (this.data === undefined || this.data.length == 0) &&
      !this.dataLoaded
    ) {
      let flows = await this.retrieveFlows();
      this.data = flows;
      this.dataLoaded = true;
    }
    return this.data;
  }

  async retrieveFlows(): Promise<Flow[]> {
    const apiversion = await this.org.retrieveMaxApiVersion();
    let toReturn: Promise<Flow[]> = new Promise<Flow[]>((resolve, reject) => {
      this.org
        .getConnection()
        .metadata.list([{ type: "Flow", folder: null }], apiversion, function(
          err,
          metadata
        ) {
          if (err) {
            return reject(err);
          }
          let flowsObjList: Flow[] = [];
          for (let i = 0; i < metadata.length; i++) {
            let flow: Flow = {
              FullName: metadata[i].fullName,
              NamespacePrefix: metadata[i].namespacePrefix,
              Id: ""
            };
            if (
              metadata[i].namespacePrefix !== "" &&
              metadata[i].namespacePrefix !== undefined
            ) {
              flow.FullName = `${metadata[i].namespacePrefix}__${metadata[i].fullName}`;
            }
            flowsObjList.push(flow);
          }
          resolve(flowsObjList);
        });
    });

    return toReturn;
  }

  public async getFlows(): Promise<Flow[]> {
    return await this.getObjects();
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
      let foundFlow = flows.find(flow => {
        return flow.FullName === flowStr;
      });
      found = !_.isNil(foundFlow);
    }
    return found;
  }
}
