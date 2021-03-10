export function get18DigitSalesforceId(recordId) {
  if (recordId && recordId.length === 18) {
    return recordId;
  } else if (recordId && recordId.length === 15) {
    let addon = "";
    for (let block = 0; block < 3; block++) {
      let loop = 0;
      for (let position = 0; position < 5; position++) {
        let current = recordId.charAt(block * 5 + position);
        if (current >= "A" && current <= "Z") loop += 1 << position;
      }
      addon += "ABCDEFGHIJKLMNOPQRSTUVWXYZ012345".charAt(loop);
    }
    let convertedId = recordId + addon;
    return convertedId;
  } else {
    throw new Error(`Invalid Salesforce Id ${recordId}`);
  }
}
