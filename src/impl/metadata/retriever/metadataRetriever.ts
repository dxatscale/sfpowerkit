import { SFPowerkit } from "../../../sfpowerkit";
import * as _ from "lodash";
import { Connection } from "jsforce";
import { MetadataInfo, METADATA_INFO } from "../metadataInfo";

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
    let key = parent ? this._componentType : this._componentType + "_" + parent;
    if (!SFPowerkit.getCache().get<any>(key)) {
      let items;
      if (this._componentType === METADATA_INFO.CustomField.xmlName) {
        items = await this.getFieldsByObjectName(parent);
      } else if (this._componentType === METADATA_INFO.Layout.xmlName) {
        items = await this.getLayouts();
      } else {
        const apiversion: string = await SFPowerkit.getApiVersion();
        items = await this._conn.metadata.list(
          {
            type: this._componentType,
          },
          apiversion
        );
        if (items === undefined || items === null) {
          items = [];
        }
      }
      SFPowerkit.getCache().set<any>(key, items);
    }

    return SFPowerkit.getCache().get<any>(key);
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
    if (found === false)
      found = await this.isComponentExistsInTheOrg(item, parent);
    return found;
  }

  private async getFieldsByObjectName(objectName: string): Promise<string[]> {
    let fields = [];
    await this._conn.describe(objectName).then((meta) => {
      if (meta.fields && meta.fields.length > 0) {
        fields = meta.fields.map((field) => {
          return field.name;
        });
      }
    });
    return fields;
  }

  private async getLayouts(): Promise<any[]> {
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
