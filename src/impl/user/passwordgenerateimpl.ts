import _ = require("lodash");
import { Connection } from "@salesforce/core";
import queryApi from "../../utils/queryExecutor";
const axios = require("axios");
// tslint:disable-next-line:ordered-imports
// eslint-disable-next-line no-useless-escape

const PASSWORD_LENGTH = 10;
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const NUMBERS = "1234567890";
const SYMBOLS = [
  "!",
  "@",
  "#",
  "$",
  "%",
  "^",
  "&",
  "*",
  "(",
  ")",
  "_",
  "[",
  "]",
  "|",
  "-",
];
const ALL = [LOWER, UPPER, NUMBERS, SYMBOLS.join("")];

const rand = (len) => Math.floor(Math.random() * (len.length || len));

export default class Passwordgenerateimpl {
  public static async run(conn: Connection) {
    let queryUtil = new queryApi(conn);
    const query = `SELECT id FROM User WHERE username = '${conn.getUsername()}'`;

    let userRecord = await queryUtil.executeQuery(query, false);
    let pwd = this.generatePassword();
    let apiversion = await conn.retrieveMaxApiVersion();
    let passwordStatus = false;
    var endpoint = `${conn.instanceUrl}/services/data/v${apiversion}/sobjects/User/${userRecord[0].Id}/password`;
    let data = JSON.stringify({ NewPassword: pwd });

    await axios
      .post(endpoint, data, {
        headers: {
          Authorization: `Bearer ${conn.accessToken}`,
          "Content-Type": "application/json",
        },
      })
      .then((response) => {
        passwordStatus = response.status === 204;
      })
      .catch((error) => {
        passwordStatus = false;
      });

    let result = {
      username: conn.getUsername(),
      password: passwordStatus ? pwd : undefined,
    };

    return result;
  }
  static generatePassword(): string {
    // Fill an array with random characters from random requirement sets
    const pass = Array(PASSWORD_LENGTH - ALL.length)
      .fill(1)
      .map(() => {
        const set = ALL[rand(ALL)];
        return set[rand(set)];
      });

    // Add at least one from each required set to meet minimum requirements
    ALL.forEach((set) => {
      pass.push(set[rand(set)]);
    });

    return _.shuffle(pass).join("");
  }
}
