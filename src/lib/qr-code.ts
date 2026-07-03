import "server-only";

import QRCode from "qrcode";

export async function createQrCodeDataUrl(value: string, width = 164) {
  return QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 1,
    width,
    color: {
      dark: "#0b1638",
      light: "#ffffff",
    },
  });
}
