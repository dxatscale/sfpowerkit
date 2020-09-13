export default class MarkdownGeneratorImpl {
  private static codeblock = "````";
  private static titleBlock = "\n---\n";
  private static tickMark = ":heavy_check_mark:";
  private static crossMark = ":x:";
  public static generateMdforCustomField(metadataJson: any) {
    let markdownResult = `## Name : ${metadataJson.fullName} ${this.titleBlock}`;
    if (metadataJson.label) {
      markdownResult = `${markdownResult}**Label** : ${metadataJson.label}\n`;
    }
    if (metadataJson.type) {
      markdownResult = `${markdownResult}**Type** : ${metadataJson.type}\n`;
    }
    if (metadataJson.length) {
      markdownResult = `${markdownResult}**Length** : ${metadataJson.length}\n`;
    }
    if (metadataJson.precision) {
      markdownResult = `${markdownResult}**Decimal Precision** : ${metadataJson.precision}\n`;
    }
    if (metadataJson.visibleLines) {
      markdownResult = `${markdownResult}**Visible Lines** : ${metadataJson.visibleLines}\n`;
    }
    if (metadataJson.required) {
      markdownResult = `${markdownResult}**Required** : ${this.contructTrueFalse(
        metadataJson.required
      )}\n`;
    }
    if (metadataJson.unique) {
      markdownResult = `${markdownResult}**Unique** : ${this.contructTrueFalse(
        metadataJson.unique
      )}\n`;
    }
    if (metadataJson.description) {
      markdownResult = `${markdownResult}**Description** : ${metadataJson.description}\n`;
    }
    if (metadataJson.defaultValue) {
      markdownResult = `${markdownResult}**Default Value** : ${metadataJson.defaultValue}\n`;
    }
    if (metadataJson.deprecated) {
      markdownResult = `${markdownResult}**Deprecated** : ${this.contructTrueFalse(
        metadataJson.deprecated
      )}\n`;
    }
    if (metadataJson.caseSensitive) {
      markdownResult = `${markdownResult}**Case Sensitive** : ${this.contructTrueFalse(
        metadataJson.caseSensitive
      )}\n`;
    }
    if (metadataJson.complianceGroup) {
      markdownResult = `${markdownResult}**Compliance Group** : ${metadataJson.complianceGroup}\n`;
    }
    if (metadataJson.deleteConstraint) {
      markdownResult = `${markdownResult}**Delete Constraint** : ${metadataJson.deleteConstraint}\n`;
    }
    if (metadataJson.displayFormat) {
      markdownResult = `${markdownResult}**Display Format** : ${metadataJson.displayFormat}\n`;
    }
    if (metadataJson.startingNumber) {
      markdownResult = `${markdownResult}**Starting Number** : ${metadataJson.startingNumber}\n`;
    }
    if (metadataJson.encrypted) {
      markdownResult = `${markdownResult}**Encrypted** : ${this.contructTrueFalse(
        metadataJson.encrypted
      )}\n`;
    }
    if (metadataJson.encryptionScheme) {
      markdownResult = `${markdownResult}**Encryption Scheme** : ${metadataJson.encryptionScheme}\n`;
    }
    if (metadataJson.externalDeveloperName) {
      markdownResult = `${markdownResult}**External Developer Name** : ${metadataJson.externalDeveloperName}\n`;
    }
    if (metadataJson.externalId) {
      markdownResult = `${markdownResult}**ExternalId ?** : ${this.contructTrueFalse(
        metadataJson.externalId
      )}\n`;
    }
    if (metadataJson.fieldManageability) {
      markdownResult = `${markdownResult}**FieldManageability** : ${metadataJson.fieldManageability}\n`;
    }
    if (metadataJson.formula) {
      markdownResult = `${markdownResult}**Formula** : \n${this.wrapCodeBlock(
        metadataJson.formula
      )}\n`;
    }
    if (metadataJson.formulaTreatBlankAs) {
      markdownResult = `${markdownResult}**Formula Treat Blank As** : ${metadataJson.formulaTreatBlankAs}\n`;
    }
    if (metadataJson.inlineHelpText) {
      markdownResult = `${markdownResult}**Help Text** : ${metadataJson.inlineHelpText}\n`;
    }
    if (metadataJson.isAIPredictionField) {
      markdownResult = `${markdownResult}**AI Prediction Field ?** : ${this.contructTrueFalse(
        metadataJson.isAIPredictionField
      )}\n`;
    }
    if (metadataJson.isFilteringDisabled) {
      markdownResult = `${markdownResult}**Filtering Disabled ?** : ${this.contructTrueFalse(
        metadataJson.isFilteringDisabled
      )}\n`;
    }
    if (metadataJson.isNameField) {
      markdownResult = `${markdownResult}**Name Field ?** : ${this.contructTrueFalse(
        metadataJson.isNameField
      )}\n`;
    }
    if (metadataJson.isSortingDisabled) {
      markdownResult = `${markdownResult}**Sorting Disabled ?** : ${this.contructTrueFalse(
        metadataJson.isSortingDisabled
      )}\n`;
    }
    if (metadataJson.maskChar) {
      markdownResult = `${markdownResult}**Mask Character** : ${metadataJson.maskChar}\n`;
    }
    if (metadataJson.maskType) {
      markdownResult = `${markdownResult}**Mask Type** : ${metadataJson.maskType}\n`;
    }
    if (metadataJson["metadataRelationship​ControllingField"]) {
      markdownResult = `${markdownResult}**Metadata Relationship​ Controlling Field** : ${metadataJson["metadataRelationship​ControllingField"]}\n`;
    }
    if (metadataJson.populateExistingRows) {
      markdownResult = `${markdownResult}**Populate Existing Rows** : ${this.contructTrueFalse(
        metadataJson.populateExistingRows
      )}\n`;
    }
    if (metadataJson.referenceTargetField) {
      markdownResult = `${markdownResult}**Reference Target Field** : ${metadataJson.referenceTargetField}\n`;
    }
    if (metadataJson.referenceTo) {
      markdownResult = `${markdownResult}**Reference To** : ${metadataJson.referenceTo}\n`;
    }
    if (metadataJson.relationshipLabel) {
      markdownResult = `${markdownResult}**Relationship Label** : ${metadataJson.relationshipLabel}\n`;
    }
    if (metadataJson.relationshipName) {
      markdownResult = `${markdownResult}**Relationship Name** : ${metadataJson.relationshipName}\n`;
    }
    if (metadataJson.relationshipOrder) {
      markdownResult = `${markdownResult}**Relationship Order** : ${metadataJson.relationshipOrder}\n`;
    }
    if (metadataJson.reparentableMasterDetail) {
      markdownResult = `${markdownResult}**Reparentable MasterDetail ?** : ${this.contructTrueFalse(
        metadataJson.reparentableMasterDetail
      )}\n`;
    }
    if (metadataJson.scale) {
      markdownResult = `${markdownResult}**Scale** : ${metadataJson.scale}\n`;
    }
    if (metadataJson.securityClassification) {
      markdownResult = `${markdownResult}**Security Classification** : ${metadataJson.securityClassification}\n`;
    }
    if (metadataJson.stripMarkup) {
      markdownResult = `${markdownResult}**Strip Markup** : ${this.contructTrueFalse(
        metadataJson.stripMarkup
      )}\n`;
    }
    if (metadataJson.summarizedField) {
      markdownResult = `${markdownResult}**Summarized Field** : ${metadataJson.summarizedField}\n`;
    }
    if (metadataJson.summaryForeignKey) {
      markdownResult = `${markdownResult}**Summary ForeignKey** : ${metadataJson.summaryForeignKey}\n`;
    }
    if (metadataJson.summaryOperation) {
      markdownResult = `${markdownResult}**Summary Operation** : ${metadataJson.summaryOperation}\n`;
    }
    if (metadataJson.trackFeedHistory) {
      markdownResult = `${markdownResult}**Track Feed History** : ${this.contructTrueFalse(
        metadataJson.trackFeedHistory
      )}\n`;
    }
    if (metadataJson.trackHistory) {
      markdownResult = `${markdownResult}**Track History** : ${this.contructTrueFalse(
        metadataJson.trackHistory
      )}\n`;
    }
    if (metadataJson.trackTrending) {
      markdownResult = `${markdownResult}**Track Trending** : ${this.contructTrueFalse(
        metadataJson.trackTrending
      )}\n`;
    }
    if (metadataJson.writeRequiresMasterRead) {
      markdownResult = `${markdownResult}**write Requires MasterRead** : ${this.contructTrueFalse(
        metadataJson.writeRequiresMasterRead
      )}\n`;
    }
    if (metadataJson.summaryFilterItems) {
      markdownResult = `${markdownResult}**Summary Filter Items** : \nField | Operation | Value | ValueField \n--- | --- | --- | ---\n`;
      let members = metadataJson.summaryFilterItems;
      if (members.constructor === Array) {
        members.forEach((element) => {
          markdownResult = `${markdownResult}${element.field} | ${element.operation} | ${element.value} | ${element.valueField} \n`;
        });
      } else {
        markdownResult = `${markdownResult}${members.field} | ${members.operation} | ${members.value} | ${members.valueField} \n\n`;
      }
    }
    if (metadataJson.valueSet) {
      markdownResult = `${markdownResult}**Picklist valueset** : \n`;
      markdownResult = `${markdownResult}Setting | Value \n --- | ---\n`;
      if (metadataJson.valueSet.restricted) {
        markdownResult = `${markdownResult}Restricted Picklist ? | ${this.contructTrueFalse(
          metadataJson.valueSet.restricted
        )} \n`;
      }
      if (metadataJson.valueSet.controllingField) {
        markdownResult = `${markdownResult}Controlling Field | ${metadataJson.valueSet.controllingField} \n`;
      }

      if (metadataJson.valueSet.valueSetName) {
        markdownResult = `${markdownResult}Globalvalueset | ${metadataJson.valueSet.valueSetName} \n`;
      } else if (metadataJson.valueSet.valueSetDefinition) {
        markdownResult = `${markdownResult}Sorted | ${this.contructTrueFalse(
          metadataJson.valueSet.valueSetDefinition.sorted
        )} \n\n`;

        markdownResult = `${markdownResult}Label | Api Name | default\n---|---|---\n`;
        let members = metadataJson.valueSet.valueSetDefinition.value;
        if (members.constructor === Array) {
          members.forEach((element) => {
            markdownResult = `${markdownResult}${this.wrapStringliteral(
              element.label
            )} | ${this.wrapStringliteral(
              element.fullName
            )} | ${this.contructTrueFalse(element.default)}\n`;
          });
          markdownResult = `${markdownResult}\n`;
        } else {
          markdownResult = `${markdownResult}${this.wrapStringliteral(
            members.label
          )} | ${this.wrapStringliteral(
            members.fullName
          )} | ${this.contructTrueFalse(members.default)}\n\n`;
        }
      }
      if (metadataJson.valueSet.valueSettings) {
        markdownResult = `${markdownResult}**Field Dependency** : ${metadataJson.valueSet.controllingField} \n`;
        let valueSettingsMap = this.getvalueSettingsMap(
          metadataJson.valueSet.valueSettings
        );
        markdownResult = `${markdownResult} - `;
        let controllingFieldValues: Set<string> = new Set<string>();
        for (let [key, value] of valueSettingsMap.entries()) {
          markdownResult = `${markdownResult} | ${this.wrapStringliteral(key)}`;
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
              value.includes(controllingval) ? this.tickMark : this.crossMark
            }`;
          }
          markdownResult = `${markdownResult} \n`;
        }
        markdownResult = `${markdownResult} \n`;
      }
    }
    if (metadataJson.lookupFilter) {
      markdownResult = `${markdownResult}**Lookup Filter** : \n`;
      markdownResult = `${markdownResult}Setting | Value \n --- | ---\n`;
      if (metadataJson.lookupFilter.active) {
        markdownResult = `${markdownResult}is Active ? | ${this.contructTrueFalse(
          metadataJson.lookupFilter.active
        )} \n`;
      }
      if (metadataJson.lookupFilter.booleanFilter) {
        markdownResult = `${markdownResult}Filter logic | ${this.wrapCodeBlock(
          metadataJson.lookupFilter.booleanFilter
        )}$ \n`;
      }
      if (metadataJson.lookupFilter.errorMessage) {
        markdownResult = `${markdownResult}Error Message | ${this.wrapStringliteral(
          metadataJson.lookupFilter.errorMessage
        )} \n`;
      }
      if (metadataJson.lookupFilter.infoMessage) {
        markdownResult = `${markdownResult}Info Message | ${this.wrapStringliteral(
          metadataJson.lookupFilter.infoMessage
        )} \n`;
      }
      if (metadataJson.lookupFilter.isOptional) {
        markdownResult = `${markdownResult}is Optional ? | ${this.contructTrueFalse(
          metadataJson.lookupFilter.isOptional
        )} \n`;
      }
      if (metadataJson.lookupFilter.filterItems) {
        markdownResult = `${markdownResult}Filter Items | ${this.costructFilterItem(
          metadataJson.lookupFilter.filterItems
        )} \n`;
      }
    }

    return markdownResult;
  }
  private static costructFilterItem(filterItems: any) {
    let result =
      "<table>  <thead>  <tr>  <th>Field</th>  <th>Operation</th>  <th>Value</th>  <th>valueField</th></tr>  </thead>  <tbody>";
    if (filterItems.constructor === Array) {
      for (let iter of filterItems) {
        result = `${result}<tr>  <td>${iter.field ? iter.field : ""}</td>  `;
        result = `${result}<td>${iter.operation ? iter.operation : ""}</td>  `;
        result = `${result}<td>${iter.value ? iter.value : ""}</td>  `;
        result = `${result}<td>${
          iter.valueField ? iter.valueField : ""
        }</td>  </tr>  `;
      }
    } else {
      result = `${result}<tr>  <td>${
        filterItems.field ? filterItems.field : ""
      }</td>  `;
      result = `${result}<td>${
        filterItems.operation ? filterItems.operation : ""
      }</td>  `;
      result = `${result}<td>${
        filterItems.value ? filterItems.value : ""
      }</td>  `;
      result = `${result}<td>${
        filterItems.valueField ? filterItems.valueField : ""
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

    if (valueSettings.constructor === Array) {
      for (let iter of valueSettings) {
        let ctrFieldValue = [];
        ctrFieldValue =
          iter.controllingFieldValue.constructor === Array
            ? iter.controllingFieldValue
            : ctrFieldValue.concat(iter.controllingFieldValue);
        request.set(iter.valueName, ctrFieldValue);
      }
    } else {
      let ctrFieldValue = [];
      ctrFieldValue =
        valueSettings.controllingFieldValue.constructor === Array
          ? valueSettings.controllingFieldValue
          : ctrFieldValue.concat(valueSettings.controllingFieldValue);
      request.set(valueSettings.valueName, ctrFieldValue);
    }
    return request;
  }
  private static contructTrueFalse(request: string) {
    return request === "true"
      ? ` ${request} ${this.tickMark}`
      : ` ${request} ${this.crossMark}`;
  }
  public static generateMdforRecordType(metadataJson: any) {
    let markdownResult = `## Name : ${metadataJson.fullName} ${this.titleBlock}`;
    if (metadataJson.label) {
      markdownResult = `${markdownResult}**Label** : ${metadataJson.label}\n`;
    }
    if (metadataJson.active) {
      markdownResult = `${markdownResult}**is Active ?** : ${this.contructTrueFalse(
        metadataJson.active
      )}\n`;
    }
    if (metadataJson.description) {
      markdownResult = `${markdownResult}**Description** : ${metadataJson.description}\n`;
    }
    if (metadataJson.businessProcess) {
      markdownResult = `${markdownResult}**Business Process** : ${metadataJson.businessProcess}\n`;
    }
    if (metadataJson.compactLayoutAssignment) {
      markdownResult = `${markdownResult}**Compact Layout Assignment** : ${metadataJson.compactLayoutAssignment}\n`;
    }
    if (metadataJson.picklistValues) {
      markdownResult = `${markdownResult}**Picklist Values** : \n ${this.constructPickListRTAssignment(
        metadataJson.picklistValues
      )}`;
    }
    return markdownResult;
  }
  public static constructPickListRTAssignment(picklistValues: any) {
    let result = `Picklist Field | Available Values\n--- | --- \n`;
    if (picklistValues.constructor === Array) {
      for (let picklistValue of picklistValues) {
        result = `${result}${this.wrapBold(
          picklistValue.picklist
        )} | ${this.getPickListAvailableValues(picklistValue.values)}\n`;
      }
    } else {
      result = `${result}${this.wrapBold(
        picklistValues.picklist
      )} | ${this.getPickListAvailableValues(picklistValues.values)}\n`;
    }
    return result;
  }
  public static wrapBold(request: any) {
    return `**${request}**`;
  }
  public static getPickListAvailableValues(availableValue: any) {
    let result =
      "<table>  <thead>  <tr>  <th>Value</th>  <th>Default</th>  </tr>  </thead>  <tbody>";
    if (availableValue.constructor === Array) {
      for (let iter of availableValue) {
        result = `${result}<tr>  <td>${this.wrapStringliteral(
          iter.fullName
        )}</td>  `;
        result = `${result}<td>${this.contructTrueFalse(
          iter.default
        )}</td>  </tr>  `;
      }
    } else {
      result = `${result}<tr>  <td>${this.wrapStringliteral(
        availableValue.fullName
      )}</td>  `;
      result = `${result}<td>${this.contructTrueFalse(
        availableValue.default
      )}</td>  </tr>  `;
    }
    result = `${result}</tbody>  </table>`;
    return result;
  }
  public static generateMdforBusinessProcess(metadataJson: any) {
    let markdownResult = `## Name : ${metadataJson.fullName} ${this.titleBlock}`;

    if (metadataJson.isActive) {
      markdownResult = `${markdownResult}**is Active ?** : ${this.contructTrueFalse(
        metadataJson.isActive
      )}\n`;
    }
    if (metadataJson.description) {
      markdownResult = `${markdownResult}**Description** : ${metadataJson.description}\n`;
    }
    if (metadataJson.namespacePrefix) {
      markdownResult = `${markdownResult}**NamespacePrefix** : ${metadataJson.namespacePrefix}\n`;
    }
    if (metadataJson.values) {
      markdownResult = `${markdownResult}**Values** : ${this.getPickListAvailableValues(
        metadataJson.values
      )}\n`;
    }
    return markdownResult;
  }
  public static generateMdforValidationRule(metadataJson: any) {
    let markdownResult = `## Name : ${metadataJson.fullName} ${this.titleBlock}`;

    if (metadataJson.active) {
      markdownResult = `${markdownResult}**is Active ?** : ${this.contructTrueFalse(
        metadataJson.active
      )}\n`;
    }
    if (metadataJson.description) {
      markdownResult = `${markdownResult}**Description** : ${metadataJson.description}\n`;
    }
    if (metadataJson.errorMessage) {
      markdownResult = `${markdownResult}**Error Message** : ${metadataJson.errorMessage}\n`;
    }
    if (metadataJson.errorDisplayField) {
      markdownResult = `${markdownResult}**Error Display Field** : ${metadataJson.errorDisplayField}\n`;
    }
    if (metadataJson.errorConditionFormula) {
      markdownResult = `${markdownResult}**Rule** : \n${this.wrapCodeBlock(
        metadataJson.errorConditionFormula
      )}\n`;
    }
    return markdownResult;
  }
  public static generateMdforCustomObject(metadataJson: any, name: string) {
    let markdownResult = `## Name : ${name} ${this.titleBlock}`;

    if (metadataJson.description) {
      markdownResult = `${markdownResult}**Description** : ${metadataJson.description}\n`;
    }
    if (metadataJson.label) {
      markdownResult = `${markdownResult}**Label** : ${metadataJson.label}\n`;
    }
    if (metadataJson.pluralLabel) {
      markdownResult = `${markdownResult}**Plural Label** : ${metadataJson.pluralLabel}\n`;
    }
    if (metadataJson.nameField) {
      markdownResult = `${markdownResult}**Name Field** : \n${this.contructName(
        metadataJson.nameField
      )}\n`;
    }
    if (metadataJson.eventType) {
      markdownResult = `${markdownResult}**Event Type** : ${metadataJson.eventType}\n`;
    }
    if (metadataJson.publishBehavior) {
      markdownResult = `${markdownResult}**Publish Behavior** : ${metadataJson.publishBehavior}\n`;
    }
    if (metadataJson.visibility) {
      markdownResult = `${markdownResult}**Visibility** : ${metadataJson.visibility}\n`;
    }
    if (metadataJson.sharingModel) {
      markdownResult = `${markdownResult}**Sharing Model** : ${metadataJson.sharingModel}\n`;
    }
    if (metadataJson.externalSharingModel) {
      markdownResult = `${markdownResult}**External Sharing Model** : ${metadataJson.externalSharingModel}\n`;
    }
    if (metadataJson.enableStreamingApi) {
      markdownResult = `${markdownResult}**Enable Streaming Api** : ${this.contructTrueFalse(
        metadataJson.enableStreamingApi
      )}\n`;
    }
    if (metadataJson.enableSharing) {
      markdownResult = `${markdownResult}**Enable Sharing** : ${this.contructTrueFalse(
        metadataJson.enableSharing
      )}\n`;
    }
    if (metadataJson.enableSearch) {
      markdownResult = `${markdownResult}**Enable Search** : ${this.contructTrueFalse(
        metadataJson.enableSearch
      )}\n`;
    }
    if (metadataJson.enableReports) {
      markdownResult = `${markdownResult}**Enable Reports** : ${this.contructTrueFalse(
        metadataJson.enableReports
      )}\n`;
    }
    if (metadataJson.enableLicensing) {
      markdownResult = `${markdownResult}**Enable Licensing** : ${this.contructTrueFalse(
        metadataJson.enableLicensing
      )}\n`;
    }
    if (metadataJson.enableHistory) {
      markdownResult = `${markdownResult}**Enable History** : ${this.contructTrueFalse(
        metadataJson.enableHistory
      )}\n`;
    }
    if (metadataJson.enableFeeds) {
      markdownResult = `${markdownResult}**Enable Feeds** : ${this.contructTrueFalse(
        metadataJson.enableFeeds
      )}\n`;
    }
    if (metadataJson.enableBulkApi) {
      markdownResult = `${markdownResult}**Enable Bulk Api** : ${this.contructTrueFalse(
        metadataJson.enableBulkApi
      )}\n`;
    }
    if (metadataJson.enableActivities) {
      markdownResult = `${markdownResult}**Enable Activities** : ${this.contructTrueFalse(
        metadataJson.enableActivities
      )}\n`;
    }
    if (metadataJson.deprecated) {
      markdownResult = `${markdownResult}**Deprecated** : ${this.contructTrueFalse(
        metadataJson.deprecated
      )}\n`;
    }
    if (metadataJson.allowInChatterGroups) {
      markdownResult = `${markdownResult}**Allow In Chatter Groups** : ${this.contructTrueFalse(
        metadataJson.allowInChatterGroups
      )}\n`;
    }
    if (metadataJson.enableEnhancedLookup) {
      markdownResult = `${markdownResult}**Enable Enhanced Lookup** : ${this.contructTrueFalse(
        metadataJson.enableEnhancedLookup
      )}\n`;
    }
    if (metadataJson.recordTypeTrackHistory) {
      markdownResult = `${markdownResult}**RecordType Track History** : ${this.contructTrueFalse(
        metadataJson.recordTypeTrackHistory
      )}\n`;
    }
    if (metadataJson.recordTypeTrackFeedHistory) {
      markdownResult = `${markdownResult}**RecordType Track Feed History** : ${this.contructTrueFalse(
        metadataJson.recordTypeTrackFeedHistory
      )}\n`;
    }
    if (metadataJson.compactLayoutAssignment) {
      markdownResult = `${markdownResult}**Compact Layout Assignment** : ${metadataJson.compactLayoutAssignment}\n`;
    }
    if (metadataJson.actionOverrides) {
      markdownResult = `${markdownResult}**Action Overrides** : \n ${this.contructactionOverrides(
        metadataJson.actionOverrides
      )}\n`;
    }
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
    if (actionOverrides.constructor === Array) {
      for (let iter of actionOverrides) {
        result = `${result} ${this.wrapBold(iter.actionName)} | ${
          iter.type
        } | ${iter.formFactor ? iter.formFactor : ""} |  ${
          iter.skipRecordTypeSelect
            ? this.contructTrueFalse(iter.skipRecordTypeSelect)
            : ""
        } |  ${iter.content ? iter.content : ""} | ${
          iter.comment ? iter.comment : ""
        }\n`;
      }
    } else {
      result = `${result} ${this.wrapBold(actionOverrides.actionName)} | ${
        actionOverrides.type
      } | ${actionOverrides.formFactor ? actionOverrides.formFactor : ""} |  ${
        actionOverrides.skipRecordTypeSelect
          ? this.contructTrueFalse(actionOverrides.skipRecordTypeSelect)
          : ""
      } |  ${actionOverrides.content ? actionOverrides.content : ""} | ${
        actionOverrides.comment ? actionOverrides.comment : ""
      }\n`;
    }

    return result;
  }
}
