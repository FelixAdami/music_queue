import { QRCodeSVG } from "qrcode.react";
import "../style/HostQrCode.css";

type HostQrCodeProps = {
  roomId: string;
};

export default function HostQrCode({ roomId }: HostQrCodeProps) {
  const joinUrl = new URL(window.location.pathname, window.location.origin);
  joinUrl.searchParams.set("room", roomId.trim());

  return (
    <>
      <h1 className="my-3">Join this session</h1>
      {roomId.trim() ? (
        <>
          <p className="mb-3">Scan this QR code to open the session.</p>
          <QRCodeSVG
            value={joinUrl.toString()}
            level="M"
            className="responsive-qr"
          />
          {/*this could be removed depending on if we want to also display the link*/}
          <p className="mt-3">{joinUrl.toString()}</p>
        </>
      ) : (
        <p>Create or enter a room ID to show its join QR code.</p>
      )}
    </>
  );
}
