import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type HostQrCodeProps = {
  roomId: string;
};

function HostQrCode({ roomId }: HostQrCodeProps) {
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchTunnelUrl() {
      try {
        const response = await fetch("/api/tunnel", {
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Could not retrieve tunnel URL");
        }

        const data = await response.json();

        if (!cancelled) {
          setPublicUrl(data.publicUrl ?? null);
        }
      } catch {
        if (!cancelled) {
          setPublicUrl(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchTunnelUrl();

    const interval = setInterval(fetchTunnelUrl, 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const joinUrl = publicUrl
    ? new URL(
        `/join/${encodeURIComponent(roomId.trim())}`,
        publicUrl,
      ).toString()
    : null;

  return (
    <>
      <h1 className="app-display-title">Join this session</h1>

      {!roomId.trim() ? (
        <p>Create or enter a room ID to show its join QR code.</p>
      ) : loading ? (
        <p>Retrieving public session URL...</p>
      ) : joinUrl ? (
        <>
          <p className="mb-3">
            Scan this QR code to open the session.
          </p>

          <QRCodeSVG
            value={joinUrl}
            level="M"
            className="responsive-qr"
          />

          <p className="mt-3">{joinUrl}</p>
        </>
      ) : (
        <p>
          Public access is unavailable. Start the Cloudflare tunnel
          to enable guest access.
        </p>
      )}
    </>
  );
}

export default HostQrCode;