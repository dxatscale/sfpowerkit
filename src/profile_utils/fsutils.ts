import { SfPowerKit } from "../shared/sfpowerkit";

const fs = require("fs");
const path = require("path");
const _ = require("lodash");
const os = require("os");

export const PLUGIN_CACHE_FOLDER = os.homedir() + path.sep + "sfpowerkit";

export default class FileUtils {
  /**
   * Delete file or directories recursively from the project
   * @param deletedComponents Files or directories to delete
   */
  public static deleteComponents(deletedComponents: string[]) {
    deletedComponents.forEach(component => {
      if (fs.existsSync(component)) {
        if (fs.lstatSync(component).isDirectory()) {
          FileUtils.deleteFolderRecursive(component);
        } else {
          fs.unlinkSync(component);
        }
      }
    });
  }
  /**
   * Load all files from the given folder with the givet extension
   * @param folder the folder from which files wille be loaded
   * @param extension File extension to load.
   */
  public static getAllFilesSync(
    folder: string,
    extension: string = ".xml"
  ): string[] {
    let result: string[] = [];
    let pathExists = fs.existsSync(folder);
    let folderName = path.basename(folder);
    if (!pathExists) {
      SfPowerKit.ux.log("Folder not exists: " + folderName);
      return result;
    }
    let content: string[] = fs.readdirSync(folder);
    content.forEach(file => {
      let curFile = path.join(folder, file);
      let stats = fs.statSync(curFile);
      if (stats.isFile()) {
        if (extension.indexOf(path.extname(curFile)) != -1) {
          result.push(curFile);
        }
      } else if (stats.isDirectory()) {
        let files: string[] = this.getAllFilesSync(
          curFile,
          extension
        );
        result = _.concat(result, files);
      }
    });
    return result;
  }
  /**
   * Get the cache path for the given cache file name
   * @param fileName
   */
  public static getGlobalCachePath(fileName: string) {
    let homedir = os.homedir();
    let configDir = homedir + path.sep + PLUGIN_CACHE_FOLDER;
    if (!fs.existsSync(configDir)) {
      SfPowerKit.ux.log("Config folder does not exists");
      fs.mkdirSync(configDir);
    }
    return configDir + path.sep + fileName;
  }

  /**
   * Create a folder path recursively
   * @param targetDir
   * @param param1
   */
  public static mkDirByPathSync(
    targetDir: string,
    { isRelativeToScript = false } = {}
  ) {
    const sep = path.sep;
    const initDir = path.isAbsolute(targetDir) ? sep : "";
    const baseDir = isRelativeToScript ? __dirname : ".";

    targetDir.split(sep).reduce((parentDir, childDir) => {
      const curDir = path.resolve(baseDir, parentDir, childDir);
      try {
        fs.mkdirSync(curDir);
      } catch (err) {
        if (err.code !== "EEXIST" && err.code !== "EPERM") {
          throw err;
        }
      }
      return curDir;
    }, initDir);
  }
  /**
   * Get the file name withoud extension
   * @param filePath file path
   * @param extension extension
   */
  public static getFileNameWithoudExtension(
    filePath: string,
    extension?: string
  ): string {
    let fileParts = filePath.split(path.sep);
    let fileName = fileParts[fileParts.length - 1];
    if (extension) {
      fileName = fileName.substr(0, fileName.lastIndexOf(extension));
    } else {
      fileName = fileName.substr(0, fileName.indexOf("."));
    }
    return fileName;
  }

  /**
   * Copu folder recursively
   * @param src source folder to copy
   * @param dest destination folder
   */
  public static copyRecursiveSync(src, dest) {
    let exists = fs.existsSync(src);
    if (exists) {
      let stats = fs.statSync(src);
      let isDirectory = stats.isDirectory();
      if (isDirectory) {
        exists = fs.existsSync(dest);
        if (!exists) {
          fs.mkdirSync(dest);
        }
        fs.readdirSync(src).forEach(function(childItemName) {
          FileUtils.copyRecursiveSync(
            path.join(src, childItemName),
            path.join(dest, childItemName)
          );
        });
      } else {
        fs.copyFileSync(src, dest);
      }
    }
  }
  /**
   * Get path to a given folder base on the parent folder
   * @param src  Parent folder
   * @param foldername folder to build the path to
   */
  public static getFolderPath(src, foldername) {
    let exists = fs.existsSync(src);
    let toReturn = "";
    if (exists) {
      let stats = fs.statSync(src);
      let isDirectory = stats.isDirectory();
      if (isDirectory) {
        let childs = fs.readdirSync(src);
        for (let i = 0; i < childs.length; i++) {
          let childItemName = childs[i];
          if (childItemName === foldername) {
            toReturn = path.join(src, childItemName);
          } else {
            let childStat = fs.statSync(path.join(src, childItemName));
            if (childStat.isDirectory()) {
              toReturn = FileUtils.getFolderPath(
                path.join(src, childItemName),
                foldername
              );
            }
          }
          if (toReturn !== "") {
            break;
          }
        }
      }
    }
    return toReturn;
  }

  /**
   * Delete a folder and its content recursively
   * @param folder folder to delete
   */
  public static deleteFolderRecursive(folder) {
    if (fs.existsSync(folder)) {
      fs.readdirSync(folder).forEach(function(file, index) {
        let curPath = path.join(folder, file);
        if (fs.lstatSync(curPath).isDirectory()) {
          // recurse
          //console.log("Delete recursively");
          FileUtils.deleteFolderRecursive(curPath);
        } else {
          // delete file
          //console.log("Delete file "+ curPath);
          fs.unlinkSync(curPath);
        }
      });
      //console.log("delete folder "+ folder);
      fs.rmdirSync(folder);
    }
  }
}
