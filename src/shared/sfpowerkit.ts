import { UX } from "@salesforce/command";
import * as xml2js from 'xml2js';

export class SfPowerKit{
    static ux:UX
    static defaultFolder:string;

    public static async parseXml(profileXml: any): Promise<any> {
        let toReturn: Promise<any> = new Promise<any>((resolve, reject) => {
            xml2js.parseString(profileXml, function (err: Error, result: any) {
                if (err !== undefined && err !== null) {
                    reject(err)
                }
                resolve(result)
            })
        })
        return toReturn
    }

}