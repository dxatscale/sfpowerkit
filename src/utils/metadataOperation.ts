import { Connection } from 'jsforce/connection';
import { LoggerLevel, Sfpowerkit } from '../sfpowerkit';
const retry = require('async-retry');

export default class MetadataOperation {
    constructor(private conn: Connection) {}

    public async getComponentsFromOrgUsingListMetadata(componentType: string) {
        const apiversion: string = await Sfpowerkit.getApiVersion();

        return await retry(
            async () => {
                try {
                    let items = await this.conn.metadata.list(
                        {
                            type: componentType,
                        },
                        apiversion
                    );

                    if (items === undefined || items === null) {
                        items = [];
                    }

                    if (!Array.isArray(items)) {
                        items = [items];
                    }

                    return items;
                } catch (error) {
                    throw new Error(`Unable to fetch list for ${componentType}`);
                }
            },
            {
                retries: 5,
                minTimeout: 2000,
                onRetry: (error) => {
                    Sfpowerkit.log(`Retrying Network call due to ${error.message}`, LoggerLevel.INFO);
                },
            }
        );
    }

    public async describeAnObject(componentType: string) {
        return await retry(
            async () => {
                try {
                    return await this.conn.sobject(componentType).describe();
                } catch (error) {
                    throw new Error(`Unable to describe  ${componentType}`);
                }
            },
            {
                retries: 5,
                minTimeout: 2000,
                onRetry: (error) => {
                    Sfpowerkit.log(`Retrying Network call due to ${error.message}`, LoggerLevel.INFO);
                },
            }
        );
    }
}
