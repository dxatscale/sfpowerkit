import { Connection } from 'jsforce';
import { delay } from './delay';
import SFPLogger, {LoggerLevel } from '@dxatscale/sfp-logger';
import { SfdxError } from '@salesforce/core';

export async function checkRetrievalStatus(conn: Connection, retrievedId: string, isToBeLoggedToConsole = true) {
    let metadata_result;

    while (true) {
        await conn.metadata.checkRetrieveStatus(retrievedId, function (error, result) {
            if (error) {
                return new SfdxError(error.message);
            }
            metadata_result = result;
        });

        if (metadata_result.done === 'false') {
            if (isToBeLoggedToConsole) SFPLogger.log(`Polling for Retrieval Status`, LoggerLevel.INFO);
            await delay(5000);
        } else {
            //this.ux.logJson(metadata_result);
            break;
        }
    }
    return metadata_result;
}
