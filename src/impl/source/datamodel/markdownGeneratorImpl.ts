export default class MarkdownGeneratorImpl {
  public static generateMdforCustomField(metadataJson: any) {
    let codeblock = "\n````\n";
    let markdownResult = `## Name : ${metadataJson.fullName} \n---\n`;
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
      markdownResult = `${markdownResult}**Required** : ${metadataJson.required}\n`;
    }
    if (metadataJson.unique) {
      markdownResult = `${markdownResult}**Unique** : ${metadataJson.unique}\n`;
    }
    if (metadataJson.description) {
      markdownResult = `${markdownResult}**Description** : ${metadataJson.description}\n`;
    }
    if (metadataJson.defaultValue) {
      markdownResult = `${markdownResult}**Default Value** : ${metadataJson.defaultValue}\n`;
    }
    if (metadataJson.deprecated) {
      markdownResult = `${markdownResult}**Deprecated** : ${metadataJson.deprecated}\n`;
    }
    if (metadataJson.caseSensitive) {
      markdownResult = `${markdownResult}**Case Sensitive** : ${metadataJson.caseSensitive}\n`;
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
      markdownResult = `${markdownResult}**Encrypted** : ${metadataJson.encrypted}\n`;
    }
    if (metadataJson.encryptionScheme) {
      markdownResult = `${markdownResult}**Encryption Scheme** : ${metadataJson.encryptionScheme}\n`;
    }
    if (metadataJson.externalDeveloperName) {
      markdownResult = `${markdownResult}**External Developer Name** : ${metadataJson.externalDeveloperName}\n`;
    }
    if (metadataJson.externalId) {
      markdownResult = `${markdownResult}**ExternalId ?** : ${metadataJson.externalId}\n`;
    }
    if (metadataJson.fieldManageability) {
      markdownResult = `${markdownResult}**FieldManageability** : ${metadataJson.fieldManageability}\n`;
    }
    if (metadataJson.formula) {
      markdownResult = `${markdownResult}**Formula** : ${codeblock}${metadataJson.formula}${codeblock}`;
    }
    if (metadataJson.formulaTreatBlankAs) {
      markdownResult = `${markdownResult}**Formula Treat Blank As** : ${metadataJson.formulaTreatBlankAs}\n`;
    }
    if (metadataJson.inlineHelpText) {
      markdownResult = `${markdownResult}**Help Text** : ${metadataJson.inlineHelpText}\n`;
    }
    if (metadataJson.isAIPredictionField) {
      markdownResult = `${markdownResult}**AI Prediction Field ?** : ${metadataJson.isAIPredictionField}\n`;
    }
    if (metadataJson.isFilteringDisabled) {
      markdownResult = `${markdownResult}**Filtering Disabled ?** : ${metadataJson.isFilteringDisabled}\n`;
    }
    if (metadataJson.isNameField) {
      markdownResult = `${markdownResult}**Name Field ?** : ${metadataJson.isNameField}\n`;
    }
    if (metadataJson.isSortingDisabled) {
      markdownResult = `${markdownResult}**Sorting Disabled ?** : ${metadataJson.isSortingDisabled}\n`;
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
      markdownResult = `${markdownResult}**Populate Existing Rows** : ${metadataJson.populateExistingRows}\n`;
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
      markdownResult = `${markdownResult}**Reparentable MasterDetail ?** : ${metadataJson.reparentableMasterDetail}\n`;
    }
    if (metadataJson.scale) {
      markdownResult = `${markdownResult}**Scale** : ${metadataJson.scale}\n`;
    }
    if (metadataJson.securityClassification) {
      markdownResult = `${markdownResult}**Security Classification** : ${metadataJson.securityClassification}\n`;
    }
    if (metadataJson.stripMarkup) {
      markdownResult = `${markdownResult}**Strip Markup** : ${metadataJson.stripMarkup}\n`;
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
      markdownResult = `${markdownResult}**Track Feed History** : ${metadataJson.trackFeedHistory}\n`;
    }
    if (metadataJson.trackHistory) {
      markdownResult = `${markdownResult}**Track History** : ${metadataJson.trackHistory}\n`;
    }
    if (metadataJson.trackTrending) {
      markdownResult = `${markdownResult}**Track Trending** : ${metadataJson.trackTrending}\n`;
    }
    if (metadataJson.writeRequiresMasterRead) {
      markdownResult = `${markdownResult}**write Requires MasterRead** : ${metadataJson.writeRequiresMasterRead}\n`;
    }
    if (metadataJson.summaryFilterItems) {
      markdownResult = `${markdownResult}**Summary Filter Items** : \nField | Operation | Value | ValueField \n--- | --- | --- | ---\n`;
      let members = metadataJson.summaryFilterItems;
      if (members.constructor === Array) {
        members.forEach(element => {
          markdownResult = `${markdownResult}${element.field} | ${element.operation} | ${element.value} | ${element.valueField} \n`;
        });
      } else {
        markdownResult = `${markdownResult}${members.field} | ${members.operation} | ${members.value} | ${members.valueField} \n\n`;
      }
    }
    if (metadataJson.valueSet) {
      markdownResult = `${markdownResult}**Picklist valueset** : \n`;
      markdownResult = `${markdownResult}Setting | Value \n --- | ---\n`;
      markdownResult = `${markdownResult}Restricted Picklist ? | ${metadataJson.valueSet.restricted} \n`;
      if (metadataJson.valueSet.valueSetName) {
        markdownResult = `${markdownResult}Globalvalueset | ${metadataJson.valueSet.valueSetName} \n`;
      }

      if (metadataJson.valueSet.controllingField) {
        markdownResult = `${markdownResult}Controlling Field | ${metadataJson.valueSet.controllingField} \n`;
      } else if (metadataJson.valueSet.valueSetDefinition) {
        markdownResult = `${markdownResult}Sorted | ${metadataJson.valueSet.valueSetDefinition.sorted} \n\n`;

        markdownResult = `${markdownResult}Label | Api Name | default\n---|---|---\n`;
        let members = metadataJson.valueSet.valueSetDefinition.value;
        if (members.constructor === Array) {
          members.forEach(element => {
            markdownResult = `${markdownResult}${element.label} | ${element.fullName} | ${element.default}\n`;
          });
          markdownResult = `${markdownResult}\n`;
        } else {
          markdownResult = `${markdownResult}${members.label} | ${members.fullName} | ${members.default}\n\n`;
        }
      }
      if (metadataJson.valueSet.valueSettings) {
        //TBC
        if (metadataJson.valueSet.constructor === Array) {
          //markdownResult =`${markdownResult}Controlling Field | ${metadataJson.valueSet.controllingField} \n`
        } else {
        }
      }
    }
    if (metadataJson.lookupFilter) {
      markdownResult = `${markdownResult}**Lookup Filter** : \n`;
      //TBC
    }

    return markdownResult;
  }
  public static generateMdforBusinessProcess(metadataJson: any) {
    let codeblock = "\n````\n";
    let markdownResult = `## Name : ${metadataJson.fullName} \n---\n`;

    markdownResult = `${markdownResult}# Under construction :construction: :construction_worker:`;
    return markdownResult;
  }
  public static generateMdforRecordType(metadataJson: any) {
    let codeblock = "\n````\n";
    let markdownResult = `## Name : ${metadataJson.fullName} \n---\n`;

    markdownResult = `${markdownResult}# Under construction :construction: :construction_worker:`;
    return markdownResult;
  }
  public static generateMdforValidationRule(metadataJson: any) {
    let codeblock = "\n````\n";
    let markdownResult = `## Name : ${metadataJson.fullName} \n---\n`;

    markdownResult = `${markdownResult}# Under construction :construction: :construction_worker:`;
    return markdownResult;
  }
  public static generateMdforCustomObject(metadataJson: any, name: string) {
    let codeblock = "\n````\n";
    let markdownResult = `## Name : ${name} \n---\n`;

    markdownResult = `${markdownResult}# Under construction :construction: :construction_worker:`;
    return markdownResult;
  }
}
