import { Org } from '@salesforce/core';
import { SFPowerkit } from '../../../sfpowerkit';
import { parentPort, workerData } from 'worker_threads';
import ProfileReconcile from './profileReconcile';
 

export default class ReconcileWorker{
    public constructor(
        private targetOrg : string
      ) {
      }
    
    public async reconcile(profilesToReconcile:string[], destFolder){
        let org = await Org.create({ aliasOrUsername: this.targetOrg });

        let reconcileService = new ProfileReconcile(
            org,
            true
        );
        let result: string[] = [];
        let promises:Promise<any>[] = [];
        for (let count = 0; count < profilesToReconcile.length; count++) {
            let reconcilePromise = reconcileService.getReconcilePromise(profilesToReconcile[count], destFolder);
            promises.push(reconcilePromise);
        }
        return Promise.all(promises).then(values =>{
            for(let res of values){
                result.push(...res);
            }
            return result;
        });
    }
}

SFPowerkit.setLogLevel(workerData.loglevel, workerData.isJsonFormatEnabled);

let reconcileWorker = new ReconcileWorker(workerData.targetOrg);
reconcileWorker.reconcile(workerData.profileChunk,workerData.destFolder).then(result=>{
    parentPort.postMessage(result);
});
