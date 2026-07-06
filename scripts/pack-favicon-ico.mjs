import { readFileSync, writeFileSync } from 'node:fs';

const entries = [
  { size: 16, path: 'public/img/icons/favicon-16x16.png' },
  { size: 32, path: 'public/img/icons/favicon-32x32.png' },
  { size: 64, path: 'public/favicon.png' },
];

const headerSize = 6;
const directorySize = entries.length * 16;
let imageOffset = headerSize + directorySize;

const images = entries.map((entry) => {
  const data = readFileSync(entry.path);
  const directory = Buffer.alloc(16);

  directory.writeUInt8(entry.size === 256 ? 0 : entry.size, 0);
  directory.writeUInt8(entry.size === 256 ? 0 : entry.size, 1);
  directory.writeUInt8(0, 2);
  directory.writeUInt8(0, 3);
  directory.writeUInt16LE(1, 4);
  directory.writeUInt16LE(32, 6);
  directory.writeUInt32LE(data.length, 8);
  directory.writeUInt32LE(imageOffset, 12);

  imageOffset += data.length;

  return { directory, data };
});

const header = Buffer.alloc(headerSize);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(entries.length, 4);

writeFileSync(
  'public/favicon.ico',
  Buffer.concat([
    header,
    ...images.map((image) => image.directory),
    ...images.map((image) => image.data),
  ])
);
