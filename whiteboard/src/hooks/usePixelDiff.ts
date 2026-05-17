export type BoundingBox = { x: number; y: number; w: number; h: number };

export function computeDiff(
  originalBase64: string,
  geminiBase64: string,
  threshold = 15
): Promise<{ diffBase64: string; boundingBox: BoundingBox }> {
  return new Promise((resolve) => {
    const origImg = new Image();
    const gemImg = new Image();

    origImg.onload = () => {
      gemImg.onload = () => {
        const W = origImg.width;
        const H = origImg.height;
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d")!;

        ctx.drawImage(origImg, 0, 0);
        const origData = ctx.getImageData(0, 0, W, H);

        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(gemImg, 0, 0, W, H);
        const gemData = ctx.getImageData(0, 0, W, H);

        const out = ctx.createImageData(W, H);
        let minX = W,
          minY = H,
          maxX = 0,
          maxY = 0;
        let hasChanges = false;

        for (let i = 0; i < origData.data.length; i += 4) {
          const dr = Math.abs(origData.data[i] - gemData.data[i]);
          const dg = Math.abs(origData.data[i + 1] - gemData.data[i + 1]);
          const db = Math.abs(origData.data[i + 2] - gemData.data[i + 2]);
          const delta = Math.max(dr, dg, db);

          if (delta >= threshold) {
            out.data[i] = gemData.data[i];
            out.data[i + 1] = gemData.data[i + 1];
            out.data[i + 2] = gemData.data[i + 2];
            out.data[i + 3] = 255;

            const px = (i / 4) % W;
            const py = Math.floor(i / 4 / W);
            minX = Math.min(minX, px);
            maxX = Math.max(maxX, px);
            minY = Math.min(minY, py);
            maxY = Math.max(maxY, py);
            hasChanges = true;
          } else {
            out.data[i + 3] = 0;
          }
        }

        ctx.putImageData(out, 0, 0);
        const diffBase64 = canvas.toDataURL("image/png");

        const PADDING = 40;
        const boundingBox: BoundingBox = hasChanges
          ? {
              x: minX - PADDING,
              y: minY - PADDING,
              w: maxX - minX + PADDING * 2,
              h: maxY - minY + PADDING * 2,
            }
          : { x: 0, y: 0, w: W, h: H };

        resolve({ diffBase64, boundingBox });
      };
      gemImg.src = geminiBase64;
    };
    origImg.src = originalBase64;
  });
}
