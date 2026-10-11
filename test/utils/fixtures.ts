import { randomBytes } from 'node:crypto';
import sharp from 'sharp';

const base = () =>
  sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: { r: 200, g: 50, b: 50 },
    },
  });

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

export interface Fixtures {
  png: Buffer;
  jpg: Buffer;
  webp: Buffer;
  gif: Buffer;
  /** text pretending to be a PNG */
  fake: Buffer;
  /** valid PNG signature, garbage body */
  corrupt: Buffer;
  /** over the 5 MB upload limit */
  big: Buffer;
  svg: Buffer;
}

export async function makeFixtures(): Promise<Fixtures> {
  return {
    png: await base().png().toBuffer(),
    jpg: await base().jpeg().toBuffer(),
    webp: await base().webp().toBuffer(),
    gif: await base().gif().toBuffer(),
    fake: Buffer.from('this is just a text file pretending to be a png\n'),
    corrupt: Buffer.concat([PNG_SIGNATURE, randomBytes(2048)]),
    big: Buffer.concat([PNG_SIGNATURE, randomBytes(6 * 1024 * 1024)]),
    svg: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    ),
  };
}
