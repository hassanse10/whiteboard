import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "tablo — Draw together, instantly.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#f8f7ff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden"
        }}
      >
        {/* Background decoration circles */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -120,
            width: 480,
            height: 480,
            borderRadius: "50%",
            background: "rgba(105, 101, 219, 0.08)",
            display: "flex"
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -80,
            left: -80,
            width: 320,
            height: 320,
            borderRadius: "50%",
            background: "rgba(105, 101, 219, 0.06)",
            display: "flex"
          }}
        />

        {/* Fake canvas preview */}
        <div
          style={{
            position: "absolute",
            top: 60,
            right: 80,
            width: 380,
            height: 260,
            background: "#fff",
            borderRadius: 16,
            border: "1.5px solid #e5e2ff",
            boxShadow: "0 8px 40px rgba(105,101,219,0.12)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}
        >
          {/* canvas top bar */}
          <div
            style={{
              height: 36,
              background: "#fafafa",
              borderBottom: "1px solid #f0eeff",
              display: "flex",
              alignItems: "center",
              padding: "0 14px",
              gap: 6
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57", display: "flex" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e", display: "flex" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840", display: "flex" }} />
            <div style={{ marginLeft: 12, fontSize: 11, color: "#999", display: "flex" }}>tablo.click/b/sunny-otter-42</div>
          </div>
          {/* canvas body */}
          <div style={{ flex: 1, position: "relative", display: "flex", padding: 16 }}>
            {/* sticky note */}
            <div
              style={{
                position: "absolute",
                top: 18,
                left: 16,
                width: 110,
                height: 76,
                background: "#fff9c4",
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 11,
                color: "#555",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                display: "flex"
              }}
            >
              ship the beta!
            </div>
            {/* rect */}
            <div
              style={{
                position: "absolute",
                top: 22,
                left: 145,
                width: 130,
                height: 60,
                border: "2px solid #6965db",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                color: "#6965db",
                fontWeight: 700
              }}
            >
              Sprint Goals
            </div>
            {/* cursor 1 */}
            <div
              style={{
                position: "absolute",
                bottom: 28,
                left: 80,
                display: "flex",
                alignItems: "flex-start",
                gap: 4
              }}
            >
              <div style={{ width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderBottom: "14px solid #6965db", display: "flex" }} />
              <div style={{ background: "#6965db", color: "#fff", fontSize: 9, padding: "2px 6px", borderRadius: 4, display: "flex" }}>Maya</div>
            </div>
            {/* cursor 2 */}
            <div
              style={{
                position: "absolute",
                bottom: 18,
                right: 30,
                display: "flex",
                alignItems: "flex-start",
                gap: 4
              }}
            >
              <div style={{ width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderBottom: "14px solid #f08c00", display: "flex" }} />
              <div style={{ background: "#f08c00", color: "#fff", fontSize: 9, padding: "2px 6px", borderRadius: 4, display: "flex" }}>Leo</div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            marginLeft: -200,
            marginTop: -20
          }}
        >
          {/* Logo / brand */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 28
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: "#6965db",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <svg width="26" height="26" viewBox="0 0 20 20" fill="none">
                <path d="M3 17l1-4 9-9 3 3-9 9-4 1z" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span style={{ fontSize: 32, fontWeight: 800, color: "#1a1835", letterSpacing: "-1px" }}>tablo</span>
          </div>

          <div
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: "#1a1835",
              letterSpacing: "-2px",
              lineHeight: 1.1,
              display: "flex",
              flexDirection: "column"
            }}
          >
            <span>Draw together,</span>
            <span style={{ color: "#6965db" }}>instantly.</span>
          </div>

          <div
            style={{
              marginTop: 20,
              fontSize: 22,
              color: "#666",
              maxWidth: 480,
              lineHeight: 1.4,
              display: "flex"
            }}
          >
            Free collaborative whiteboard. No sign-up, no setup — just open and sketch.
          </div>

          {/* Badges */}
          <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
            {["Free forever", "No sign-up", "Real-time sync"].map((label) => (
              <div
                key={label}
                style={{
                  background: "#eeecff",
                  color: "#6965db",
                  fontSize: 14,
                  fontWeight: 700,
                  padding: "6px 14px",
                  borderRadius: 20,
                  display: "flex"
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
