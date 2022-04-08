import * as fs from 'fs-extra';
import * as xml2js from 'xml2js';
const _ = require('lodash');
import * as util from 'util';
import DiffUtil from './diffUtil';

const parser = new xml2js.Parser({
    explicitArray: false,
    valueProcessors: [
        function (name) {
            if (name === 'true') name = true;
            if (name === 'false') name = false;
            return name;
        },
    ],
});

export default class SharingRuleDiff {
    public static async generateSharingRulesXml(
        sharingRuleXml1: string,
        sharingRuleXml2: string,
        outputFilePath: string,
        objectName: string,
        destructivePackageObj: any[],
        resultOutput: any[],
        isDestructive: boolean
    ) {
        const parseString = util.promisify(parser.parseString);
        let sharingRulesObj1: any = {};
        let sharingRulesObj2: any = {};

        if (sharingRuleXml1 !== '') {
            let parseResult = await parseString(sharingRuleXml1);
            sharingRulesObj1 = parseResult.SharingRules || {};
        }
        if (sharingRuleXml2 !== '') {
            let parseResult = await parseString(sharingRuleXml2);
            sharingRulesObj2 = parseResult.SharingRules || {};
        }

        let addedEditedOrDeleted = SharingRuleDiff.buildSharingRulesObj(sharingRulesObj1, sharingRulesObj2);

        SharingRuleDiff.writeSharingRule(addedEditedOrDeleted.addedEdited, outputFilePath);

        destructivePackageObj = SharingRuleDiff.buildDestructiveChangesObj(
            addedEditedOrDeleted.deleted,
            destructivePackageObj,
            objectName
        );

        SharingRuleDiff.updateOutput(
            addedEditedOrDeleted.addedEdited,
            resultOutput,
            objectName,
            'Deploy',
            outputFilePath
        );
        if (isDestructive) {
            SharingRuleDiff.updateOutput(
                addedEditedOrDeleted.deleted,
                resultOutput,
                objectName,
                'Delete',
                'destructiveChanges.xml'
            );
        }
        return destructivePackageObj;
    }

    private static updateOutput(sharingRulesObj, resultOutput: any[], objectName, action, filePath) {
        sharingRulesObj.sharingCriteriaRules.forEach((elem) => {
            resultOutput.push({
                action: action,
                metadataType: 'SharingCriteriaRule',
                componentName: `${objectName}.${elem.fullName}`,
                path: filePath,
            });
        });
        sharingRulesObj.sharingOwnerRules.forEach((elem) => {
            resultOutput.push({
                action: action,
                metadataType: 'SharingOwnerRule',
                componentName: `${objectName}.${elem.fullName}`,
                path: filePath,
            });
        });
        sharingRulesObj.sharingTerritoryRules.forEach((elem) => {
            resultOutput.push({
                action: action,
                metadataType: 'SharingTerritoryRule',
                componentName: `${objectName}.${elem.fullName}`,
                path: filePath,
            });
        });
    }
    private static ensureArray(sharingObj) {
        let keys = Object.keys(sharingObj);
        keys.forEach((key) => {
            if (typeof sharingObj[key] === 'object' && !Array.isArray(sharingObj[key]) && key !== '$') {
                sharingObj[key] = [sharingObj[key]];
            }
        });
        return sharingObj;
    }

    public static async getMembers(filePath: string) {
        let fileContent = fs.readFileSync(filePath, 'utf8').toString();
        const parseString = util.promisify(parser.parseString);
        let members = {};
        if (fileContent !== '') {
            let parseResult = await parseString(fileContent);
            let sharingRulesObj = parseResult.SharingRules || {};
            if (!_.isNil(sharingRulesObj.sharingCriteriaRules)) {
                if (!Array.isArray(sharingRulesObj.sharingCriteriaRules)) {
                    members['SharingCriteriaRule'] = [sharingRulesObj.sharingCriteriaRules.fullName];
                } else {
                    members['SharingCriteriaRule'] = sharingRulesObj.sharingCriteriaRules.map((sharingRule) => {
                        return sharingRule.fullName;
                    });
                }
            }
            if (!_.isNil(sharingRulesObj.sharingOwnerRules)) {
                if (!Array.isArray(sharingRulesObj.sharingOwnerRules)) {
                    members['SharingOwnerRule'] = [sharingRulesObj.sharingOwnerRules.fullName];
                } else {
                    members['SharingOwnerRule'] = sharingRulesObj.sharingOwnerRules.map((sharingRule) => {
                        return sharingRule.fullName;
                    });
                }
            }
            if (!_.isNil(sharingRulesObj.sharingTerritoryRules)) {
                if (!Array.isArray(sharingRulesObj.sharingTerritoryRules)) {
                    members['SharingTerritoryRule'] = [sharingRulesObj.sharingTerritoryRules.fullName];
                } else {
                    members['SharingTerritoryRule'] = sharingRulesObj.sharingTerritoryRules.map((sharingRule) => {
                        return sharingRule.fullName;
                    });
                }
            }
            if (!_.isNil(sharingRulesObj.sharingGuestRules)) {
                if (!Array.isArray(sharingRulesObj.sharingGuestRules)) {
                    members['SharingGuestRule'] = [sharingRulesObj.sharingGuestRules.fullName];
                } else {
                    members['SharingGuestRule'] = sharingRulesObj.sharingGuestRules.map((sharingRule) => {
                        return sharingRule.fullName;
                    });
                }
            }
        }
        return members;
    }

