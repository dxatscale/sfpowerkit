import { Org } from "@salesforce/core";
import * as _ from "lodash";
import BaseMetadataRetriever from "./baseMetadataRetriever";
import { Field } from "../schema";
import EntityDefinitionRetriever from "./entityDefinitionRetriever";
import { METADATA_INFO } from "../metadataInfo";
import MetadataFiles from "../metadataFiles";
import { SFPowerkit, LoggerLevel } from "./../../../sfpowerkit";

const QUERY =
  "SELECT Id, QualifiedApiName, EntityDefinitionId, DeveloperName, NamespacePrefix FROM FieldDefinition";
export default class FieldRetriever extends BaseMetadataRetriever<Field> {
  private static instance: FieldRetriever;
  private static fieldData: any = {};
  private constructor(public org: Org) {
    super(org, true);
    super.setQuery(QUERY);
  }
  public static getInstance(org: Org): FieldRetriever {
    if (!FieldRetriever.instance) {
      FieldRetriever.instance = new FieldRetriever(org);
    }
    return FieldRetriever.instance;
  }
  public async getObjects(): Promise<Field[]> {
    let fieldsToReturn: Field[] = [];

    if (!this.data && !this.dataLoaded) {
      let entityDefinitionUtils = EntityDefinitionRetriever.getInstance(
        this.org
      );

      let objects = await entityDefinitionUtils.getObjectForPermission();
      this.data = {};

      for (let i = 0; i < objects.length; i++) {
        let objectName = objects[i];
        super.setQuery(
          QUERY +
            " WHERE EntityDefinition.QualifiedApiName ='" +
            objectName +
            "'"
        );
        let fields = await super.getObjects();
        fields = fields.map((field) => {
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
        Object.keys(this.data).forEach((key) => {
          fieldsToReturn.push(...this.data[key]);
        });
      }
    }
    return fieldsToReturn;
  }
  public async getFields(): Promise<Field[]> {
    return await this.getObjects();
  }
  public async getFieldsByObjectName(objectName: string): Promise<string[]> {
    if (!FieldRetriever.fieldData[objectName]) {
      let fields = [];
      await this.org
        .getConnection()
        .describe(objectName)
        .then((meta) => {
          if (meta.fields && meta.fields.length > 0) {
            fields = meta.fields.map((field) => {
              return field.name;
            });
          }
        })
        .catch((err) => {
          SFPowerkit.log(
            `Error when running gllobal describe `,
            LoggerLevel.ERROR
          );
          SFPowerkit.log(err, LoggerLevel.ERROR);
        });
      FieldRetriever.fieldData[objectName] = fields;
    }
    return FieldRetriever.fieldData[objectName];
  }

  public async fieldExist(fullName: string): Promise<boolean> {
    let found = false;
    let fieldParts = fullName.split(".");
    if (fieldParts.length !== 2) {
      return false;
    }
    let objectName = fieldParts[0];
    let fieldName = fieldParts[1];
    //Look first in project files
    if (!_.isNil(METADATA_INFO.CustomField.components)) {
      found = METADATA_INFO.CustomField.components.includes(fullName);
      if (!found) {
        if (objectName === "Task" || objectName === "Event") {
          let activityFieldName = `Activity.${fieldName}`;
          found = METADATA_INFO.CustomField.components.includes(
            activityFieldName
          );
        }
      }
    }
    if (!found && !MetadataFiles.sourceOnly) {
      //not found, check on the org
      let fieldDefinitions = await this.getFieldsByObjectName(objectName);
      found = fieldDefinitions.includes(fieldName);
    }
    return found;
  }
}
