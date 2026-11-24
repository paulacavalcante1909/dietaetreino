/**
 * Reduz a foto no aparelho antes do envio (máx. 1600 px, JPEG).
 * Economiza dados móveis e já descarta metadados (EXIF/GPS).
 * Se o navegador não conseguir decodificar (ex.: HEIC no Android), envia o original.
 */
export async function compressImage(file: File, max = 1600, quality = 0.85): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality))
    return blob ?? file
  } catch {
    return file
  }
}
