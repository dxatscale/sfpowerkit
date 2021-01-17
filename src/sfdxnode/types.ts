export class SfdxApi {
  [key: string]: any;
}

export class NsApi {
  [key: string]: any;
}

export interface SfdxNamespace {
  commandsDir: string;
  namespace: string;
}

export type Flags = {
  [key: string]: string | boolean | number | undefined | null;
};

export type Opts = string | string[];

export interface SfdxCommandDefinition {
  commandId: string;
  commandName: string;
  commandFile: string;
}

export interface SfdxNodeMessage {
  commandId: string;
  commandName: string;
  commandFile: string;
  flags: Flags;
  opts: Opts;
}

export interface SfdxNodeError {
  message: string;
  stack?: string;
}

export type CreateCommandFunc = (
  commandId: string,
  commandName: string,
  commandFile: string
) => (flags: Flags, opts: Opts) => Promise<any>;
