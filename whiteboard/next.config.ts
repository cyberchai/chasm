import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const whiteboardDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(whiteboardDir, ".."),
  transpilePackages: ["tldraw", "@tldraw/tldraw"],
};

export default nextConfig;
