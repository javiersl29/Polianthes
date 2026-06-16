import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Polianthes — Perfumes de inspiración";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0c0c0c 0%, #1a1a1a 50%, #0c0c0c 100%)",
          color: "#f5f5f5",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden"
        }}
      >
        {/* Glow radial */}
        <div
          style={{
            position: "absolute",
            top: "20%",
            left: "50%",
            width: "700px",
            height: "700px",
            transform: "translate(-50%, -50%)",
            background: "radial-gradient(circle, rgba(212,175,55,0.20) 0%, rgba(212,175,55,0) 65%)",
            display: "flex"
          }}
        />
        {/* Patrón de hexágonos sutil */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)",
            backgroundSize: "48px 48px",
            display: "flex"
          }}
        />
        {/* Contenido */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px"
          }}
        >
          <div
            style={{
              fontSize: "120px",
              fontWeight: 400,
              fontStyle: "italic",
              color: "#d4af37",
              letterSpacing: "-0.04em",
              lineHeight: 1,
              display: "flex"
            }}
          >
            Polianthes
          </div>
          <div
            style={{
              fontSize: "28px",
              color: "#f5f5f5",
              fontWeight: 300,
              letterSpacing: "0.05em",
              display: "flex"
            }}
          >
            Perfumes de inspiración
          </div>
          <div
            style={{
              marginTop: "24px",
              padding: "12px 28px",
              border: "1px solid rgba(212,175,55,0.4)",
              borderRadius: "999px",
              fontSize: "18px",
              color: "#d4af37",
              display: "flex"
            }}
          >
            Decodificador con IA · 146 fragancias
          </div>
          <div
            style={{
              position: "absolute",
              top: "560px",
              left: 0,
              right: 0,
              textAlign: "center",
              fontSize: "16px",
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              display: "flex",
              justifyContent: "center"
            }}
          >
            polianthes.shop
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
