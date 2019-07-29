import BaseUtils from "./baseUtils";
import { Field } from "./schema";
import { Org } from "@salesforce/core";
import EntityDefinitionUtils from "./entityDefinitionUtils";
import { METADATA_INFO } from "./metadataInfo";
import _ from "lodash";

const QUERY =
  "SELECT Id, QualifiedApiName, EntityDefinitionId, DeveloperName, NamespacePrefix FROM FieldDefinition ";
export default class FieldUtils extends BaseUtils<Field> {
  private static instance: FieldUtils;
  private constructor(public org: Org) {
    super(org, true);
    super.setQuery(QUERY);
  }
  public static getInstance(org: Org): FieldUtils {
    if (!FieldUtils.instance) {
      FieldUtils.instance = new FieldUtils(org);
    }
    return FieldUtils.instance;
  }
  public async getObjects(): Promise<Field[]> {
    let fieldsToReturn: Field[] = [];
    if (!this.data && !this.dataLoaded) {
      let entityDefinitionUtils = EntityDefinitionUtils.getInstance(
        this.org
      );

      let objects = await entityDefinitionUtils.getObjectForPermission();
      this.data = {};

      for (let i = 0; i < objects.length; i++) {
        let objectName = objects[i];

        let durableId = await entityDefinitionUtils.getDurableIdByObjectName(
          objectName
        );
        super.setQuery(
          QUERY + " WHERE EntityDefinitionId ='" + durableId + "'"
        );
        let fields = await super.getObjects();
        fields = fields.map(field => {
          field.SobjectType = objectName;
          field.FullName = objectName + "." + field.QualifiedApiName;
          return field;
        });
        this.data[objectName] = fields;
        fieldsToReturn.push(...fields);
      }
      this.dataLoaded = true;
    } else {
      if (this.data) {
        Object.keys(this.data).forEach(key => {
          fieldsToReturn.push(...this.data[key]);
        });
      }
    }
    return fieldsToReturn;
  }
  public async getFields(): Promise<Field[]> {
    return await this.getObjects();
  }
  public async getFieldsByObjectName(objectName: string): Promise<Field[]> {
    if (!this.data) {
      await this.getObjects();
    }
    if (!this.data[objectName]) {
      let entityDefinitionUtils = EntityDefinitionUtils.getInstance(
        this.org
      );
      let fields = [];
      let durableId = await entityDefinitionUtils.getDurableIdByObjectName(
        objectName
      );

      if (durableId !== undefined && durableId !== "") {
        super.setQuery(
          QUERY + " WHERE EntityDefinitionId ='" + durableId + "'"
        );
        fields = await super.getObjects();
        fields = fields.map(field => {
          field.SobjectType = objectName;
          field.FullName = objectName + "." + field.QualifiedApiName;
          return field;
        });
      }
      this.data[objectName] = fields;
    }
    return this.data[objectName];
  }

  public async fieldExist(fullName: string): Promise<boolean> {
    let found = false;
    let fieldParts = fullName.split(".");
    if (fieldParts.length !== 2) {
      return false;
    }
    //Look first in project files
    if (!_.isNil(METADATA_INFO.CustomField.components)) {
      found = METADATA_INFO.CustomField.components.includes(fullName);
    }
    if (!found) {
      //not found, check on the org
      let objectName = fieldParts[0];
      let fieldDefinitions = await this.getFieldsByObjectName(objectName);
      let field = fieldDefinitions.find(field => field.FullName === fullName);
      found = field !== undefined;
    }
    return found;
  }
}
