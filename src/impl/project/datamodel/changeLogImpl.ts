import DataModelSourceDiffImpl from "../../../impl/project/metadata/DataModelSourceDiffImpl";
import { ProgressBar } from "../../../ui/progressBar";
import { LoggerLevel } from "../../../sfpowerkit";

export default class ChangeLogImpl {
  constructor(
    public git,
    public baseline: string,
    public target: string,
    public packageDirectories: string[]
  ) {}

  public async exec(): Promise<any> {
    let changeLog = {};

    let progressBar = new ProgressBar().create(
      `Fetching change logs `,
      ` commits`,
      LoggerLevel.INFO
    );

    let options = {
      from: this.baseline,
      to: this.target,
      format: { hash: "%H", date: "%ai", author_name: "%aN" },
      file: "**/objects/*-meta.xml",
    };
    const gitLogResult = await this.git.log(options);

    progressBar.start(gitLogResult.all.length);
    for (let i = gitLogResult.all.length; i > 1; i--) {
      let revisionFrom = gitLogResult.all[i - 1].hash;
      let revisionTo = gitLogResult.all[i - 2].hash;
      let dataModelSourceDiffImpl = new DataModelSourceDiffImpl(
        this.git,
        revisionFrom,
        revisionTo,
        this.packageDirectories
      );

      let sourceDiffResult = await dataModelSourceDiffImpl.exec();
      if (sourceDiffResult && sourceDiffResult.length > 0) {
        sourceDiffResult.forEach((item) => {
          if (!changeLog[item.filepath]) {
            changeLog[item.filepath] = [];
          }
          item["date"] = gitLogResult.all[i - 2].date;
          item["author"] = gitLogResult.all[i - 2].author_name;
          changeLog[item.filepath].push(item);
        });
      }
      progressBar.increment(1);
    }
    progressBar.stop();

    return changeLog;
  }
}
