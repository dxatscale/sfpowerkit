import BaseUtils from "./baseUtils";
import { ApexClass } from "./schema";
import { Org } from "@salesforce/core";
import _ from "lodash";
import { METADATA_INFO } from "../shared/metadataInfo";

const QUERY = "Select Id, Name, NameSpacePrefix From ApexClass ";
export default class ClassUtils extends BaseUtils<ApexClass> {
  private static instance: ClassUtils;
  private constructor(public org: Org) {
    super(org, true);
    super.setQuery(QUERY);
  }

  public static getInstance(org: Org): ClassUtils {
    if (!ClassUtils.instance) {
      ClassUtils.instance = new ClassUtils(org);
    }
    return ClassUtils.instance;
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
    if (!found) {
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
