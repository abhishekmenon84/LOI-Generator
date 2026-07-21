import JSZip from "jszip";

// Bundles multiple named file buffers into a single .zip archive buffer.
// files: Array<{ name: string, buffer: Buffer }>
export async function buildZip(files) {
  const zip = new JSZip();
  files.forEach(({ name, buffer }) => {
    zip.file(name, buffer);
  });
  return zip.generateAsync({ type: "nodebuffer" });
}
