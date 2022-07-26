// tslint:disable-next-line:ordered-imports
// eslint-disable-next-line no-useless-escape
import { Connection, User, AuthInfo } from '@salesforce/core';
import queryApi from '../../utils/queryExecutor';
import SFPLogger, {LoggerLevel } from '@dxatscale/sfp-logger';

export default class Passwordgenerateimpl {
    public static async run(userName: string) {
        const query = `SELECT id FROM User WHERE username = '${userName}'`;

        const authInfo = await AuthInfo.create({ username: userName });
        const userConnection = await Connection.create({ authInfo: authInfo });
        let queryUtil = new queryApi(userConnection);
        let userRecord = await queryUtil.executeQuery(query, false);
        let passwordBuffer = User.generatePasswordUtf8();
        let pwd;

        await passwordBuffer.value(async (buffer: Buffer) => {
            try {
                pwd = buffer.toString('utf8');

                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore TODO: expose `soap` on Connection however appropriate
                const soap = userConnection.soap;
                await soap.setPassword(userRecord[0].Id, pwd);
            } catch (e) {
                pwd = undefined;
                if (e.message === 'INSUFFICIENT_ACCESS: Cannot set password for self') {
                    SFPLogger.log(
                        `${e.message}. Incase of scratch org, Add "features": ["EnableSetPasswordInApi"] in your project-scratch-def.json then create your scratch org.`,
                        LoggerLevel.WARN
                    );
                } else {
                    SFPLogger.log(`${e.message}`, LoggerLevel.WARN);
                }
            }
        });

        return {
            username: userName,
            password: pwd,
        };
    }
}
