export default interface soPoolConfigSchema {
    oneOf: Object[];
    pool: object;
    script_file_path: string;
    config_file_path: string;
    expiry: number;
    tag: string;
    }
