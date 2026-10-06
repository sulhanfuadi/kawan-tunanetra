/**
 * Intel HEX Parser Utility
 * Parses standard Intel HEX records (:llaaaatt[dd...]cc) into binary Uint8Array memory map.
 */
export interface HexRecord {
  data: Uint8Array;
  startAddress: number;
  totalBytes: number;
}

export function parseHex(hexString: string): HexRecord {
  const lines = hexString.split(/\r?\n/);
  // ATmega328P Flash memory is 32KB (32768 bytes)
  const memory = new Uint8Array(32768);
  memory.fill(0xff);

  let highAddress = 0;
  let minAddress = 32768;
  let maxAddress = 0;
  let hasData = false;

  for (let line of lines) {
    line = line.trim();
    if (!line.startsWith(":")) continue;

    const byteCount = parseInt(line.substring(1, 3), 16);
    const lowAddress = parseInt(line.substring(3, 7), 16);
    const recordType = parseInt(line.substring(7, 9), 16);

    if (recordType === 0x00) {
      // Data Record
      const fullAddress = highAddress + lowAddress;
      for (let i = 0; i < byteCount; i++) {
        const dataByte = parseInt(line.substring(9 + i * 2, 11 + i * 2), 16);
        const addr = fullAddress + i;
        if (addr < memory.length) {
          memory[addr] = dataByte;
          if (addr < minAddress) minAddress = addr;
          if (addr > maxAddress) maxAddress = addr;
          hasData = true;
        }
      }
    } else if (recordType === 0x01) {
      // End Of File Record
      break;
    } else if (recordType === 0x02) {
      // Extended Segment Address Record
      highAddress = parseInt(line.substring(9, 13), 16) << 4;
    } else if (recordType === 0x04) {
      // Extended Linear Address Record
      highAddress = parseInt(line.substring(9, 13), 16) << 16;
    }
  }

  if (!hasData) {
    throw new Error("File HEX tidak berisi record data yang valid.");
  }

  const length = maxAddress + 1;
  const slicedData = memory.slice(0, length);

  return {
    data: slicedData,
    startAddress: minAddress,
    totalBytes: length
  };
}
