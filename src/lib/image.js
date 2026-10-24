// Shrink a phone photo before upload (fast on a campground signal).
// Redrawing it on a canvas also strips the hidden EXIF data, including the
// GPS location many phones embed, so no photo carries where it was taken.
export async function resizeImage(file, max = 1600, quality = 0.82) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch {
    bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  }
  const w = bmp.width, h = bmp.height;
  const s = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * s); c.height = Math.round(h * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}