    private static buildSharingRulesObj(
        sharingRuleObj1: any,
        sharingRulesObj2: any
    ): { addedEdited: any; deleted: any } {
        let newSharingRuleObj = {
            $: { xmlns: 'http://soap.sforce.com/2006/04/metadata' },
            sharingCriteriaRules: [],
            sharingOwnerRules: [],
            sharingTerritoryRules: [],
            sharingGuestRules: [],
        };

        sharingRuleObj1 = SharingRuleDiff.ensureArray(sharingRuleObj1);
        sharingRulesObj2 = SharingRuleDiff.ensureArray(sharingRulesObj2);

        let deletedSharingObj = {
            $: { xmlns: 'http://soap.sforce.com/2006/04/metadata' },
            sharingCriteriaRules: [],
            sharingOwnerRules: [],
            sharingTerritoryRules: [],
            sharingGuestRules: [],
        };

        let addedDeleted = DiffUtil.getChangedOrAdded(
            sharingRuleObj1.sharingCriteriaRules,
            sharingRulesObj2.sharingCriteriaRules,
            'fullName'
        );

        newSharingRuleObj.sharingCriteriaRules = addedDeleted.addedEdited;
        deletedSharingObj.sharingCriteriaRules = addedDeleted.deleted;

        addedDeleted = DiffUtil.getChangedOrAdded(
            sharingRuleObj1.sharingOwnerRules,
            sharingRulesObj2.sharingOwnerRules,
            'fullName'
        );

        newSharingRuleObj.sharingOwnerRules = addedDeleted.addedEdited;
        deletedSharingObj.sharingOwnerRules = addedDeleted.deleted;

        addedDeleted = DiffUtil.getChangedOrAdded(
            sharingRuleObj1.sharingTerritoryRules,
            sharingRulesObj2.sharingTerritoryRules,
            'fullName'
        );

        newSharingRuleObj.sharingTerritoryRules = addedDeleted.addedEdited;
        deletedSharingObj.sharingTerritoryRules = addedDeleted.deleted;

        addedDeleted = DiffUtil.getChangedOrAdded(
            sharingRuleObj1.sharingGuestRules,
            sharingRulesObj2.sharingGuestRules,
            'fullName'
        );

        newSharingRuleObj.sharingGuestRules = addedDeleted.addedEdited;
        deletedSharingObj.sharingGuestRules = addedDeleted.deleted;

        return {
            addedEdited: newSharingRuleObj,
            deleted: deletedSharingObj,
        };
    }

    private static buildDestructiveChangesObj(deletedSharing: any, destructivePackageObj: any[], objectName: string) {
        let sharingCriteriaRules: any = _.find(destructivePackageObj, function (metaType: any) {
            return metaType.name === 'SharingCriteriaRule';
        });
        if (
            sharingCriteriaRules === undefined &&
            deletedSharing.sharingCriteriaRules !== undefined &&
            deletedSharing.sharingCriteriaRules.length > 0
        ) {
            sharingCriteriaRules = {
                name: 'SharingCriteriaRule',
                members: [],
            };
            destructivePackageObj.push(sharingCriteriaRules);
        }
        if (deletedSharing.sharingCriteriaRules !== undefined) {
            deletedSharing.sharingCriteriaRules.forEach((elem) => {
                sharingCriteriaRules.members.push(objectName + '.' + elem.fullName);
            });
        }
        let sharingOwnerRules: any = _.find(destructivePackageObj, function (metaType: any) {
            return metaType.name === 'SharingOwnerRule';
        });
        if (
            sharingOwnerRules === undefined &&
            deletedSharing.sharingOwnerRules !== undefined &&
            deletedSharing.sharingOwnerRules.length > 0
        ) {
            sharingOwnerRules = {
                name: 'SharingOwnerRule',
                members: [],
            };
            destructivePackageObj.push(sharingOwnerRules);
        }
        if (deletedSharing.sharingOwnerRules !== undefined) {
            deletedSharing.sharingOwnerRules.forEach((elem) => {
                sharingOwnerRules.members.push(objectName + '.' + elem.fullName);
            });
        }
        let sharingTerritoryRules: any = _.find(destructivePackageObj, function (metaType: any) {
            return metaType.name === 'SharingTerritoryRule';
        });
        if (
            sharingTerritoryRules === undefined &&
            deletedSharing.sharingTerritoryRules !== undefined &&
            deletedSharing.sharingTerritoryRules.length > 0
        ) {
            sharingTerritoryRules = {
                name: 'SharingTerritoryRule',
                members: [],
            };
            destructivePackageObj.push(sharingTerritoryRules);
        }
        if (deletedSharing.sharingTerritoryRules !== undefined) {
            deletedSharing.sharingTerritoryRules.forEach((elem) => {
                sharingTerritoryRules.members.push(objectName + '.' + elem.fullName);
            });
        }

        return destructivePackageObj;
    }

    private static writeSharingRule(newSharingRulesObj: any, outputFilePath: string) {
        const builder = new xml2js.Builder({
            xmldec: { version: '1.0', encoding: 'UTF-8', standalone: null },
        });
        let sharingRulesObj = {
            SharingRules: newSharingRulesObj,
        };
        let xml = builder.buildObject(sharingRulesObj);
        fs.writeFileSync(outputFilePath, xml);
    }
}
