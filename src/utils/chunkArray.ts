export function chunkArray(perChunk: number, inputArray: any[]): Array<any> {
  let chunks = [],
    i = 0,
    n = inputArray.length;

  while (i < n) {
    chunks.push(inputArray.slice(i, (i += perChunk)));
  }

  return chunks;
}
