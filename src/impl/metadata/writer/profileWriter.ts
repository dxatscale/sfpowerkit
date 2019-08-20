import Profile from "../schema";
import { SFPowerkit } from "../../../sfpowerkit";
import * as fs from "fs";
import xml2js = require("xml2js");

const nonArayProperties = [
  "custom",
  "description",
  "fullName",
  "userLicense",
  "$"
];
const PROFILE_NAMESPACE = "http://soap.sforce.com/2006/04/metadata";

export default class ProfileWriter {
  public writeProfile(profileObj: Profile, filePath: string) {
    //Delete eampty arrays
    for (let key in profileObj) {
      if (Array.isArray(profileObj[key])) {
        //All top element must be arays exept non arrayProperties
        if (!nonArayProperties.includes(key) && profileObj[key].length === 0) {
          delete profileObj[key];
        }
      }
    }
    if (profileObj.fullName !== undefined) {
      let builder = new xml2js.Builder({ rootName: "Profile" });
      profileObj["$"] = {
        xmlns: PROFILE_NAMESPACE
      };
      let xml = builder.buildObject(profileObj);
      fs.writeFileSync(filePath, xml);
    } else {
      SFPowerkit.ux.log("No ful name on profile component");
    }
  }

  public toProfile(profileObj: any): Profile {
    var convertedObject: any = {};
    for (var key in profileObj) {
      if (Array.isArray(profileObj[key])) {
        //All top element must be arays exept non arrayProperties
        if (nonArayProperties.includes(key)) {
          convertedObject[key] =
            profileObj[key][0] === "true"
              ? true
              : profileObj[key][0] === "false"
              ? false
              : profileObj[key][0];
        } else {
          var data = [];
          for (var i = 0; i < profileObj[key].length; i++) {
            var element = this.removeArrayNatureOnValue(profileObj[key][i]);
            if (element !== "") {
              data.push(element);
            }
          }
          convertedObject[key] = data;
        }
      } else if (nonArayProperties.includes(key)) {
        convertedObject[key] = profileObj[key];
      }
    }
    return convertedObject as Profile;
  }

  private removeArrayNatureOnValue(obj: any): any {
    var toReturn = {};
    for (var key in obj) {
      if (Array.isArray(obj[key]) && obj[key].length > 0) {
        //All top element must be arays exept non arrayProperties
        toReturn[key] =
          obj[key][0] === "true"
            ? true
            : obj[key][0] === "false"
            ? false
            : obj[key][0];
      } else {
        toReturn[key] = obj[key];
      }
    }
    return toReturn;
  }
}
