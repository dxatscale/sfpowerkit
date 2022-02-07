"use strict";
const better_sqlite3 = require("better-sqlite3");


export default class SQLITEKeyValue {
  private sqlite;

  constructor(private path: string) {}

  public init() {
    // connect to sqlite
    this.sqlite = new better_sqlite3(this.path);
    // initialize kv table
    this.sqlite.exec(
      "CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)"
    );
  }

  public get(key: string): any {
    let q = "SELECT * FROM kv WHERE k = ?";

    let data = [];
    data = this.sqlite.prepare(q).all(key);

    // parse the values
    data = data.map((x) => {
      x.v = JSON.parse(x.v);
      return x;
    });

    if (data.length == 0) {
      return null;
    }

    return data[0].v;
  }

  public set(key: string, value: any) {
    let q =
      "INSERT INTO kv (k,v) VALUES (@k, @v) ON CONFLICT(k) DO UPDATE SET v=@v,timestamp=CURRENT_TIMESTAMP";
    const data = {
      k: key,
      v: JSON.stringify(value),
    };

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        this.sqlite.prepare(q).run(data);
        break;
      } catch (err) {
        continue;
      }
    }
  }
}
