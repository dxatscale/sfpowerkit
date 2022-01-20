import * as fs from "fs-extra";
import * as xml2js from "xml2js";
import * as util from "util";
import DiffUtil from "./diffUtil";
const _ = require("lodash");

const parser = new xml2js.Parser({
  explicitArray: false,
  valueProcessors: [
    function(name) {
      if (name === "true") name = true;
      if (name === "false") name = false;
      return name;
    }
  ]
});

export default class WorkflowDiff {
  public static async generateWorkflowXml(
    workflowXml1: string,
    workflowXml2: string,
    outputFilePath: string,
    objectName: string,
    destructivePackageObj: any[],
    resultOutput: any[],
    isDestructive: boolean
  ) {
    let workflowObj1: any = {};
    let workflowObj2: any = {};

    const parseString = util.promisify(parser.parseString);

    if (workflowXml1 !== "") {
      let parseResult = await parseString(workflowXml1);
      workflowObj1 = parseResult.Workflow || {};
    }

    if (workflowXml2 !== "") {
      let parseResult = await parseString(workflowXml2);
      workflowObj2 = parseResult.Workflow || {};
    }

    let addedEditedOrDeleted = WorkflowDiff.buildNewWorkflowObj(
      workflowObj1,
      workflowObj2
    );

    WorkflowDiff.writeWorkflow(
      addedEditedOrDeleted.addedEdited,
      outputFilePath
    );

    destructivePackageObj = WorkflowDiff.buildDestructiveChangesObj(
      addedEditedOrDeleted.deleted,
      destructivePackageObj,
      objectName
    );

    WorkflowDiff.updateOutput(
      addedEditedOrDeleted.addedEdited,
      resultOutput,
      objectName,
      "Deploy",
      outputFilePath
    );

    if (isDestructive) {
      WorkflowDiff.updateOutput(
        addedEditedOrDeleted.deleted,
        resultOutput,
        objectName,
        "Delete",
        "destructiveChanges.xml"
      );
    }
    return destructivePackageObj;
  }

  private static updateOutput(
    workflowObj,
    resultOutput: any[],
    objectName,
    action,
    filePath
  ) {
    workflowObj.alerts.forEach(elem => {
      resultOutput.push({
        action: action,
        metadataType: "WorkflowAlert",
        componentName: `${objectName}.${elem.fullName}`,
        path: filePath
      });
    });

    workflowObj.fieldUpdates.forEach(elem => {
      resultOutput.push({
        action: action,
        metadataType: "WorkflowFieldUpdate",
        componentName: `${objectName}.${elem.fullName}`,
        path: filePath
      });
    });

    workflowObj.knowledgePublishes.forEach(elem => {
      resultOutput.push({
        action: action,
        metadataType: "WorkflowKnowledgePublish",
        componentName: `${objectName}.${elem.label}`,
        path: filePath
      });
    });

    workflowObj.outboundMessages.forEach(elem => {
      resultOutput.push({
        action: action,
        metadataType: "WorkflowOutboundMessage",
        componentName: `${objectName}.${elem.fullName}`,
        path: filePath
      });
    });

    workflowObj.rules.forEach(elem => {
      resultOutput.push({
        action: action,
        metadataType: "WorkflowRule",
        componentName: `${objectName}.${elem.fullName}`,
        path: filePath
      });
    });

    workflowObj.tasks.forEach(elem => {
      resultOutput.push({
        action: action,
        metadataType: "WorkflowTask",
        componentName: `${objectName}.${elem.fullName}`,
        path: filePath
      });
    });
  }

  private static ensureArray(workflowObj) {
    let keys = Object.keys(workflowObj);
    keys.forEach(key => {
      if (
        typeof workflowObj[key] === "object" &&
        !Array.isArray(workflowObj[key]) &&
        key !== "$"
      ) {
        workflowObj[key] = [workflowObj[key]];
      }
    });
    return workflowObj;
  }

