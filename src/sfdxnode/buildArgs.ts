import { spawn, SpawnOptions } from "child_process";
import * as fs from "fs-extra";

export interface ObjectOption {
  [key: string]: string | boolean | number | undefined | null;
}

export type Option = ObjectOption | string;

export type Options = Option | Option[];

export type TransformOption = (opt: ObjectOption) => string[];

export interface ArgsObject {
  args: string[];
  cwd?: string;
  printCommand?: boolean;
  quiet?: boolean;
}

/**
 * Global command options.
 * Used for every execution on the command instance.
 * Can be overridden with first exec option.
 *
 * @see {Option}
 */
export interface CommandOptions {
  cwd?: string;
  printCommand?: boolean;
  quiet?: boolean;
}

/**
 * Create a new command.
 *
 * @param name of the command
 * @param options the command options
 */
export function cmd(name: string, options: CommandOptions = {}): Command {
  return new Command(name, options);
}

/**
 * Build a command as a string without executing it.
 *
 * Examples:
 *
 * build('npm', {version: true});
 *
 * build('java', '-version');
 *
 * @param name of the command
 * @param options the command options
 */
export function build(name: string, ...options: Options[]): string {
  return cmd(name).build(...options);
}

/**
 * Build command args as a string array without executing it.
 *
 * Examples:
 *
 * buildArgs({version: true});
 *
 * buildArgs('-version');
 *
 * @param options the command options
 */
export function buildArgs(...options: Options[]): string[] {
  return cmd("").buildArgs(...options);
}

/**
 * Execute a command.
 *
 * Examples:
 *
 * exec('npm', {version: true});
 *
 * exec('java', '-version');
 *
 * @param name of the command
 * @param options the command options
 */
export async function exec(name: string, ...options: Options[]): Promise<any> {
  return cmd(name).exec(...options);
}

/**
 * The command class.
 *
 * Includes methods build and exec.
 */
export class Command {
  public transform: TransformOption = defaultTransform;
  private readonly _name: string;
  private readonly _options: CommandOptions;

  constructor(name: string, options: CommandOptions = {}) {
    this._name = name;
    this._options = {
      cwd: process.cwd(),
      printCommand: true,
      quiet: false,
      ...options
    };
  }

  /**
   * Build the command as a string without executing it.
   *
   * Examples:
   *
   * cmd('npm').build({version: true});
   *
   * cmd('java').build('-version');
   *
   * @param options the command options
   */
  public build(...options: Options[]): string {
    const argsObj: ArgsObject = transformOptions(options, this.transform);
    return `${this._name} ${argsObj.args.join(" ")}`;
  }

  /**
   * Build command args as a string array without executing it.
   *
   * Examples:
   *
   * cmd('npm').buildArgs({version: true});
   *
   * cmd('java').buildArgs('-version');
   *
   * @param options the command options
   */
  public buildArgs(...options: Options[]): string[] {
    return transformOptions(options, this.transform).args;
  }

  /**
   * Execute the command.
   *
   * Examples:
   *
   * cmd('npm').exec({version: true});
   *
   * cmd('java').exec('-version');
   *
   * @param options the command options
   */
  public async exec(...options: Options[]): Promise<any> {
    const argsObj: ArgsObject = transformOptions(options, this.transform);
    const quiet = isBoolean(argsObj.quiet)
      ? argsObj.quiet
      : this._options.quiet;
    const printCommand = isBoolean(argsObj.printCommand)
      ? argsObj.printCommand
      : this._options.printCommand;
    const cwd = argsObj.cwd ? argsObj.cwd : this._options.cwd;
    const execCommand = `${this._name} ${argsObj.args.join(" ")}`;
    if (!quiet && printCommand) {
      console.log(`$ ${execCommand}`);
    }
    return spawnProcess(this._name, argsObj.args, quiet, cwd);
  }
}

const isBoolean = (it: any) => [true, false].includes(it);

function isPlainObject(o: any): boolean {
  return typeof o === "object" && o.constructor === Object;
}

async function spawnProcess(
  bin: string,
  args: string[],
  quiet: boolean,
  cwd: string
): Promise<any> {
  return new Promise((resolve, reject) => {
    const spawnOptions: SpawnOptions = {
      cwd
    };
    if (!quiet) {
      spawnOptions.stdio = "inherit";
    }
    const spawned = spawn(bin, args, spawnOptions);
    spawned.on("exit", exitCode => {
      exitCode === 0
        ? resolve()
        : reject(new Error(`Exit with code: ${exitCode}`));
    });
    spawned.on("error", (err: any) => {
      try {
        fs.statSync(cwd);
      } catch (e) {
        if (e.code === "ENOENT") {
          reject(`The specified cwd does not exist: ${cwd}`);
        }
      }
      reject(err);
    });
  });
}

function transformOptions(
  options: Options[],
  transform: TransformOption
): ArgsObject {
  const argsObj: ArgsObject = {
    args: []
  };
  options.forEach((opt: Options, idx: number) => {
    if (Array.isArray(opt)) {
      opt.forEach((it: Option) => {
        if (isPlainObject(it)) {
          argsObj.args.push(...defaultTransform(it as ObjectOption));
        } else if (typeof it === "string") {
          argsObj.args.push(it);
        }
      });
    } else if (isPlainObject(opt)) {
      if (idx === 0) {
        const transformed: ArgsObject = transformFirstOption(
          opt as ObjectOption,
          transform
        );
        argsObj.args.push(...transformed.args);
        argsObj.cwd = transformed.cwd;
        argsObj.printCommand = transformed.printCommand;
        argsObj.quiet = transformed.quiet;
      } else {
        argsObj.args.push(...defaultTransform(opt as ObjectOption));
      }
    } else if (typeof opt === "string") {
      argsObj.args.push(opt);
    }
  });
  return argsObj;
}

function transformFirstOption(
  opt: ObjectOption,
  transform: TransformOption
): ArgsObject {
  const argsObj: ArgsObject = {
    args: []
  };
  const filteredOption: Option = {};
  Object.entries(opt).forEach(([flagName, flagValue]) => {
    if (flagName === "quiet") {
      argsObj.quiet = flagValue === true;
    } else if (flagName === "printCommand") {
      argsObj.printCommand = flagValue === true;
    } else if (flagName === "cwd") {
      argsObj.cwd = flagValue.toString();
    } else {
      filteredOption[flagName] = flagValue;
    }
  });
  argsObj.args.push(...transform(filteredOption));
  return argsObj;
}

function defaultTransform(opt: ObjectOption): string[] {
  const args: string[] = [];
  Object.entries(opt).forEach(([flagName, flagValue]) => {
    if (isBoolean(flagValue)) {
      if (flagValue === true) {
        if (flagName.length === 1) {
          args.push(`-${flagName}`);
        } else {
          args.push(`--${flagName}`);
        }
      }
    } else if (flagValue) {
      if (flagName.length === 1) {
        args.push(`-${flagName}`, `${flagValue}`);
      } else {
        args.push(`--${flagName}`, `${flagValue}`);
      }
    }
  });
  return args;
}
