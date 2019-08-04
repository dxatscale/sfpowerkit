import { Org } from "@salesforce/core";
import _ from "lodash";
import BaseMetadataRetriever from "./baseMetadataretriever";
import { EntityDefinition } from "../schema";
import { METADATA_INFO } from "../../../shared/metadataInfo";

const QUERY =
  "SELECT DurableId, DeveloperName, QualifiedApiName, NamespacePrefix FROM EntityDefinition order by QualifiedApiName";
export default class EntityDefinitionRetriever extends BaseMetadataRetriever<
  EntityDefinition
> {
  private static instance: EntityDefinitionRetriever;
  private objectForPermission: string[];
  private constructor(public org: Org) {
    super(org, true);
    super.setQuery(QUERY);
  }

  public static getInstance(org: Org): EntityDefinitionRetriever {
    if (!EntityDefinitionRetriever.instance) {
      EntityDefinitionRetriever.instance = new EntityDefinitionRetriever(org);
    }
    return EntityDefinitionRetriever.instance;
  }

  public async getObjects(): Promise<EntityDefinition[]> {
    if (
      (this.data === undefined || this.data.length == 0) &&
      !this.dataLoaded
    ) {
      super.setQuery(QUERY);
      let entities = await super.getObjects();
      this.data = entities;
      this.dataLoaded = true;
    }
    return this.data;
  }
  public async getEntityDefinitions(): Promise<EntityDefinition[]> {
    return await this.getObjects();
  }

  public async getObjectNameByDurableId(durableId: string): Promise<string> {
    let objectName = "";
    let entities = await this.getEntityDefinitions();
    for (var i = 0; i < entities.length; i++) {
      let entity = entities[i];
      if (entity.DurableId === durableId) {
        objectName = entity.QualifiedApiName;
        break;
      }
    }
    return objectName;
  }
  public async getDurableIdByObjectName(objectName: string): Promise<string> {
    let durableId = "";
    let found = false;
    let entities = await this.getEntityDefinitions();
    for (var i = 0; i < entities.length; i++) {
      let entity = entities[i];
      if (entity.QualifiedApiName === objectName) {
        durableId = entity.DurableId;
        found = true;
        break;
      }
    }
    if (!found) {
      //fetch the objectName from server and add it to the entity list
      let entity = {
        Id: "",
        QualifiedApiName: objectName
      };
      this.data.push(entity);
    }
    return durableId;
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
    if (!found) {
      //not found, check on the org
      let objects = await this.getObjectForPermission();
      found = objects.includes(object);
    }
    return found;
  }
}
