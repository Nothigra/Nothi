import { useEffect, useRef } from 'react';
import Lenis from 'lenis';
import { isNativeApp } from '../../lib/native';

/*
 * The Nothi Labs background behind every page: a few soft gradients of the look's colours with film grain
 * (CSS, .nl-bg), and a halftone dot pattern drawn here, recoloured for the look and slightly blurred.
 * Also starts, once for the whole site: smooth scrolling (Lenis, not in the phone app), the reveal of
 * [data-reveal] / .nl-words elements as they scroll into view, and remembers where the visitor last clicked
 * (the new look opens in a circle from there).
 */
export default function GlassBackground() {
  const cv = useRef(null);

  useEffect(() => {
    const canvas = cv.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0;

    function draw() {
      if (!canvas) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth; H = Math.round(window.innerHeight * 1.12);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      const c = canvas.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
      c.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--nl-dots').trim() || '#A8D1F4';
      const step = W < 700 ? 5 : 6;
      for (let y = step / 2; y < H; y += step) {
        for (let x = step / 2; x < W; x += step) {
          // folds: long diagonal waves bent by a slower wave
          const u = (x * 0.55 + y) / 95 + 2.2 * Math.sin((x * 0.35 - y * 0.5) / 170) + 0.8 * Math.sin(y / 230);
          let v = 0.5 + 0.5 * Math.sin(u);
          v *= 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(y / 380 - x / 520 + 1.3));
          v = Math.pow(Math.max(0, v), 2.2);
          // calmer in the middle, where the content sits
          const qx = (x - W * 0.5) / (W * 0.34), qy = (y - H * 0.45) / (H * 0.5);
          v *= 1 - 0.7 * Math.exp(-(qx * qx + qy * qy));
          const r = v * step * 0.46;
          if (r < 0.35) continue;
          c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
        }
      }
    }
    draw();
    let t = 0;
    const onResize = () => { clearTimeout(t); t = setTimeout(draw, 200); };
    window.addEventListener('resize', onResize);
    // a new look: new colour for the dots
    const mo = new MutationObserver(() => requestAnimationFrame(draw));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

    // the dots drift a little with the scroll
    const onScroll = () => { if (canvas) canvas.style.transform = `translate3d(0, ${(-Math.sin(window.scrollY / 1500) * 4).toFixed(2)}vh, 0)`; };
    if (!reduce) window.addEventListener('scroll', onScroll, { passive: true });

    // where the visitor last clicked
    const onDown = (e) => { window.__nlPointer = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('pointerdown', onDown, { passive: true, capture: true });

    // smooth scrolling (computer only: phones keep their own)
    let lenis = null, raf = 0, bodyMo = null;
    if (!isNativeApp && !reduce) {
      lenis = new Lenis({ duration: 1.05, easing: (x) => 1 - Math.pow(1 - x, 4), smoothWheel: true, allowNestedScroll: true, anchors: true });
      window.__lenis = lenis;
      const loop = (time) => { lenis.raf(time); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
      // a dialog or a menu that locks the page also stops the smooth scroll
      const sync = () => {
        const locked = document.body.classList.contains('menu-open') || getComputedStyle(document.body).overflow === 'hidden' || getComputedStyle(document.documentElement).overflow === 'hidden';
        if (locked) lenis.stop(); else lenis.start();
      };
      bodyMo = new MutationObserver(sync);
      bodyMo.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
      bodyMo.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    }

    // reveal on scroll
    const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('nl-in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }) : null;
    const watch = (root) => {
      const els = root.querySelectorAll ? root.querySelectorAll('[data-reveal]:not(.nl-in), .nl-words:not(.nl-in)') : [];
      els.forEach((el) => { if (io) io.observe(el); else el.classList.add('nl-in'); });
    };
    watch(document);
    const domMo = new MutationObserver((list) => { for (const m of list) m.addedNodes.forEach((n) => { if (n.nodeType === 1) { if (n.matches && n.matches('[data-reveal], .nl-words')) io ? io.observe(n) : n.classList.add('nl-in'); watch(n); } }); });
    domMo.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('resize', onResize); window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointerdown', onDown, { capture: true });
      mo.disconnect(); domMo.disconnect(); if (bodyMo) bodyMo.disconnect(); if (io) io.disconnect();
      if (lenis) { cancelAnimationFrame(raf); lenis.destroy(); window.__lenis = null; }
    };
  }, []);

  return (
    <>
      <div className="nl-bg" aria-hidden="true"><i className="g1" /><i className="g2" /><i className="g3" /><i className="g4" /></div>
      <canvas ref={cv} className="nl-dots" aria-hidden="true" />
    </>
  );
}
