'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';

export interface QRScannerProps {
  onScan: (data: string) => void;
  onError?: (error: Error) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScan, onError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const stopScanning = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setScanning(false);
  }, [stream]);

  const tick = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !scanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA && context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        onScan(code.data);
        stopScanning();
        return;
      }
    }

    requestAnimationFrame(tick);
  }, [scanning, onScan, stopScanning]);

  const startScanning = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setScanning(true);
        requestAnimationFrame(tick);
      }
    } catch (error) {
      onError?.(error as Error);
    }
  }, [onError, tick]);

  useEffect(() => {
    startScanning();
    return () => stopScanning();
  }, [startScanning, stopScanning]);

  return (
    <div className="relative w-full max-w-md mx-auto">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full rounded-lg"
      />
      <canvas ref={canvasRef} className="hidden" />
      <div className="absolute inset-0 border-4 border-primary-500 rounded-lg pointer-events-none">
        <div className="absolute inset-0 border-2 border-white m-8 rounded-lg" />
      </div>
      {scanning && (
        <div className="absolute bottom-4 left-0 right-0 text-center">
          <p className="bg-black/70 text-white px-4 py-2 rounded-full inline-block">
            Scanning for QR code...
          </p>
        </div>
      )}
    </div>
  );
};
