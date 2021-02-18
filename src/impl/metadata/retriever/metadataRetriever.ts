import { LoggerLevel, SFPowerkit } from "../../../sfpowerkit";
import * as _ from "lodash";
import { Connection } from "jsforce";
import { MetadataInfo, METADATA_INFO } from "../metadataInfo";
import QueryExecutor from "../../../utils/queryExecutor";

export default class MetadataRetriever {
  protected _componentType;
  protected _conn;
  private _metadataInProjectDirectory: MetadataInfo;

  public constructor(
    conn: Connection,
    componentType: string,
    metadataInProjectDirectory?: MetadataInfo
  ) {
    this._conn = conn;
    this._componentType = componentType;
    this._metadataInProjectDirectory = metadataInProjectDirectory;
  }

  public get componentType() {
    return this._componentType;
  }

  public async getComponents(parent?: string) {
    let key = parent ? this._componentType + "_" + parent : this._componentType;
    if (!SFPowerkit.getCache().get(key)) {
      let items;
      if (this._componentType === "UserLicense") {
        items = await this.getUserLicense();
      } else if (this._componentType === METADATA_INFO.CustomObject.xmlName) {
        items = await this.getCustomObjects();
      } else if (this._componentType === "ObjectPermissions") {
        items = await this.getObjectPermissions();
      } else if (this._componentType === METADATA_INFO.CustomField.xmlName) {
        items = await this.getFieldsByObjectName(parent);
      } else if (this._componentType === METADATA_INFO.Layout.xmlName) {
        items = await this.getLayouts();
      } else if (this._componentType === METADATA_INFO.CustomTab.xmlName) {
        items = await this.getTabs();
      } else {
        items = await this.getComponentsFromOrgUsingListMetadata();
      }
      SFPowerkit.getCache().set(key, items);
    }
    return SFPowerkit.getCache().get(key);
  }

  private async getUserLicense() {
    let query = `Select Id, Name, LicenseDefinitionKey From UserLicense`;

    let queryUtil = new QueryExecutor(this._conn);
    let items = await queryUtil.executeQuery(query, false);

    return items.map((lic) => {
      lic.fullName = lic.Name;
      return lic;
    });
  }
  private async getTabs() {
    let query = `SELECT Id,  Name, SobjectName, DurableId, IsCustom, Label FROM TabDefinition`;

    let queryUtil = new QueryExecutor(this._conn);
    let items = await queryUtil.executeQuery(query, false);

    return items.map((tab) => {
      tab.fullName = tab.Name;
      return tab;
    });
  }

  private async getComponentsFromOrgUsingListMetadata() {
    const apiversion: string = await SFPowerkit.getApiVersion();
    let items = await this._conn.metadata.list(
      {
        type: this._componentType,
      },
      apiversion
    );
    if (items === undefined || items === null) {
      items = [];
    }
    return items;
  }

  public async isComponentExistsInTheOrg(
    item: string,
    parent?: string
  ): Promise<boolean> {
    let items = await this.getComponents(parent);
    let foundItem = items.find((p) => {
      return p.fullName === item;
    });
    foundItem = !_.isNil(foundItem);

    return foundItem;
  }

  public async isComponentExistsInProjectDirectory(
    item: string
  ): Promise<boolean> {
    let found: boolean = false;
    if (
      !_.isNil(this._metadataInProjectDirectory[this._componentType].components)
    ) {
      found = this._metadataInProjectDirectory[
        this._componentType
      ].components.includes(item);
    }
    return found;
  }

  public async isComponentExistsInProjectDirectoryOrInOrg(
    item: string,
    parent?: string
  ): Promise<boolean> {
    let found: boolean = false;
    //First check in directory
    found = await this.isComponentExistsInProjectDirectory(item);
    SFPowerkit.log(`Found in Directory? ${item} ${found}`, LoggerLevel.TRACE);
    if (found === false)
      found = await this.isComponentExistsInTheOrg(item, parent);

    SFPowerkit.log(`Found in Org? ${item} ${found}`, LoggerLevel.TRACE);
    return found;
  }

  private async getCustomObjects(): Promise<any> {
    let results = await this._conn.describeGlobal();
    let entities = results.sobjects.map((sObject) => {
      return {
        QualifiedApiName: sObject.name,
        fullName: sObject.name,
      };
    });

    return entities;
  }

  private async getObjectPermissions(): Promise<any[]> {
    let objectForPermission = [];
    let res = await this._conn.query(
      "SELECT SobjectType, count(Id) From ObjectPermissions Group By sObjectType"
    );
    if (res !== undefined) {
      objectForPermission = res.records.map((elem) => {
        return { fullName: elem["SobjectType"] };
      });
    }
    if (!objectForPermission.includes("PersonAccount")) {
      objectForPermission.push({ fullName: "PersonAccount" });
    }
    return objectForPermission;
  }

  private async getFieldsByObjectName(objectName: string): Promise<any[]> {
    let fields = [];
    try {
      SFPowerkit.log(
        `Fetching Field of Object ${objectName}`,
        LoggerLevel.TRACE
      );
      await this._conn.describe(objectName).then((meta) => {
        if (meta.fields && meta.fields.length > 0) {
          fields = meta.fields.map((field) => {
            return { fullName: `${objectName}.${field.name}` };
          });
        }
      });
    } catch (error) {
      SFPowerkit.log(
        `Object not found ${objectName}..skipping`,
        LoggerLevel.TRACE
      );
    }
    return fields;
  }

  private async getLayouts(): Promise<any[]> {
    SFPowerkit.log(`Fetching Layouts`, LoggerLevel.TRACE);
    let apiversion: string = await SFPowerkit.getApiVersion();
    let layouts = await this._conn.metadata.list(
      {
        type: METADATA_INFO.Layout.xmlName,
      },
      apiversion
    );
    if (layouts != undefined && layouts.length > 0) {
      for (let i = 0; i < layouts.length; i++) {
        if (
          layouts[i].namespacePrefix !== undefined &&
          layouts[i].namespacePrefix !== "" &&
          layouts[i].namespacePrefix !== null &&
          layouts[i].namespacePrefix !== "null"
        ) {
          //apend namespacePrefix in layout
          layouts[i].fullName = layouts[i].fullName.replace(
            "-",
            `-${layouts[i].namespacePrefix}__`
          );
        }
      }
    } else {
      layouts = [];
    }

    return layouts;
  }
}
