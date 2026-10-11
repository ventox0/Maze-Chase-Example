import { BODY_HEAD_ANCHORS, HEAD_MOUNTS } from "../data/avatar-fitting.js";

export const AVATAR_SIZE = 192;
const PADDING = 6;

// Aksesuarın iç kafa dairesini karakterin kafa dairesiyle eşler.
// Tuvale sığdırma iki katmana aynı dönüşümü uygular; başlık tek başına küçültülmez.
export function avatarLayout(
  bodyWidth,
  bodyHeight,
  outfit = null,
  head = null,
  hatWidth = 0,
  hatHeight = 0,
) {
  const size = outfit ? 146 : 142;
  const scale = Math.min(size / bodyWidth, size / bodyHeight);
  const body = {
    x: (AVATAR_SIZE - bodyWidth * scale) / 2,
    y: 184 - bodyHeight * scale,
    width: bodyWidth * scale,
    height: bodyHeight * scale,
  };
  const [cx, cy, radius] =
    BODY_HEAD_ANCHORS[outfit || "normal"] || BODY_HEAD_ANCHORS.normal;
  const face = {
    x: body.x + body.width * cx,
    y: body.y + body.height * cy,
    radius: body.width * radius,
  };
  const mount = HEAD_MOUNTS[head];
  if (!mount || !hatWidth || !hatHeight) return { body, hat: null, face };
  const hatScale = face.radius / (hatWidth * mount[2]);
  const hat = {
    x: face.x - hatWidth * mount[0] * hatScale,
    y: face.y - hatHeight * mount[1] * hatScale,
    width: hatWidth * hatScale,
    height: hatHeight * hatScale,
  };
  const left = Math.min(body.x, hat.x),
    top = Math.min(body.y, hat.y);
  const right = Math.max(body.x + body.width, hat.x + hat.width),
    bottom = Math.max(body.y + body.height, hat.y + hat.height);
  const fit = Math.min(
    1,
    (AVATAR_SIZE - 2 * PADDING) / (right - left),
    (AVATAR_SIZE - 2 * PADDING) / (bottom - top),
  );
  const dx = (AVATAR_SIZE - (right - left) * fit) / 2 - left * fit;
  const dy = (AVATAR_SIZE - (bottom - top) * fit) / 2 - top * fit;
  const transform = (rect) => ({
    x: rect.x * fit + dx,
    y: rect.y * fit + dy,
    width: rect.width * fit,
    height: rect.height * fit,
  });
  return {
    body: transform(body),
    hat: transform(hat),
    face: {
      x: face.x * fit + dx,
      y: face.y * fit + dy,
      radius: face.radius * fit,
    },
  };
}