  public static async getMembers(filePath: string) {
    let fileContent = fs.readFileSync(filePath, "utf8").toString();
    const parseString = util.promisify(parser.parseString);
    let members = {};
    if (fileContent !== "") {
      let parseResult = await parseString(fileContent);
      let workFlowObj = parseResult.Workflow || {};
      if (!_.isNil(workFlowObj.alerts)) {
        if (!Array.isArray(workFlowObj.alerts)) {
          members["WorkflowAlert"] = [workFlowObj.alerts.fullName];
        } else {
          members["WorkflowAlert"] = workFlowObj.alerts.map(workFlowAlert => {
            return workFlowAlert.fullName;
          });
        }
      }
      if (!_.isNil(workFlowObj.fieldUpdates)) {
        if (!Array.isArray(workFlowObj.fieldUpdates)) {
          members["WorkflowFieldUpdate"] = [workFlowObj.fieldUpdates.fullName];
        } else {
          members["WorkflowFieldUpdate"] = workFlowObj.fieldUpdates.map(
            workFlowFU => {
              return workFlowFU.fullName;
            }
          );
        }
      }
      if (!_.isNil(workFlowObj.knowledgePublishes)) {
        if (!Array.isArray(workFlowObj.knowledgePublishes)) {
          members["WorkflowKnowledgePublish"] = [
            workFlowObj.knowledgePublishes.label
          ];
        } else {
          members[
            "WorkflowKnowledgePublish"
          ] = workFlowObj.knowledgePublishes.map(workflowKnowledgePublish => {
            return workflowKnowledgePublish.label;
          });
        }
      }
      if (!_.isNil(workFlowObj.outboundMessages)) {
        if (!Array.isArray(workFlowObj.outboundMessages)) {
          members["WorkflowOutboundMessage"] = [
            workFlowObj.outboundMessages.fullName
          ];
        } else {
          members["WorkflowOutboundMessage"] = workFlowObj.outboundMessages.map(
            workflowOutboundMessage => {
              return workflowOutboundMessage.fullName;
            }
          );
        }
      }
      if (!_.isNil(workFlowObj.rules)) {
        if (!Array.isArray(workFlowObj.rules)) {
          members["WorkflowRule"] = [workFlowObj.rules.fullName];
        } else {
          members["WorkflowRule"] = workFlowObj.rules.map(workflowRule => {
            return workflowRule.fullName;
          });
        }
      }
      if (!_.isNil(workFlowObj.tasks)) {
        if (!Array.isArray(workFlowObj.tasks)) {
          members["WorkflowTask"] = [workFlowObj.tasks.fullName];
        } else {
          members["WorkflowTask"] = workFlowObj.tasks.map(workflowTask => {
            return workflowTask.fullName;
          });
        }
      }
    }
    return members;
  }

