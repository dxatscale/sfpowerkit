import { ApexClass } from "../schema";
import { Org } from "@salesforce/core";
import * as _ from "lodash";
import { METADATA_INFO } from "../metadataInfo";
import BaseMetadataRetriever from "./baseMetadataRetriever";
import MetadataFiles from "../metadataFiles";

const QUERY = "Select Id, Name, NameSpacePrefix From ApexClass ";
export default class ApexClassRetriever extends BaseMetadataRetriever<
  ApexClass
> {
  private static instance: ApexClassRetriever;
  private constructor(public org: Org) {
    super(org, true);
    super.setQuery(QUERY);
  }

  public static getInstance(org: Org): ApexClassRetriever {
    if (!ApexClassRetriever.instance) {
      ApexClassRetriever.instance = new ApexClassRetriever(org);
    }
    return ApexClassRetriever.instance;
  }

  public async getObjects(): Promise<ApexClass[]> {
    if (
      (this.data === undefined || this.data.length == 0) &&
      !this.dataLoaded
    ) {
      super.setQuery(QUERY);
      let classes = await super.getObjects();
      for (let i = 0; i < classes.length; i++) {
        let cls = classes[i];
        if (!_.isNil(cls.NamespacePrefix)) {
          cls.FullName = `${cls.NamespacePrefix}__${cls.Name}`;
        } else {
          cls.FullName = cls.Name;
        }
      }
      this.data = classes;
      this.dataLoaded = true;
    }
    return this.data;
  }
  public async getClasses(): Promise<ApexClass[]> {
    return await this.getObjects();
  }

  public async classExists(cls: string): Promise<boolean> {
    let found = false;
    //Look first in project files
    if (!_.isNil(METADATA_INFO.ApexClass.components)) {
      found = METADATA_INFO.ApexClass.components.includes(cls);
    }
    if (!found && !MetadataFiles.sourceOnly) {
      //not found, check on the org
      let classes = await this.getClasses();
      let foundCls = classes.find(aCls => {
        return aCls.FullName === cls;
      });
      found = !_.isNil(foundCls);
    }
    return found;
  }
}
