import { LoggerLevel, SFPowerkit } from "../../../sfpowerkit";
import MetadataFiles from "../../metadata/metadataFiles";
import * as path from "path";
import { METADATA_INFO } from "../../metadata/metadataInfo";
import * as _ from "lodash";
import ProfileActions from "./profileActions";
import FileUtils from "../../../utils/fileutils";
import * as fs from "fs-extra";

import { Worker } from "worker_threads";

export default class ProfileReconcile extends ProfileActions {
  metadataFiles: MetadataFiles;

  public async reconcile(
    srcFolders: string[],
    profileList: string[],
    destFolder: string
  ): Promise<string[]> {
    //Get supported permissions from the org

    this.createDestinationFolder(destFolder);
    SFPowerkit.log(
      `ProfileList ${JSON.stringify(profileList)}`,
      LoggerLevel.DEBUG
    );

    if (_.isNil(srcFolders) || srcFolders.length === 0) {
      srcFolders = await SFPowerkit.getProjectDirectories();
    }

    //Fetch all the metadata in the project directory
    this.metadataFiles = this.fetchMetadataFilesFromAllPackageDirectories(
      srcFolders
    );
    SFPowerkit.log(
      `Project Directories ${JSON.stringify(srcFolders)}`,
      LoggerLevel.TRACE
    );

    //Translate the provided profileList if any with proper extension
    profileList = profileList.map((element) => {
      return element + METADATA_INFO.Profile.sourceExtension;
    });

    SFPowerkit.log(
      `Profiles Found in Entire Drirectory ${METADATA_INFO.Profile.files.length}`,
      LoggerLevel.INFO
    );

    //Find Profiles to Reconcile
    let profilesToReconcile: string[] = this.findProfilesToReconcile(
      profileList
    );

    //Reconcile one first, then do the rest later to use cache for subsequent one
    if (profilesToReconcile.length > 1) {
      await this.runWorkers([profilesToReconcile[0]], destFolder);
      profilesToReconcile.shift();
    }

    return await this.runWorkers(profilesToReconcile, destFolder);
  }

  private runWorkers(profilesToReconcile: string[], destFolder) {
    let workerCount = 0;
    let finishedWorkerCount = 0;
    let chunk = 10; // One worker to process 10 profiles
    let i: number;
    let profileCount = profilesToReconcile.length;
    let result: string[] = [];

    let workerPromise = new Promise<string[]>((resolve, reject) => {
      for (i = 0; i < profileCount; i += chunk) {
        workerCount++;
        let temparray: string[] = profilesToReconcile.slice(i, i + chunk);

        SFPowerkit.log(
          `Initiated Profile reconcile thread :${workerCount}  with a chunk of ${temparray.length} profiles`,
          LoggerLevel.INFO
        );
        SFPowerkit.log(
          `Profiles queued in thread :${workerCount} :`,
          LoggerLevel.INFO
        );
        SFPowerkit.log(`${JSON.stringify(temparray)}`, LoggerLevel.INFO);
        let reconcileWorkerFile;

        //Switch to typescript while run locally using sfdx link, for debugging, else switch to js
        if (fs.existsSync(path.resolve(__dirname, `./reconcileWorker.js`))) {
          reconcileWorkerFile = `./reconcileWorker.js`;
        } else {
          reconcileWorkerFile = `./reconcileWorker.ts`;
        }

        const worker = new Worker(path.resolve(__dirname, "./worker.js"), {
          workerData: {
            profileChunk: temparray,
            destFolder: destFolder,
            targetOrg: this.org.getUsername(),
            loglevel: SFPowerkit.logLevelString,
            isJsonFormatEnabled: SFPowerkit.isJsonFormatEnabled,
            path: reconcileWorkerFile,
          },
        });

        worker.on("message", (data) => {
          // eslint-disable-next-line @typescript-eslint/no-array-constructor
          let completedProfiles: string[] = new Array();
          completedProfiles.push(...data);
          for (const profile of completedProfiles) {
            SFPowerkit.log(`Reconciled Profile ${profile}`, LoggerLevel.INFO);
          }
          result.push(...data);
        });

        worker.on("error", reject);
        worker.on("exit", (code) => {
          finishedWorkerCount++;
          if (code !== 0)
            //reject(new Error(`Worker stopped with exit code ${code}`));
            SFPowerkit.log(
              `Worker stopped with exit code ${code}`,
              LoggerLevel.ERROR
            );

          if (workerCount === finishedWorkerCount) {
            resolve(result);
          }
        });
      }
    });
    return workerPromise;
  }

  private findProfilesToReconcile(profileList: string[]) {
    let profilesToReconcile;
    if (profileList.length > 0) {
      profilesToReconcile = [];
      profileList.forEach((profile) => {
        METADATA_INFO.Profile.files.forEach((file) => {
          if (path.basename(file) === profile) {
            profilesToReconcile.push(file);
          }
        });
      });
    } else {
      profilesToReconcile = METADATA_INFO.Profile.files;
    }
    return profilesToReconcile;
  }

  private fetchMetadataFilesFromAllPackageDirectories(srcFolders: string[]) {
    let metadataFiles = new MetadataFiles();
    srcFolders.forEach((srcFolder) => {
      let normalizedPath = path.join(process.cwd(), srcFolder);
      metadataFiles.loadComponents(normalizedPath);
    });
    return metadataFiles;
  }

  private createDestinationFolder(destFolder: string) {
    if (!_.isNil(destFolder)) {
      FileUtils.mkDirByPathSync(destFolder);
    }
  }
}
