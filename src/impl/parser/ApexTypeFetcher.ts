import * as fs from 'fs-extra';
const path = require('path');
const glob = require('glob');
import SFPLogger, {LoggerLevel} from '@dxatscale/sfp-logger';

import ApexTypeListener from './listeners/ApexTypeListener';

import {
    ApexLexer,
    ApexParser,
    ApexParserListener,
    ThrowingErrorListener,
    CaseInsensitiveInputStream,
    CommonTokenStream,
    ParseTreeWalker,
} from 'apex-parser';

export default class ApexTypeFetcher {
    /**
     * Get Apex type of cls files in a search directory.
     * Sorts files into classes, test classes and interfaces.
     * @param searchDir
     */
    public getApexTypeOfClsFiles(searchDir: string): ApexSortedByType {
        const apexSortedByType: ApexSortedByType = {
            class: [],
            testClass: [],
            interface: [],
            parseError: [],
        };

        let clsFiles: string[];
        if (fs.existsSync(searchDir)) {
            clsFiles = glob.sync(`**/*.cls`, {
                cwd: searchDir,
                absolute: true,
            });
        } else {
            throw new Error(`Search directory does not exist`);
        }

        for (let clsFile of clsFiles) {
            const clsPath = path.resolve(clsFile);
            let clsPayload: string = fs.readFileSync(clsPath, 'utf8');
            let fileDescriptor: FileDescriptor = {
                name: path.basename(clsFile, '.cls'),
                filepath: clsFile,
            };

            // Parse cls file
            let compilationUnitContext;
            try {
                let lexer = new ApexLexer(new CaseInsensitiveInputStream(clsPath, clsPayload));
                let tokens: CommonTokenStream = new CommonTokenStream(lexer);

                let parser = new ApexParser(tokens);
                parser.removeErrorListeners();
                parser.addErrorListener(new ThrowingErrorListener());

                compilationUnitContext = parser.compilationUnit();
            } catch (err) {
                SFPLogger.log(`Failed to parse ${clsFile}. Error occured ${JSON.stringify(err)} `, LoggerLevel.DEBUG);

                fileDescriptor['error'] = err;
                apexSortedByType['parseError'].push(fileDescriptor);
                continue;
            }

            let apexTypeListener: ApexTypeListener = new ApexTypeListener();

            // Walk parse tree to determine Apex type
            ParseTreeWalker.DEFAULT.walk(apexTypeListener as ApexParserListener, compilationUnitContext);

            let apexType = apexTypeListener.getApexType();

            if (apexType.class) {
                apexSortedByType['class'].push(fileDescriptor);
                if (apexType.testClass) {
                    apexSortedByType['testClass'].push(fileDescriptor);
                }
            } else if (apexType.interface) {
                apexSortedByType['interface'].push(fileDescriptor);
            } else {
                fileDescriptor['error'] = {
                    message: 'Unknown Apex Type',
                };
                apexSortedByType['parseError'].push(fileDescriptor);
            }
        }

        return apexSortedByType;
    }
}

export interface ApexSortedByType {
    class: FileDescriptor[];
    testClass: FileDescriptor[];
    interface: FileDescriptor[];
    parseError: FileDescriptor[];
}

interface FileDescriptor {
    name: string;
    filepath: string;
    error?: any;
}
