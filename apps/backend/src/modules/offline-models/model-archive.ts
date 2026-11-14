import { createReadStream, createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { once } from 'node:events';
import { finished } from 'node:stream/promises';
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let crc = n;
  for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
/** ZIP STORE writer: weights stay on disk, and only the central directory is buffered. */
export async function writeModelArchive(target: string, files: Array<{ path: string; diskPath: string }>) {
  const output = createWriteStream(target);
  const completion = finished(output);
  void completion.catch(() => undefined);
  let offset = 0;
  const central: Buffer[] = [];
  const write = async (data: Buffer) => { if (!output.write(data)) await once(output, 'drain'); offset += data.length; };
  try {
    for (const file of files) {
      const size = (await stat(file.diskPath)).size;
      if (size > 1024 * 1024 * 600) throw new Error('模型单文件过大');
      const name = Buffer.from(file.path), start = offset;
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x808, 6); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0x21, 12);
      await write(local); await write(name);
      let crc = 0xffffffff;
      for await (const bytes of createReadStream(file.diskPath)) {
        const chunk = bytes as Buffer;
        for (const byte of chunk) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
        await write(chunk);
      }
      crc = (crc ^ 0xffffffff) >>> 0;
      const descriptor = Buffer.alloc(16);
      descriptor.writeUInt32LE(0x08074b50); descriptor.writeUInt32LE(crc, 4); descriptor.writeUInt32LE(size, 8); descriptor.writeUInt32LE(size, 12);
      await write(descriptor);
      const entry = Buffer.alloc(46);
      entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(0x808, 8);
      entry.writeUInt16LE(0x21, 14); entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(size, 20); entry.writeUInt32LE(size, 24); entry.writeUInt16LE(name.length, 28); entry.writeUInt32LE(start, 42);
      central.push(entry, name);
    }
    const centralStart = offset;
    for (const bytes of central) await write(bytes);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(offset - centralStart, 12); end.writeUInt32LE(centralStart, 16);
    await write(end); output.end(); await completion;
  } catch (error) { output.destroy(); await completion.catch(() => undefined); throw error; }
}
