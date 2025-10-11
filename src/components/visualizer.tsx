"use client";

import { useEffect, useRef } from "react";

interface VisualizerProps {
  microphone: {
    stream: MediaStream;
    audioContext: AudioContext;
  };
}

const Visualizer: React.FC<VisualizerProps> = ({ microphone }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode>();

  useEffect(() => {
    if (!microphone || !canvasRef.current) return;

    const { audioContext, stream } = microphone;
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;

    source.connect(analyser);
    analyserRef.current = analyser;

    const canvas = canvasRef.current;
    const canvasContext = canvas.getContext("2d");
    if (!canvasContext) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!analyserRef.current || !canvasRef.current) return;

      animationRef.current = requestAnimationFrame(draw);

      analyserRef.current.getByteTimeDomainData(dataArray);

      const width = canvas.width;
      const height = canvas.height;

      canvasContext.fillStyle = "rgb(0, 0, 0)";
      canvasContext.fillRect(0, 0, width, height);

      canvasContext.lineWidth = 2;
      canvasContext.strokeStyle = "rgb(34, 197, 94)";
      canvasContext.beginPath();

      const sliceWidth = (width * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          canvasContext.moveTo(x, y);
        } else {
          canvasContext.lineTo(x, y);
        }

        x += sliceWidth;
      }

      canvasContext.lineTo(width, height / 2);
      canvasContext.stroke();
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      source.disconnect();
      analyser.disconnect();
    };
  }, [microphone]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      width={1200}
      height={400}
    />
  );
};

export default Visualizer;
