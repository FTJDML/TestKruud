/**
 * Leest formaat en afmetingen uit de eerste bytes van een afbeelding. Bewust
 * zonder dependency: wij hoeven de afbeelding niet te decoderen, alleen te
 * kunnen vaststellen dat zij echt een afbeelding is en hoe groot zij is.
 *
 * Ondersteund: PNG, JPEG, GIF, WebP, AVIF/HEIF en SVG. Een bestand dat door
 * geen enkele parser wordt herkend, is voor ons niet leesbaar en dus ongeldig.
 */
export type ImageFormat = 'png' | 'jpeg' | 'gif' | 'webp' | 'avif' | 'svg'

export type ImageDimensions = {
  format: ImageFormat
  /** Null bij vectorafbeeldingen zonder vaste maat. */
  width: number | null
  height: number | null
}

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length > 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  )
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0)
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8)
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16)
}

function pngDimensions(bytes: Uint8Array): ImageDimensions {
  return { format: 'png', width: readUint32BE(bytes, 16), height: readUint32BE(bytes, 20) }
}

function jpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  let offset = 2
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = bytes[offset + 1] ?? 0
    // Start Of Frame; C4, C8 en CC zijn tabellen, niet een frame.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return {
        format: 'jpeg',
        height: readUint16BE(bytes, offset + 5),
        width: readUint16BE(bytes, offset + 7),
      }
    }
    const length = readUint16BE(bytes, offset + 2)
    if (length <= 0) return null
    offset += 2 + length
  }
  return null
}

function gifDimensions(bytes: Uint8Array): ImageDimensions {
  return { format: 'gif', width: readUint16LE(bytes, 6), height: readUint16LE(bytes, 8) }
}

function webpDimensions(bytes: Uint8Array): ImageDimensions | null {
  const chunk = String.fromCharCode(...bytes.slice(12, 16))
  if (chunk === 'VP8 ') {
    return {
      format: 'webp',
      width: readUint16LE(bytes, 26) & 0x3fff,
      height: readUint16LE(bytes, 28) & 0x3fff,
    }
  }
  if (chunk === 'VP8L') {
    // VP8L slaat breedte en hoogte op als 14 bits in een little-endian bitstream.
    const raw =
      (((bytes[21] ?? 0) |
        ((bytes[22] ?? 0) << 8) |
        ((bytes[23] ?? 0) << 16) |
        ((bytes[24] ?? 0) << 24)) >>>
        0) >>>
      0
    return { format: 'webp', width: (raw & 0x3fff) + 1, height: ((raw >>> 14) & 0x3fff) + 1 }
  }
  if (chunk === 'VP8X') {
    return {
      format: 'webp',
      width: readUint24LE(bytes, 24) + 1,
      height: readUint24LE(bytes, 27) + 1,
    }
  }
  return null
}

/** AVIF en HEIF: de afmetingen staan in de ispe-box van het ISOBMFF-bestand. */
function isobmffDimensions(bytes: Uint8Array): ImageDimensions | null {
  for (let offset = 0; offset + 12 < bytes.length; offset += 1) {
    if (
      bytes[offset] === 0x69 &&
      bytes[offset + 1] === 0x73 &&
      bytes[offset + 2] === 0x70 &&
      bytes[offset + 3] === 0x65
    ) {
      // 4 bytes versie/flags, dan breedte en hoogte.
      return {
        format: 'avif',
        width: readUint32BE(bytes, offset + 8),
        height: readUint32BE(bytes, offset + 12),
      }
    }
  }
  return null
}

function svgDimensions(text: string): ImageDimensions | null {
  if (!/<svg[\s>]/i.test(text)) return null
  const width = text.match(/\bwidth\s*=\s*"([\d.]+)/i)?.[1]
  const height = text.match(/\bheight\s*=\s*"([\d.]+)/i)?.[1]
  if (width && height) {
    return { format: 'svg', width: Math.round(Number(width)), height: Math.round(Number(height)) }
  }
  const viewBox = text.match(/viewBox\s*=\s*"([^"]+)"/i)?.[1]
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number)
    if (parts.length === 4 && parts.every((value) => Number.isFinite(value))) {
      return { format: 'svg', width: Math.round(parts[2]!), height: Math.round(parts[3]!) }
    }
  }
  // Geldige SVG zonder maat: vector, dus schaalbaar.
  return { format: 'svg', width: null, height: null }
}

/** Null wanneer de bytes geen herkenbare afbeelding zijn. */
export function readImageDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 16) return null
  if (isPng(bytes)) return pngDimensions(bytes)
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return jpegDimensions(bytes)
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return gifDimensions(bytes)

  const riff = String.fromCharCode(...bytes.slice(0, 4))
  const webp = String.fromCharCode(...bytes.slice(8, 12))
  if (riff === 'RIFF' && webp === 'WEBP') return webpDimensions(bytes)

  const brand = String.fromCharCode(...bytes.slice(4, 8))
  if (brand === 'ftyp') return isobmffDimensions(bytes)

  // SVG als laatste: tekstueel formaat, mag een BOM of commentaar vooraan hebben.
  const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 2048))
  return svgDimensions(head)
}
