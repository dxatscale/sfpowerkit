import { Sfpowerkit } from '../../../sfpowerkit';
import SFPLogger, {LoggerLevel } from '@dxatscale/sfp-logger';
import * as path from 'path';
import FileUtils from '../../../utils/fileutils';
import { retrieveMetadata } from '../../../utils/retrieveMetadata';
import { Connection, Org, SfdxProject } from '@salesforce/core';
import ProfileRetriever from '../../metadata/retriever/profileRetriever';
import { ComponentSet, MetadataResolver, registry, SourceComponent } from '@salesforce/source-deploy-retrieve';
import { META_XML_SUFFIX } from '@salesforce/source-deploy-retrieve/lib/src/common';
import Profile from '../../metadata/schema';
import MetadataRetriever from '../../metadata/retriever/metadataRetriever';

export default abstract class ProfileActions {
    protected conn: Connection;
    protected profileRetriever: ProfileRetriever;

    //TODO: Figure out from registry?
    profileFileExtension = '.' + registry.types.profile.suffix + META_XML_SUFFIX;

    public constructor(public org: Org) {
        if (this.org) {
            this.conn = this.org.getConnection();
            this.profileRetriever = new ProfileRetriever(org.getConnection());
        }
    }

    protected async getRemoteProfilesWithLocalStatus(
        profileNames: string[],
        packageDirectories?: string[]
    ): Promise<ProfileStatus> {
        let profilesStatus: ProfileStatus = {} as ProfileStatus;
        profilesStatus.added = [];
        profilesStatus.updated = [];
        profilesStatus.deleted = [];

        //Load all local profiles
        let localProfiles = await this.loadProfileFromPackageDirectories(packageDirectories);

        //generate default path for new profiles
        let profilePath = path.join(await Sfpowerkit.getDefaultFolder(), 'main', 'default', 'profiles');
        //create folder structure
        FileUtils.mkDirByPathSync(profilePath);

        // Query the profiles from org
        const remoteProfiles = await retrieveMetadata([{ type: 'Profile', folder: null }], this.conn);

        if (profileNames && profileNames.length > 0) {
            for (let i = 0; i < profileNames.length; i++) {
                let profileName = profileNames[i];
                let found = false;

                for (let j = 0; j < localProfiles.length; j++) {
                    if (profileName === localProfiles[j].name && remoteProfiles.includes(profileName)) {
                        profilesStatus.updated.push(localProfiles[j]);
                        found = true;
                    }
                }

                if (!found) {
                    for (let k = 0; k < remoteProfiles.length; k++) {
                        if (remoteProfiles[k] === profileName) {
                            let newProfilePath = path.join(profilePath, remoteProfiles[k] + this.profileFileExtension);
                            profilesStatus.added.push({ path: newProfilePath, name: profileName });
                            found = true;
                            break;
                        }
                    }
                }
                if (!found) {
                    profilesStatus.deleted.push({ name: profileName });
                    SFPLogger.log(`Profile ${profileName} not found in the org`, LoggerLevel.WARN);
                }
            }
        } else {
            SFPLogger.log('Load new profiles from server into the project directory', LoggerLevel.DEBUG);

            profilesStatus.deleted = localProfiles.filter((profile) => {
                return !remoteProfiles.includes(profile.name);
            });
            profilesStatus.updated = localProfiles.filter((profile) => {
                return remoteProfiles.includes(profile.name);
            });

            if (remoteProfiles && remoteProfiles.length > 0) {
                let newProfiles = remoteProfiles.filter((profileObj) => {
                    let found = false;
                    for (let i = 0; i < profilesStatus.updated.length; i++) {
                        let fileName = profilesStatus.updated[i].name;
                        //escape some caracters
                        let onlineName = profileObj.replace("'", '%27');
                        onlineName = onlineName.replace('/', '%2F');
                        if (onlineName === fileName) {
                            found = true;
                            break;
                        }
                    }
                    return !found;
                });
                if (newProfiles && newProfiles.length > 0) {
                    SFPLogger.log('New profiles founds', LoggerLevel.DEBUG);
                    for (let i = 0; i < newProfiles.length; i++) {
                        SFPLogger.log(newProfiles[i], LoggerLevel.DEBUG);
                        let newProfilePath = path.join(profilePath, newProfiles[i] + this.profileFileExtension);
                        profilesStatus.added.push({ path: newProfilePath, name: newProfiles[i] });
                    }
                } else {
                    SFPLogger.log('No new profile found, Updating existing profiles', LoggerLevel.INFO);
                }
            }
        }
        return profilesStatus;
    }

    protected async loadProfileFromPackageDirectories(packageDirectories?: string[]): Promise<ProfileSourceFile[]> {
        let resolver = new MetadataResolver();
        let profiles: SourceComponent[] = [];

        //If packageDirectories are not mentioned, fetch all package directories
        if (!packageDirectories || packageDirectories.length == 0) {
            const project = await SfdxProject.resolve();
            packageDirectories = new Array<string>();
            for (const packageDirectory of project.getPackageDirectories()) {
                packageDirectories.push(packageDirectory.path);
            }
        }

        //For each package directory, collect profiles
        for (const packageDirectory of packageDirectories) {
            profiles = profiles.concat(
                resolver.getComponentsFromPath(
                    packageDirectory,
                    new ComponentSet([{ fullName: '*', type: registry.types.profile.name }])
                )
            );
        }

        let profileSourceFile = profiles.map((elem) => {
            return { path: elem.xml, name: elem.name };
        });
        return profileSourceFile;
    }

    protected async reconcileTabs(profileObj: Profile): Promise<void> {
        let tabRetriever = new MetadataRetriever(this.org.getConnection(), registry.types.customtab.name);

        if (profileObj.tabVisibilities !== undefined) {
            if (!Array.isArray(profileObj.tabVisibilities)) {
                profileObj.tabVisibilities = [profileObj.tabVisibilities];
            }
            let validArray = [];
            for (let i = 0; i < profileObj.tabVisibilities.length; i++) {
                let cmpObj = profileObj.tabVisibilities[i];
                let exist = await tabRetriever.isComponentExistsInProjectDirectoryOrInOrg(cmpObj.tab);
                if (exist) {
                    validArray.push(cmpObj);
                }
            }
            Sfpowerkit.log(
                `Tab Visibilities reduced from ${profileObj.tabVisibilities.length}  to  ${validArray.length}`,
                LoggerLevel.DEBUG
            );
            profileObj.tabVisibilities = validArray;
        }
    }
}

export interface ProfileSourceFile {
    path?: string;
    name?: string;
}
export interface ProfileStatus {
    added: ProfileSourceFile[];
    deleted: ProfileSourceFile[];
    updated: ProfileSourceFile[];
}
