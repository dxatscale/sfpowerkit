import * as fs from "fs-extra";
var path = require("path");

export default class MarkdownGeneratorImpl {
  private static codeblock = "````";
  private static titleBlock = "\n---\n";
  private static tickMark = ":heavy_check_mark:";
  private static crossMark = ":x:";
  private static schema;

  public static loadSchema() {
    let schemaPath = path.join(__dirname, "schema.json");
    let fileData = fs.readFileSync(`${schemaPath}`, "utf8");
    this.schema = JSON.parse(fileData);
  }
  public static generateMdforCustomField(file: any) {
    let metadataJson = file.metadataJson;
    let markdownResult = `## Name : ${metadataJson.fullName}`;
    if (file.objectName) {
      markdownResult = `${markdownResult}\n**Object : ${file.objectName}**\n`;
    }
    if (file.package) {
      markdownResult = `${markdownResult}**Package : ${file.package}**\n`;
    }
    markdownResult = `${markdownResult}${this.titleBlock}`;

    Object.keys(this.schema.customField).forEach((key) => {
      let fieldSchema = this.schema.customField[key];
      if (metadataJson[key] && fieldSchema.type === "string") {
        markdownResult = `${markdownResult}**${fieldSchema.title}** : ${metadataJson[key]}\n`;
      } else if (metadataJson[key] && fieldSchema.type === "boolean") {
        markdownResult = `${markdownResult}**${
          fieldSchema.title
        }** : ${this.contructTrueFalse(metadataJson[key])}\n`;
      } else if (metadataJson[key] && fieldSchema.type === "code block") {
        markdownResult = `${markdownResult}**${
          fieldSchema.title
        }** : \n${this.wrapCodeBlock(metadataJson[key])}\n`;
      } else if (
        metadataJson[key] &&
        fieldSchema.type === "summaryFilterItems"
      ) {
        markdownResult = `${markdownResult}${fieldSchema.title}`;
        let members = metadataJson.summaryFilterItems;
        if (members.constructor !== Array) {
          members = [members];
        }
        members.forEach((element) => {
          markdownResult = `${markdownResult}${element.field} | ${element.operation} | ${element.value} | ${element.valueField} \n`;
        });
      } else if (metadataJson[key] && fieldSchema.type === "valueSet") {
        markdownResult = `${markdownResult}${fieldSchema.title}`;
        for (let valueSetKey of Object.keys(fieldSchema.valueSet)) {
          if (
            metadataJson.valueSet[valueSetKey] &&
            fieldSchema.valueSet[valueSetKey].type === "boolean"
          ) {
            markdownResult = `${markdownResult}${
              fieldSchema.valueSet[valueSetKey].title
            } | ${this.contructTrueFalse(
              metadataJson.valueSet[valueSetKey]
            )} \n`;
          } else if (
            metadataJson.valueSet[valueSetKey] &&
            fieldSchema.valueSet[valueSetKey].type === "string"
          ) {
            markdownResult = `${markdownResult}${fieldSchema.valueSet[valueSetKey].title} | ${metadataJson.valueSet[valueSetKey]} \n`;
          } else if (
            metadataJson.valueSet[valueSetKey] &&
            fieldSchema.valueSet[valueSetKey].type === "valueSetDefinition"
          ) {
            markdownResult = `${markdownResult}Sorted | ${this.contructTrueFalse(
              metadataJson.valueSet.valueSetDefinition.sorted
            )} \n\n`;

            markdownResult = `${markdownResult}Label | Api Name | default\n---|---|---\n`;
            let members = metadataJson.valueSet.valueSetDefinition.value;
            if (members.constructor !== Array) {
              members = [members];
            }
            members.forEach((element) => {
              markdownResult = `${markdownResult}${this.wrapStringliteral(
                element.label
              )} | ${this.wrapStringliteral(
                element.fullName
              )} | ${this.contructTrueFalse(element.default)}\n`;
            });
            markdownResult = `${markdownResult}\n`;
          } else if (
            metadataJson.valueSet[valueSetKey] &&
            fieldSchema.valueSet[valueSetKey].type === "valueSettings"
          ) {
            markdownResult = `${markdownResult}**Field Dependency** : ${metadataJson.valueSet.controllingField} \n`;
            let valueSettingsMap = this.getvalueSettingsMap(
              metadataJson.valueSet.valueSettings
            );
            markdownResult = `${markdownResult} - `;
            let controllingFieldValues: Set<string> = new Set<string>();
            for (let [key, value] of valueSettingsMap.entries()) {
              markdownResult = `${markdownResult} | ${this.wrapStringliteral(
                key
              )}`;
              for (let iter of value) {
                controllingFieldValues.add(iter);
              }
            }
            markdownResult = `${markdownResult} \n --- `;
            for (let i = 0; i < valueSettingsMap.size; i++) {
              markdownResult = `${markdownResult} | ---`;
            }
            markdownResult = `${markdownResult} \n`;
            for (let controllingval of controllingFieldValues) {
              markdownResult = `${markdownResult} ${this.wrapStringliteral(
                controllingval
              )}`;
              for (let [key, value] of valueSettingsMap.entries()) {
                markdownResult = `${markdownResult} | ${
                  value.includes(controllingval)
                    ? this.tickMark
                    : this.crossMark
                }`;
              }
              markdownResult = `${markdownResult} \n`;
            }
            markdownResult = `${markdownResult} \n`;
          }
        }
      } else if (metadataJson[key] && fieldSchema.type === "lookupFilter") {
        markdownResult = `${markdownResult}${fieldSchema.title}`;
        for (let lookupFilterKey of Object.keys(fieldSchema.lookupFilter)) {
          if (
            metadataJson.lookupFilter[lookupFilterKey] &&
            fieldSchema.lookupFilter[lookupFilterKey].type === "boolean"
          ) {
            markdownResult = `${markdownResult}${
              fieldSchema.lookupFilter[lookupFilterKey].title
            } | ${this.contructTrueFalse(
              metadataJson.lookupFilter[lookupFilterKey]
            )} \n`;
          } else if (
            metadataJson.lookupFilter[lookupFilterKey] &&
            fieldSchema.lookupFilter[lookupFilterKey].type === "code block"
          ) {
            markdownResult = `${markdownResult}${
              fieldSchema.lookupFilter[lookupFilterKey].title
            } | ${this.wrapCodeBlock(
              metadataJson.lookupFilter[lookupFilterKey]
            )} \n`;
          } else if (
            metadataJson.lookupFilter[lookupFilterKey] &&
            fieldSchema.lookupFilter[lookupFilterKey].type === "stringliteral"
          ) {
            markdownResult = `${markdownResult}${
              fieldSchema.lookupFilter[lookupFilterKey].title
            } | ${this.wrapStringliteral(
              metadataJson.lookupFilter[lookupFilterKey]
            )} \n`;
          } else if (
            metadataJson.lookupFilter[lookupFilterKey] &&
            fieldSchema.lookupFilter[lookupFilterKey].type === "filterItems"
          ) {
            markdownResult = `${markdownResult}${
              fieldSchema.lookupFilter[lookupFilterKey].title
            } | ${this.costructFilterItem(
              metadataJson.lookupFilter[lookupFilterKey]
            )} \n`;
          }
        }
      }
    });

    return markdownResult;
  }
  private static costructFilterItem(filterItems: any) {
    let result =
      "<table>  <thead>  <tr>  <th>Field</th>  <th>Operation</th>  <th>Value</th>  <th>valueField</th></tr>  </thead>  <tbody>";
    if (filterItems.constructor !== Array) {
      filterItems = [filterItems];
    }
    for (let iter of filterItems) {
      result = `${result}<tr>  <td>${iter.field ? iter.field : ""}</td>  `;
      result = `${result}<td>${iter.operation ? iter.operation : ""}</td>  `;
      result = `${result}<td>${iter.value ? iter.value : ""}</td>  `;
      result = `${result}<td>${
        iter.valueField ? iter.valueField : ""
      }</td>  </tr>  `;
    }
    result = `${result}</tbody>  </table>`;
    return result;
  }
  private static wrapStringliteral(request: string) {
    return "`" + request + "`";
  }
  private static wrapCodeBlock(request: string) {
    return this.codeblock + request + this.codeblock;
  }
  private static getvalueSettingsMap(valueSettings: any) {
    let request = new Map<string, string[]>();

    if (valueSettings.constructor !== Array) {
      valueSettings = [valueSettings];
    }
    for (let iter of valueSettings) {
      let ctrFieldValue = [];
      ctrFieldValue =
        iter.controllingFieldValue.constructor === Array
          ? iter.controllingFieldValue
          : ctrFieldValue.concat(iter.controllingFieldValue);
      request.set(iter.valueName, ctrFieldValue);
    }

    return request;
  }
  private static contructTrueFalse(request: string) {
    return request === "true"
      ? ` ${request} ${this.tickMark}`
      : ` ${request} ${this.crossMark}`;
  }
  public static generateMdforRecordType(file: any) {
    let metadataJson = file.metadataJson;
    let markdownResult = `## Name : ${metadataJson.fullName}`;
    if (file.objectName) {
      markdownResult = `${markdownResult}\n**Object : ${file.objectName}**`;
    }
    if (file.package) {
      markdownResult = `${markdownResult}\n**Package : ${file.package}**`;
    }
    markdownResult = `${markdownResult}${this.titleBlock}`;

    Object.keys(this.schema.recordType).forEach((key) => {
      let recordTypeSchema = this.schema.recordType[key];
      if (metadataJson[key] && recordTypeSchema.type === "string") {
        markdownResult = `${markdownResult}**${recordTypeSchema.title}** : ${metadataJson[key]}\n`;
      } else if (metadataJson[key] && recordTypeSchema.type === "boolean") {
        markdownResult = `${markdownResult}**${
          recordTypeSchema.title
        }** : ${this.contructTrueFalse(metadataJson[key])}\n`;
      } else if (
        metadataJson[key] &&
        recordTypeSchema.type === "picklistValues"
      ) {
        markdownResult = `${markdownResult}${
          recordTypeSchema.title
        }${this.constructPickListRTAssignment(metadataJson[key])}\n`;
      }
    });

    return markdownResult;
  }
  public static constructPickListRTAssignment(picklistValues: any) {
    let result = ``;
    if (picklistValues.constructor !== Array) {
      picklistValues = [picklistValues];
    }
    for (let picklistValue of picklistValues) {
      result = `${result}${this.wrapBold(
        picklistValue.picklist
      )} | ${this.getPickListAvailableValues(picklistValue.values)}\n`;
    }

    return result;
  }
  public static wrapBold(request: any) {
    return `**${request}**`;
  }
  public static getPickListAvailableValues(availableValue: any) {
    let result =
      "<table>  <thead>  <tr>  <th>Value</th>  <th>Default</th>  </tr>  </thead>  <tbody>";
    if (availableValue.constructor !== Array) {
      availableValue = [availableValue];
    }
    for (let iter of availableValue) {
      result = `${result}<tr>  <td>${this.wrapStringliteral(
        iter.fullName
      )}</td>  `;
      result = `${result}<td>${this.contructTrueFalse(
        iter.default
      )}</td>  </tr>  `;
    }

    result = `${result}</tbody>  </table>`;
    return result;
  }
  public static generateMdforBusinessProcess(file: any) {
    let metadataJson = file.metadataJson;
    let markdownResult = `## Name : ${metadataJson.fullName}`;
    if (file.objectName) {
      markdownResult = `${markdownResult}\n**Object : ${file.objectName}**`;
    }
    if (file.package) {
      markdownResult = `${markdownResult}\n**Package : ${file.package}**`;
    }
    markdownResult = `${markdownResult}${this.titleBlock}`;

    Object.keys(this.schema.businessProcess).forEach((key) => {
      let businessProcessSchema = this.schema.businessProcess[key];
      if (metadataJson[key] && businessProcessSchema.type === "string") {
        markdownResult = `${markdownResult}**${businessProcessSchema.title}** : ${metadataJson[key]}\n`;
      } else if (
        metadataJson[key] &&
        businessProcessSchema.type === "boolean"
      ) {
        markdownResult = `${markdownResult}**${
          businessProcessSchema.title
        }** : ${this.contructTrueFalse(metadataJson[key])}\n`;
      } else if (metadataJson[key] && businessProcessSchema.type === "values") {
        markdownResult = `${markdownResult}${
          businessProcessSchema.title
        }${this.getPickListAvailableValues(metadataJson[key])}\n`;
      }
    });

    return markdownResult;
  }
  public static generateMdforValidationRule(file: any) {
    let metadataJson = file.metadataJson;
    let markdownResult = `## Name : ${metadataJson.fullName}`;
    if (file.objectName) {
      markdownResult = `${markdownResult}\n**Object : ${file.objectName}**`;
    }
    if (file.package) {
      markdownResult = `${markdownResult}\n**Package : ${file.package}**`;
    }
    markdownResult = `${markdownResult}${this.titleBlock}`;

    Object.keys(this.schema.validationRule).forEach((key) => {
      let validationRuleSchema = this.schema.validationRule[key];
      if (metadataJson[key] && validationRuleSchema.type === "string") {
        markdownResult = `${markdownResult}**${validationRuleSchema.title}** : ${metadataJson[key]}\n`;
      } else if (metadataJson[key] && validationRuleSchema.type === "boolean") {
        markdownResult = `${markdownResult}**${
          validationRuleSchema.title
        }** : ${this.contructTrueFalse(metadataJson[key])}\n`;
      } else if (
        metadataJson[key] &&
        validationRuleSchema.type === "code block"
      ) {
        markdownResult = `${markdownResult}**${
          validationRuleSchema.title
        }** : \n${this.wrapCodeBlock(metadataJson[key])}\n`;
      }
    });
    return markdownResult;
  }
  public static generateMdforCustomObject(file: any) {
    let metadataJson = file.metadataJson;
    let markdownResult = `## Name : ${file.name}`;

    if (file.package) {
      markdownResult = `${markdownResult}\n**Package : ${file.package}**\n`;
    }
    markdownResult = `${markdownResult}${this.titleBlock}`;

    Object.keys(this.schema.customObject).forEach((key) => {
      let customObjectSchema = this.schema.customObject[key];
      if (metadataJson[key] && customObjectSchema.type === "string") {
        markdownResult = `${markdownResult}**${customObjectSchema.title}** : ${metadataJson[key]}\n`;
      } else if (metadataJson[key] && customObjectSchema.type === "boolean") {
        markdownResult = `${markdownResult}**${
          customObjectSchema.title
        }** : ${this.contructTrueFalse(metadataJson[key])}\n`;
      } else if (metadataJson[key] && customObjectSchema.type === "nameField") {
        markdownResult = `${markdownResult}**${
          customObjectSchema.title
        }** : \n${this.contructName(metadataJson[key])}\n`;
      } else if (
        metadataJson[key] &&
        customObjectSchema.type === "actionOverrides"
      ) {
        markdownResult = `${markdownResult}**${
          customObjectSchema.title
        }** : \n${this.contructactionOverrides(metadataJson[key])}\n`;
      }
    });
    return markdownResult;
  }
  private static contructName(name: any) {
    let result = `Label | Type ${
      name.displayFormat ? " | Display Format \n --- |" : "\n"
    } ---| --- \n`;
    result = `${result} ${name.label} | ${name.type} ${
      name.displayFormat ? " | " + name.displayFormat + "\n" : "\n"
    }`;

    return result;
  }
  private static contructactionOverrides(actionOverrides: any) {
    let result = `Action Name | Type | FormFactor | Skip RecordType Selection | Content | Comment \n ---| --- | ---| --- | ---| ---\n`;
    if (actionOverrides.constructor !== Array) {
      actionOverrides = [actionOverrides];
    }
    for (let iter of actionOverrides) {
      result = `${result} ${this.wrapBold(iter.actionName)} | ${iter.type} | ${
        iter.formFactor ? iter.formFactor : ""
      } |  ${
        iter.skipRecordTypeSelect
          ? this.contructTrueFalse(iter.skipRecordTypeSelect)
          : ""
      } |  ${iter.content ? iter.content : ""} | ${
        iter.comment ? iter.comment : ""
      }\n`;
    }

    return result;
  }
}
