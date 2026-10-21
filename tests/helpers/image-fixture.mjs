import {deflateSync} from 'node:zlib';

const cache=new Map();
// Valid solid grayscale PNGs. They exercise file contracts, never visual quality.
export function pngFixture(width=3840,height=2160){
  const key=`${width}x${height}`;
  if(cache.has(key))return Buffer.from(cache.get(key));
  function chunk(type,data){
    const body=Buffer.concat([Buffer.from(type),data]),out=Buffer.alloc(body.length+8);
    out.writeUInt32BE(data.length);body.copy(out,4);
    let crc=0xffffffff;
    for(const value of body){crc^=value;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
    out.writeUInt32BE((crc^0xffffffff)>>>0,out.length-4);return out;
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;
  const bytes=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),
    chunk('IDAT',deflateSync(Buffer.alloc((width+1)*height))),chunk('IEND',Buffer.alloc(0))]);
  cache.set(key,bytes);return Buffer.from(bytes);
}
