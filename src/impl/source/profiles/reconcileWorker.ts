import { Connection, Org, SfdxProject } from '@salesforce/core';
import { Sfpowerkit } from '../../../sfpowerkit';
import SFPLogger, {LoggerLevel } from '@dxatscale/sfp-logger';
import { parentPort, workerData } from 'worker_threads';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as xml2js from 'xml2js';
import * as util from 'util';
import ProfileWriter from '../../metadata/writer/profileWriter';
import Profile from '../../metadata/schema';

import ProfileComponentReconciler from './profileComponentReconciler';
import { MetadataResolver, SourceComponent } from '@salesforce/source-deploy-retrieve';
import { ProfileSourceFile } from './profileActions';

export default class ReconcileWorker {
    private conn: Connection;
    public constructor(private targetOrg: string, private isSourceOnly: boolean) {}

    public async reconcile(profilesToReconcile: ProfileSourceFile[], destFolder) {
        //Init Cache for each worker thread from file system

        Sfpowerkit.initCache();

        if (this.targetOrg) {
            let org = await Org.create({ aliasOrUsername: this.targetOrg });
            this.conn = org.getConnection();
        } else {
            //Load all local components from source to database
            await this.loadAllLocalComponents();
        }

        let result: string[] = [];
        for (let count = 0; count < profilesToReconcile.length; count++) {
            let reconciledProfile = await this.reconcileProfileJob(profilesToReconcile[count], destFolder);
            result.push(reconciledProfile[0]);
        }
        return result;
    }

    private async loadAllLocalComponents() {
        const resolver = new MetadataResolver();
        const project = await SfdxProject.resolve();
        let packageDirectories = project.getPackageDirectories();

        for (const packageDirectory of packageDirectories) {
            const components = resolver.getComponentsFromPath(packageDirectory.path);
            for (const component of components) {
                this.loadComponentsTocache(component);
            }
        }
    }

    private loadComponentsTocache(component:SourceComponent){
        Sfpowerkit.addToCache(`SOURCE_${component.type.name}_${component.fullName}`, true);
        Sfpowerkit.addToCache(`${component.type.name}_SOURCE_CACHE_AVAILABLE`, true);
        let children:SourceComponent[] = component.getChildren();
        for (const child of children) {
            this.loadComponentsTocache(child);
        }
    }
    
    public reconcileProfileJob(profileComponent: ProfileSourceFile, destFolder: string): Promise<string[]> {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        let reconcilePromise = new Promise<string[]>((resolve, reject) => {
            let result: string[] = []; // Handle result of command execution

            let profileXmlString = fs.readFileSync(profileComponent.path);
            const parser = new xml2js.Parser({ explicitArray: true });
            const parseString = util.promisify(parser.parseString);
            parseString(profileXmlString)
                .then((parseResult) => {
                    let profileWriter = new ProfileWriter();
                    let profileObj: Profile = profileWriter.toProfile(parseResult.Profile); // as Profile
                    return profileObj;
                })
                .then((profileObj) => {
                    return new ProfileComponentReconciler(this.conn, this.isSourceOnly).reconcileProfileComponents(
                        profileObj,
                        profileComponent.name
                    );
                })
                .then((profileObj) => {
                    //write profile back
                    let outputFile = profileComponent.path;
                    if (destFolder != null) {
                        outputFile = path.join(destFolder, path.basename(profileComponent.path));
                    }
                    let profileWriter = new ProfileWriter();
                    profileWriter.writeProfile(profileObj, outputFile);
                    result.push(outputFile);
                    resolve(result);
                    return result;
                })
                .catch((error) => {
                    SFPLogger.log(
                        'Error while processing file ' + profileComponent + '. ERROR Message: ' + error.message,
                        LoggerLevel.ERROR
                    );
                });
        });
        return reconcilePromise;
    }
}

Sfpowerkit.setLogLevel(workerData.loglevel, workerData.isJsonFormatEnabled);

let reconcileWorker = new ReconcileWorker(workerData.targetOrg, workerData.isSourceOnly);
reconcileWorker.reconcile(workerData.profileChunk, workerData.destFolder).then((result) => {
    parentPort.postMessage(result);
});
