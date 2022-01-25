import * as fs from "fs-extra";
import * as path from "path";

export function searchFilesInDirectory(
  dir: string,
  filter: string,
  ext: string
) {
  if (!fs.existsSync(dir)) {
    console.log(`Specified directory: ${dir} does not exist`);
    return;
  }

  let filesFound = [];

  // const files = fs.readdirSync(dir);
  const found = getFilesInDirectory(dir, ext);

  found.forEach(file => {
    const fileContent = fs.readFileSync(file);

    const regex = new RegExp(filter);

    if (regex.test(fileContent.toString())) {
      filesFound.push(file);
    }
  });
  return filesFound;
}

// Using recursion, we find every file with the desired extention, even if its deeply nested in subfolders.
export function getFilesInDirectory(dir: string, ext: string) {
  if (!fs.existsSync(dir)) {
    console.log(`Specified directory: ${dir} does not exist`);
    return;
  }

  let files = [];
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.lstatSync(filePath);

    // If we hit a directory, apply our function to that dir. If we hit a file, add it to the array of files.
    if (stat.isDirectory()) {
      const nestedFiles = getFilesInDirectory(filePath, ext);
      files = files.concat(nestedFiles);
    } else {
      if (path.extname(file) === ext) {
        files.push(filePath);
      }
    }
  });

  return files;
}
