import { Connection, DeployResult } from 'jsforce';
import { delay } from './delay';
import SFPLogger, {LoggerLevel } from '@dxatscale/sfp-logger';
import { SfdxError } from '@salesforce/core';

export async function checkDeploymentStatus(conn: Connection, retrievedId: string): Promise<DeployResult> {
    let metadata_result;

    while (true) {
        await conn.metadata.checkDeployStatus(retrievedId, true, function (error, result) {
            if (error) {
                throw new SfdxError(error.message);
            }
            metadata_result = result;
        });

        if (!metadata_result.done) {
            SFPLogger.log('Polling for Deployment Status', LoggerLevel.INFO);
            await delay(5000);
        } else {
            break;
        }
    }
    return metadata_result;
}
