import Profile from '../schema';
import { Sfpowerkit } from '../../../sfpowerkit';
import * as fs from 'fs-extra';
import * as xml2js from 'xml2js';
const format = require('xml-formatter');

const nonArayProperties = ['custom', 'description', 'fullName', 'userLicense', '$'];
const PROFILE_NAMESPACE = 'http://soap.sforce.com/2006/04/metadata';

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

        let builder = new xml2js.Builder({
            rootName: 'Profile',
            xmldec: { version: '1.0', encoding: 'UTF-8' },
        });
        profileObj['$'] = {
            xmlns: PROFILE_NAMESPACE,
        };
        let xml = builder.buildObject(profileObj);

        let formattedXml = format(xml, {
            indentation: '    ',
            filter: (node) => node.type !== 'Comment',
            collapseContent: true,
            lineSeparator: '\n',
        });

        //console.log(formattedXml);

        fs.writeFileSync(filePath, formattedXml);
    }

    public toXml(profileObj: Profile) {
        //Delete eampty arrays
        for (let key in profileObj) {
            if (Array.isArray(profileObj[key])) {
                //All top element must be arays exept non arrayProperties
                if (!nonArayProperties.includes(key) && profileObj[key].length === 0) {
                    delete profileObj[key];
                }
            }
        }
        let builder = new xml2js.Builder({
            rootName: 'Profile',
            xmldec: { version: '1.0', encoding: 'UTF-8' },
        });
        profileObj['$'] = {
            xmlns: PROFILE_NAMESPACE,
        };
        let xml = builder.buildObject(profileObj);
        let formattedXml = format(xml, {
            indentation: '    ',
            filter: (node) => node.type !== 'Comment',
            collapseContent: true,
            lineSeparator: '\n',
        });
        return formattedXml;
    }

    public toProfile(profileObj: any): Profile {
        let convertedObject: any = {};
        for (let key in profileObj) {
            if (Array.isArray(profileObj[key])) {
                //All top element must be arays exept non arrayProperties
                if (nonArayProperties.includes(key)) {
                    convertedObject[key] =
                        profileObj[key][0] === 'true'
                            ? true
                            : profileObj[key][0] === 'false'
                            ? false
                            : profileObj[key][0];
                } else {
                    let data = [];
                    for (let i = 0; i < profileObj[key].length; i++) {
                        let element = this.removeArrayNatureOnValue(profileObj[key][i]);
                        if (element !== '') {
                            data.push(element);
                        }
                    }
                    convertedObject[key] = data;
                }
            } else if (nonArayProperties.includes(key)) {
                convertedObject[key] = profileObj[key];
            } else {
                convertedObject[key] = [profileObj[key]];
            }
        }
        return convertedObject as Profile;
    }

    private removeArrayNatureOnValue(obj: any): any {
        let toReturn = {};
        for (let key in obj) {
            if (Array.isArray(obj[key]) && obj[key].length > 0) {
                //All top element must be arays exept non arrayProperties
                toReturn[key] = obj[key][0] === 'true' ? true : obj[key][0] === 'false' ? false : obj[key][0];
            } else {
                toReturn[key] = obj[key];
            }
        }
        return toReturn;
    }
}
