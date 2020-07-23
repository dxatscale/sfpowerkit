import * as DiffGenerators from "./diffgenerators/export";
import { isNullOrUndefined } from "util";

// Gets the xml files and passes them into diff generators
// Output : csv or json format
export default class DataModelSourceDiffImpl {
  constructor(
    public git,
    public baseline: string,
    public target: string,
    public packageDirectories: string[]
  ) {}

  private diffGenerators = {
    customfield: DiffGenerators.SourceDiffGenerator,
    recordtype: DiffGenerators.SourceDiffGenerator,
    businessprocess: DiffGenerators.SourceDiffGenerator
  };

  private filePattern = {
    customfield: "field",
    recordtype: "recordType",
    businessprocess: "businessProcess"
  };

  public async exec(): Promise<any> {
    const sourceDiffResult = [];
    for (let metadataType in this.diffGenerators) {
      let changedFiles: string[] = await this.getNameOfChangedFiles(
        this.git,
        this.baseline,
        this.target,
        metadataType
      );

      if (!isNullOrUndefined(this.packageDirectories)) {
        changedFiles = this.filterByPackageDirectory(
          changedFiles,
          this.packageDirectories
        );
      }

      let sourceDiffGenerator: DiffGenerators.SourceDiffGenerator = new this.diffGenerators[
        metadataType
      ](this.baseline, this.target);

      for (let file of changedFiles) {
        let fileRevFrom: string | void = await this.git
          .show([`${this.baseline}:${file}`])
          .catch(err => {});

        let fileRevTo: string | void = await this.git
          .show([`${this.target}:${file}`])
          .catch(err => {});

        let diff = await sourceDiffGenerator.compareRevisions(
          fileRevFrom,
          fileRevTo,
          file
        );

        // Aggregate individual file diffs in the source diff result
        if (diff) {
          sourceDiffResult.push(diff);
        }
      }
    }
    return sourceDiffResult;
  }

  private async getNameOfChangedFiles(
    git,
    baseline: string,
    target: string,
    metadataType: string
  ): Promise<string[]> {
    let gitDiffResult: string = await git.diff([
      baseline,
      target,
      "--name-only",
      "--",
      `**/objects/**/*${this.filePattern[metadataType]}-meta.xml`
    ]);

    let changedFiles: string[] = gitDiffResult.split("\n");
    changedFiles.pop();

    return changedFiles;
  }

  private filterByPackageDirectory(
    changedFiles: string[],
    packageDirectories: string[]
  ): string[] {
    let filteredChangedFiles = changedFiles.filter(file => {
      let isFileInPackageDir;
      packageDirectories.forEach(dir => {
        if (file.includes(dir)) isFileInPackageDir = true;
      });
      return isFileInPackageDir;
    });

    return filteredChangedFiles;
  }
}
