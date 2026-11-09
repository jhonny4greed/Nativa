import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "../css/tokens.css";
import { animate, stagger } from "animejs";
import { detectDevice, applyDevice } from "./device.js";
import { observeIcons, mountIcons } from "./icons.js";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function splitTitle() {
  const title = document.querySelector("[data-split]");
  if (!title) return [];
  const words = title.textContent.trim().split(/\s+/);
  title.textContent = "";
  title.setAttribute("aria-label", words.join(" "));
  return words.map((word, i) => {
    const span = document.createElement("span");
    span.className = "w";
    span.textContent = word + (i < words.length - 1 ? "\u00a0" : "");
    span.setAttribute("aria-hidden", "true");
    title.append(span);
    return span;
  });
}

function heroIntro() {
  const words = splitTitle();
  const reveals = [...document.querySelectorAll(".hero-content [data-reveal]")];
  if (reduceMotion) {
    words.forEach(w => { w.style.opacity = 1; w.style.transform = "none"; });
    reveals.forEach(el => el.classList.add("is-in"));
    return;
  }
  animate(words, { opacity: [0, 1], translateY: ["0.4em", 0], rotate: [2, 0], duration: 900, delay: stagger(70, { start: 150 }), ease: "outExpo" });
  reveals.forEach(el => el.classList.add("is-in"));
  reveals.forEach((el, i) => { el.style.transitionDelay = `${400 + i * 120}ms`; });
}

function revealOnScroll() {
  const items = [...document.querySelectorAll("[data-reveal]:not(.hero-content [data-reveal])")];
  if (!("IntersectionObserver" in window) || reduceMotion) { items.forEach(el => el.classList.add("is-in")); return; }
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const siblings = [...el.parentElement.children].filter(c => c.hasAttribute("data-reveal"));
      el.style.transitionDelay = `${Math.min(siblings.indexOf(el), 5) * 90}ms`;
      el.classList.add("is-in");
      io.unobserve(el);
    });
  }, { rootMargin: "0px 0px -12% 0px", threshold: 0.1 });
  items.forEach(el => io.observe(el));
}

function counters() {
  const els = [...document.querySelectorAll("[data-count]")];
  if (!els.length) return;
  const run = el => {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || "";
    if (reduceMotion) { el.textContent = target + suffix; return; }
    const state = { v: 0 };
    animate(state, { v: target, duration: 1400, ease: "outCubic", delay: 600, onUpdate: () => { el.textContent = Math.round(state.v) + suffix; } });
  };
  els.forEach(run);
}

function parallax() {
  const layers = [...document.querySelectorAll("[data-parallax]")];
  if (!layers.length || reduceMotion) return;
  let ticking = false;
  const update = () => {
    const vh = innerHeight;
    layers.forEach(el => {
      const rect = el.parentElement.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > vh) return;
      const progress = (rect.top + rect.height / 2 - vh / 2) / vh;
      el.style.setProperty("--py", `${(-progress * Number(el.dataset.parallax) * 100).toFixed(1)}px`);
    });
    ticking = false;
  };
  addEventListener("scroll", () => { if (!ticking) { requestAnimationFrame(update); ticking = true; } }, { passive: true });
  update();
}

function header() {
  const el = document.querySelector("[data-header]");
  const menuBtn = document.querySelector(".lp-menu");
  const menu = document.getElementById("lp-mobile-menu");
  const onScroll = () => el.classList.toggle("is-scrolled", scrollY > 24);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  menuBtn?.addEventListener("click", () => {
    const open = menu.hidden;
    menu.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
  });
  menu?.querySelectorAll("a").forEach(a => a.addEventListener("click", () => { menu.hidden = true; menuBtn.setAttribute("aria-expanded", "false"); }));
  const links = [...document.querySelectorAll(".lp-nav a")];
  const sections = links.map(a => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        links.forEach(a => a.classList.toggle("is-active", a.getAttribute("href") === `#${e.target.id}`));
      });
    }, { rootMargin: "-40% 0px -50% 0px" });
    sections.forEach(s => io.observe(s));
  }
}

function tilt(device) {
  if (device !== "desktop" || reduceMotion) return;
  document.querySelectorAll("[data-tilt]").forEach(card => {
    card.addEventListener("pointermove", e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg) translateY(-4px)`;
    });
    card.addEventListener("pointerleave", () => { card.style.transform = ""; });
  });
}

function fireflies(device) {
  const canvas = document.querySelector("[data-fireflies]");
  if (!canvas || reduceMotion) return;
  const ctx = canvas.getContext("2d");
  const count = device === "mobile" ? 28 : 60;
  let w, h, dots;
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dots = Array.from({ length: count }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 1 + Math.random() * 2.2, vx: (Math.random() - 0.5) * 0.25, vy: -0.1 - Math.random() * 0.25, p: Math.random() * Math.PI * 2, s: 0.8 + Math.random() * 1.4 }));
  };
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  const frame = t => {
    if (visible) {
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        d.x += d.vx; d.y += d.vy;
        if (d.y < -10) { d.y = h + 10; d.x = Math.random() * w; }
        if (d.x < -10) d.x = w + 10; else if (d.x > w + 10) d.x = -10;
        const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t / 900 * d.s + d.p));
        const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 5);
        g.addColorStop(0, `rgba(226, 240, 160, ${a})`);
        g.addColorStop(1, "rgba(226, 240, 160, 0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r * 5, 0, Math.PI * 2); ctx.fill();
      }
    }
    requestAnimationFrame(frame);
  };
  resize();
  addEventListener("resize", resize);
  requestAnimationFrame(frame);
}

function confettiOnCta() {
  const cta = document.querySelector("[data-confetti]");
  if (!cta || reduceMotion) return;
  cta.addEventListener("click", async e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const { default: confetti } = await import("canvas-confetti");
    const r = cta.getBoundingClientRect();
    confetti({ particleCount: 90, spread: 70, startVelocity: 38, origin: { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight }, colors: ["#c5df9b", "#e3c58d", "#4fa08a", "#f08a3c"], disableForReducedMotion: true });
    setTimeout(() => { location.href = cta.href; }, 520);
  });
}

function encaminharConvite() {
  const url = new URL(location.href);
  if (!url.searchParams.has("convite")) return false;
  location.replace(`./app.html${url.search}${url.hash}`);
  return true;
}

async function boot() {
  if (encaminharConvite()) return;
  const device = await detectDevice();
  await applyDevice(device);
  mountIcons();
  observeIcons();
  document.querySelector("[data-year]").textContent = String(new Date().getFullYear());
  header();
  heroIntro();
  revealOnScroll();
  counters();
  parallax();
  tilt(device);
  fireflies(device);
  confettiOnCta();
}

boot();
