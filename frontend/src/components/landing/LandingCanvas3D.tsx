import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  alpha: number;
  color: string;
}

export default function LandingCanvas3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Mouse tracking for 3D parallax
    let targetRotX = 0;
    let targetRotY = 0;
    let curRotX = 0;
    let curRotY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const normX = (e.clientX / width) * 2 - 1;
      const normY = (e.clientY / height) * 2 - 1;
      targetRotY = normX * 0.35;
      targetRotX = -normY * 0.25;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Generate 3D particle constellation
    const COUNT = Math.min(85, Math.floor(width / 18));
    const particles: Particle[] = [];
    const colors = ['#8B1A1A', '#DC2626', '#E11D48', '#38BDF8', '#818CF8', '#FFFFFF'];

    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: (Math.random() - 0.5) * 1600,
        y: (Math.random() - 0.5) * 1200,
        z: Math.random() * 800 + 200, // Depth from 200 to 1000
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        vz: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2.5 + 1.2,
        alpha: Math.random() * 0.6 + 0.3,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const FOCAL_LENGTH = 550;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Smooth interpolation of rotation
      curRotX += (targetRotX - curRotX) * 0.05;
      curRotY += (targetRotY - curRotY) * 0.05;

      const cosX = Math.cos(curRotX);
      const sinX = Math.sin(curRotX);
      const cosY = Math.cos(curRotY);
      const sinY = Math.sin(curRotY);

      // Update & project particles
      const projected: Array<{ px: number; py: number; scale: number; p: Particle }> = [];

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Drift
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        // Wrap around bounds
        if (p.x < -800) p.x = 800;
        if (p.x > 800) p.x = -800;
        if (p.y < -600) p.y = 600;
        if (p.y > 600) p.y = -600;
        if (p.z < 200) p.z = 1000;
        if (p.z > 1000) p.z = 200;

        // 3D rotation around Y then X
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.x * sinY + p.z * cosY;

        const y2 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;

        if (z2 <= 20) continue;

        const scale = FOCAL_LENGTH / (FOCAL_LENGTH + z2);
        const px = width / 2 + x1 * scale;
        const py = height / 2 + y2 * scale;

        projected.push({ px, py, scale, p });
      }

      // Draw connecting constellation lines
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const a = projected[i];
          const b = projected[j];
          const dx = a.px - b.px;
          const dy = a.py - b.py;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 110) {
            const lineAlpha = (1 - dist / 110) * 0.18 * ((a.scale + b.scale) / 2);
            ctx.strokeStyle = `rgba(220, 38, 38, ${lineAlpha})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(a.px, a.py);
            ctx.lineTo(b.px, b.py);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (let i = 0; i < projected.length; i++) {
        const { px, py, scale, p } = projected[i];
        const radius = p.size * scale;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha * scale;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();

        // Subtle glow around primary particles
        if (scale > 0.6) {
          ctx.beginPath();
          ctx.arc(px, py, radius * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = 0.08;
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      style={{ opacity: 0.85 }}
    />
  );
}