  private static buildNewWorkflowObj(workflowObj1: any, workflowObj2: any) {
    workflowObj1 = WorkflowDiff.ensureArray(workflowObj1);
    workflowObj2 = WorkflowDiff.ensureArray(workflowObj2);

    let newWorkflowObj: any = {
      $: { xmlns: "http://soap.sforce.com/2006/04/metadata" },
      alerts: [],
      fieldUpdates: [],
      knowledgePublishes: [],
      outboundMessages: [],
      rules: [],
      tasks: []
    };
    let deletedWorkflowObj: any = {
      $: { xmlns: "http://soap.sforce.com/2006/04/metadata" },
      alerts: [],
      fieldUpdates: [],
      knowledgePublishes: [],
      outboundMessages: [],
      rules: [],
      tasks: []
    };
    if (
      workflowObj1.fullName !== undefined ||
      workflowObj2.fullName !== undefined
    ) {
      newWorkflowObj.fullName = workflowObj2.fullName;
    }

    //Email alerts
    let addedDeleted = DiffUtil.getChangedOrAdded(
      workflowObj1.alerts,
      workflowObj2.alerts,
      "fullName"
    );
    newWorkflowObj.alerts = addedDeleted.addedEdited;
    deletedWorkflowObj.alerts = addedDeleted.deleted;

    //Field Update
    addedDeleted = DiffUtil.getChangedOrAdded(
      workflowObj1.fieldUpdates,
      workflowObj2.fieldUpdates,
      "fullName"
    );
    newWorkflowObj.fieldUpdates = addedDeleted.addedEdited;
    deletedWorkflowObj.fieldUpdates = addedDeleted.deleted;

    //Knowledge Publishes
    addedDeleted = DiffUtil.getChangedOrAdded(
      workflowObj1.knowledgePublishes,
      workflowObj2.knowledgePublishes,
      "label"
    );
    newWorkflowObj.knowledgePublishes = addedDeleted.addedEdited;
    deletedWorkflowObj.knowledgePublishes = addedDeleted.deleted;

    //Outbound Messages
    addedDeleted = DiffUtil.getChangedOrAdded(
      workflowObj1.outboundMessages,
      workflowObj2.outboundMessages,
      "fullName"
    );
    newWorkflowObj.outboundMessages = addedDeleted.addedEdited;
    deletedWorkflowObj.outboundMessages = addedDeleted.deleted;

    //Rules
    addedDeleted = DiffUtil.getChangedOrAdded(
      workflowObj1.rules,
      workflowObj2.rules,
      "fullName"
    );
    newWorkflowObj.rules = addedDeleted.addedEdited;
    deletedWorkflowObj.rules = addedDeleted.deleted;

    //Task
    addedDeleted = DiffUtil.getChangedOrAdded(
      workflowObj1.tasks,
      workflowObj2.tasks,
      "fullName"
    );
    newWorkflowObj.tasks = addedDeleted.addedEdited;
    deletedWorkflowObj.tasks = addedDeleted.deleted;

    return {
      addedEdited: newWorkflowObj,
      deleted: deletedWorkflowObj
    };
  }
  private static buildDestructiveChangesObj(
    deletedWorkflows: any,
    destructivePackageObj: any[],
    objectName: string
  ) {
    destructivePackageObj = WorkflowDiff.buildDestructiveType(
      destructivePackageObj,
      deletedWorkflows.alerts,
      "WorkflowAlert",
      objectName
    );
    destructivePackageObj = WorkflowDiff.buildDestructiveType(
      destructivePackageObj,
      deletedWorkflows.fieldUpdates,
      "WorkflowFieldUpdate",
      objectName
    );
    destructivePackageObj = WorkflowDiff.buildDestructiveType(
      destructivePackageObj,
      deletedWorkflows.knowledgePublishes,
      "WorkflowKnowledgePublish",
      objectName
    );
    destructivePackageObj = WorkflowDiff.buildDestructiveType(
      destructivePackageObj,
      deletedWorkflows.outboundMessages,
      "WorkflowOutboundMessage",
      objectName
    );
    destructivePackageObj = WorkflowDiff.buildDestructiveType(
      destructivePackageObj,
      deletedWorkflows.rules,
      "WorkflowRule",
      objectName
    );
    destructivePackageObj = WorkflowDiff.buildDestructiveType(
      destructivePackageObj,
      deletedWorkflows.tasks,
      "WorkflowTask",
      objectName
    );

    return destructivePackageObj;
  }

  private static buildDestructiveType(
    destructivePackageObj: any[],
    list: any[],
    typeLabel: string,
    objectName: string
  ) {
    let metaType: any = _.find(destructivePackageObj, function(metaType: any) {
      return metaType.name === typeLabel;
    });
    if (metaType === undefined && list !== undefined && list.length > 0) {
      metaType = {
        name: typeLabel,
        members: []
      };
      destructivePackageObj.push(metaType);
    }
    if (list !== undefined) {
      list.forEach(elem => {
        metaType.members.push(objectName + "." + elem.fullName);
      });
    }

    return destructivePackageObj;
  }

  private static writeWorkflow(newWorkflowObj: any, outputFilePath: string) {
    const builder = new xml2js.Builder({
      xmldec: { version: "1.0", encoding: "UTF-8", standalone: null }
    });
    let workflowObj = {
      Workflow: newWorkflowObj
    };
    let xml = builder.buildObject(workflowObj);
    fs.writeFileSync(outputFilePath, xml);
  }
}
