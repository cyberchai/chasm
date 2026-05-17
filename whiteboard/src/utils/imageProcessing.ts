"use client";

export async function correctYellowedWhites(
  imageUrl: string,
  threshold = 240
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < data.data.length; i += 4) {
        const r = data.data[i];
        const g = data.data[i + 1];
        const b = data.data[i + 2];
        if (r >= threshold && g >= threshold && b >= threshold) {
          data.data[i] = 255;
          data.data[i + 1] = 255;
          data.data[i + 2] = 255;
        }
      }

      ctx.putImageData(data, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.src = imageUrl;
  });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
