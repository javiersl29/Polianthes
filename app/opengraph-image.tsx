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
          position: "relative"
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            background: "radial-gradient(circle at 50% 40%, rgba(212,175,55,0.25) 0%, rgba(212,175,55,0) 60%)"
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20
          }}
        >
          <div
            style={{
              fontSize: 130,
              fontWeight: 400,
              fontStyle: "italic",
              color: "#d4af37",
              letterSpacing: "-4px",
              lineHeight: 1,
              display: "flex"
            }}
          >
            Polianthes
          </div>
          <div
            style={{
              fontSize: 32,
              color: "#f5f5f5",
              fontWeight: 300,
              letterSpacing: "2px",
              display: "flex"
            }}
          >
            Perfumes de inspiración
          </div>
          <div
            style={{
              marginTop: 30,
              padding: "14px 32px",
              border: "1px solid rgba(212,175,55,0.5)",
              borderRadius: 999,
              fontSize: 22,
              color: "#d4af37",
              display: "flex"
            }}
          >
            Decodificador con IA · 146 fragancias
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            fontSize: 18,
            color: "rgba(255,255,255,0.5)",
            letterSpacing: "4px"
          }}
        >
          POLIANTHES.SHOP
        </div>
      </div>
    ),
    { ...size }
  );
}
