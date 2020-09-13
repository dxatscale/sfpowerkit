import { Org } from "@salesforce/core";
import * as _ from "lodash";
import BaseMetadataRetriever from "./baseMetadataRetriever";
import { EntityDefinition } from "../schema";
import { METADATA_INFO } from "../metadataInfo";
import MetadataFiles from "../metadataFiles";
import { SFPowerkit } from "../../../sfpowerkit";
import { LoggerLevel } from "../../../sfpowerkit";

const QUERY =
  "SELECT DurableId, DeveloperName, QualifiedApiName, NamespacePrefix FROM EntityDefinition order by QualifiedApiName";

export default class EntityDefinitionRetriever extends BaseMetadataRetriever<
  EntityDefinition
> {
  private static instance: EntityDefinitionRetriever;
  private objectForPermission: string[];
  private describePromise = null;
  private constructor(public org: Org) {
    super(org, false);
    super.setQuery(QUERY);
  }

  public static getInstance(org: Org): EntityDefinitionRetriever {
    if (!EntityDefinitionRetriever.instance) {
      EntityDefinitionRetriever.instance = new EntityDefinitionRetriever(org);
    }
    return EntityDefinitionRetriever.instance;
  }

  public async getObjects(): Promise<EntityDefinition[]> {
    if (this.describePromise !== null) {
      return this.describePromise;
    }
    this.describePromise = new Promise<any[]>((resolve, reject) => {
      this.org.getConnection().describeGlobal(function(err, res) {
        if (err) {
          SFPowerkit.log(
            `Error when running gllobal describe `,
            LoggerLevel.ERROR
          );
          SFPowerkit.log(err, LoggerLevel.ERROR);
          reject(err);
        } else {
          SFPowerkit.log(
            `Org describe completed successfully. ${res.sobjects.length} object found! `,
            LoggerLevel.INFO
          );
          let entities = res.sobjects.map(sObject => {
            return {
              QualifiedApiName: sObject.name
            };
          });
          resolve(entities);
        }
      });
    });
    return this.describePromise;
  }
  public async getEntityDefinitions(): Promise<EntityDefinition[]> {
    return await this.getObjects();
  }

  public async getObjectForPermission(): Promise<string[]> {
    if (this.objectForPermission && this.objectForPermission.length > 0) {
      return this.objectForPermission;
    }
    this.objectForPermission = [];
    await this.org.refreshAuth();
    let res = await this.org
      .getConnection()
      .query<any>(
        "SELECT SobjectType, count(Id) From ObjectPermissions Group By sObjectType"
      );

    if (res !== undefined) {
      this.objectForPermission = res.records.map(elem => {
        return elem["SobjectType"];
      });
    }
    if (!this.objectForPermission.includes("PersonAccount")) {
      this.objectForPermission.push("PersonAccount");
    }
    return this.objectForPermission;
  }

  public async existObjectPermission(object: string): Promise<boolean> {
    let found = false;
    //Look first in project files
    if (!_.isNil(METADATA_INFO.CustomObject.components)) {
      found = METADATA_INFO.CustomObject.components.includes(object);
    }
    if (!found && !MetadataFiles.sourceOnly) {
      //not found, check on the org
      let objects = await this.getObjectForPermission();
      found = objects.includes(object);
    }
    return found;
  }
  public async existCustomMetadata(custonObjectStr: string): Promise<boolean> {
    let found = false;
    //Look first in project files
    if (!_.isNil(METADATA_INFO.CustomObject.components)) {
      found = METADATA_INFO.CustomObject.components.includes(custonObjectStr);
    }
    if (!found && !MetadataFiles.sourceOnly) {
      //not found, check on the org
      let objects = await this.getObjects();
      let foundObj = objects.find(obj => {
        return obj.QualifiedApiName === custonObjectStr;
      });
      found = foundObj !== undefined;
    }
    return found;
  }
}
