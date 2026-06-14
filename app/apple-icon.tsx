import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 40,
          background: "#6965db",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <svg width="124" height="124" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M9 21.5C11 17 14 12 17.5 10.5C19.5 9.6 21 11 20 13C18.7 15.7 15.5 18 12.5 19.5"
            stroke="#fff"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="21.5" cy="21.5" r="1.6" fill="#fff" />
        </svg>
      </div>
    ),
    {
      ...size
    }
  );
}
