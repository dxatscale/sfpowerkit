import { Sfpowerkit } from '../../../sfpowerkit';
import * as path from 'path';
import * as _ from 'lodash';
import ProfileActions, { ProfileSourceFile } from './profileActions';
import FileUtils from '../../../utils/fileutils';
import * as fs from 'fs-extra';
import { Worker } from 'worker_threads';
import SFPLogger, {LoggerLevel} from '@dxatscale/sfp-logger';
import MetadataFiles from '../../../impl/metadata/metadataFiles';

export default class ProfileReconcile extends ProfileActions {
    public async reconcile(srcFolders: string[], profileList: string[], destFolder: string): Promise<string[]> {
        //Get supported permissions from the org

        this.createDestinationFolder(destFolder);
        SFPLogger.log(`ProfileList ${JSON.stringify(profileList)}`, LoggerLevel.DEBUG);

        if (_.isNil(srcFolders) || srcFolders.length === 0) {
            srcFolders = await Sfpowerkit.getProjectDirectories();
        }

        SFPLogger.log(`Project Directories ${JSON.stringify(srcFolders)}`, LoggerLevel.TRACE);
        let localProfiles = await this.loadProfileFromPackageDirectories(srcFolders);

        //Find Profiles to Reconcile
        let profilesToReconcile: ProfileSourceFile[] = this.findProfilesToReconcile(profileList, localProfiles);

        SFPLogger.log(`Profiles Found in Project Directory ${profilesToReconcile.length}`, LoggerLevel.INFO);

        let reconciledProfiles = [];
        //Reconcile one first, then do the rest later to use cache for subsequent one
        if (profilesToReconcile.length > 1) {
            reconciledProfiles = await this.runWorkers([profilesToReconcile[0]], destFolder);
            profilesToReconcile.shift();
        }

        reconciledProfiles = reconciledProfiles.concat(await this.runWorkers(profilesToReconcile, destFolder));
        return reconciledProfiles;
    }

    private runWorkers(profilesToReconcile: ProfileSourceFile[], destFolder) {
        let workerCount = 0;
        let finishedWorkerCount = 0;
        let chunk = 10; // One worker to process 10 profiles
        let i: number;
        let profileCount = profilesToReconcile.length;
        let result: string[] = [];

        let workerPromise = new Promise<string[]>((resolve, reject) => {
            for (i = 0; i < profileCount; i += chunk) {
                workerCount++;
                let temparray: ProfileSourceFile[] = profilesToReconcile.slice(i, i + chunk);

                SFPLogger.log(
                    `Initiated Profile reconcile thread :${workerCount}  with a chunk of ${temparray.length} profiles`,
                    LoggerLevel.INFO
                );
                SFPLogger.log(`Profiles queued in thread :${workerCount} :`, LoggerLevel.INFO);
                SFPLogger.log(`${JSON.stringify(temparray)}`, LoggerLevel.INFO);
                let reconcileWorkerFile;

                //Switch to typescript while run locally using sfdx link, for debugging, else switch to js
                if (fs.existsSync(path.resolve(__dirname, `./reconcileWorker.js`))) {
                    reconcileWorkerFile = `./reconcileWorker.js`;
                } else {
                    reconcileWorkerFile = `./reconcileWorker.ts`;
                }

                const worker = new Worker(path.resolve(__dirname, './worker.js'), {
                    workerData: {
                        profileChunk: temparray,
                        destFolder: destFolder,
                        targetOrg: this.org?.getUsername(), //Org can be null during source only reconcile
                        loglevel: SFPLogger.logLevel,
                        isJsonFormatEnabled: Sfpowerkit.isJsonFormatEnabled,
                        isSourceOnly: MetadataFiles.sourceOnly,
                        path: reconcileWorkerFile,
                    },
                });

                worker.on('message', (data) => {
                    // eslint-disable-next-line @typescript-eslint/no-array-constructor
                    let completedProfiles: string[] = new Array();
                    completedProfiles.push(...data);
                    for (const profile of completedProfiles) {
                        SFPLogger.log(`Reconciled Profile ${profile}`, LoggerLevel.INFO);
                    }
                    result.push(...data);
                });

                worker.on('error', (err)=> {
                    Sfpowerkit.log(`Error while running worker ${err}`, LoggerLevel.ERROR);
                    reject(err);
                });
                worker.on('exit', (code) => {
                    finishedWorkerCount++;
                    if (code !== 0)
                        //reject(new Error(`Worker stopped with exit code ${code}`));
                        SFPLogger.log(`Worker stopped with exit code ${code}`, LoggerLevel.ERROR);

                    if (workerCount === finishedWorkerCount) {
                        resolve(result);
                    }
                });
            }
        });
        return workerPromise;
    }

    private findProfilesToReconcile(profileList: string[], localProfiles: ProfileSourceFile[]) {
        let profilesToReconcile;
        if (profileList.length > 0) {
            profilesToReconcile = localProfiles.filter((elem) => {
                if (profileList.includes(elem.name)) return true;
            });
        } else {
            profilesToReconcile = localProfiles;
        }
        return profilesToReconcile;
    }

    private createDestinationFolder(destFolder: string) {
        if (!_.isNil(destFolder)) {
            FileUtils.mkDirByPathSync(destFolder);
        }
    }
}
