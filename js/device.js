// Detecção de dispositivo: decide entre a experiência dedicada de desktop ou de mobile
// e carrega apenas a folha de estilo correspondente.
export const DEVICE_STORAGE_KEY = "nativa:device";
const MOBILE_MAX_WIDTH = 900;

export function classifyDevice({ override, uaMobile, uaType, coarsePointer, width }) {
  if (override === "mobile" || override === "desktop") return override;
  if (uaMobile === true) return "mobile";
  if (uaType === "mobile") return "mobile";
  if (uaType === "tablet") return coarsePointer && width < 1024 ? "mobile" : "desktop";
  if (uaMobile === false) return "desktop";
  return coarsePointer && width < MOBILE_MAX_WIDTH ? "mobile" : "desktop";
}

async function readUserAgentType() {
  try {
    const { UAParser } = await import("ua-parser-js");
    return new UAParser(navigator.userAgent).getDevice().type;
  } catch {
    return undefined;
  }
}

export async function detectDevice() {
  let override = null;
  try { override = localStorage.getItem(DEVICE_STORAGE_KEY); } catch {}
  return classifyDevice({
    override,
    uaMobile: navigator.userAgentData?.mobile,
    uaType: await readUserAgentType(),
    coarsePointer: matchMedia("(pointer: coarse)").matches,
    width: window.innerWidth
  });
}

const sheets = {
  mobile: () => import("../css/mobile.css"),
  desktop: () => import("../css/desktop.css")
};

export async function applyDevice(device) {
  document.documentElement.dataset.device = device;
  await sheets[device]();
  document.documentElement.dataset.deviceReady = "true";
  return device;
}

export function setDeviceOverride(device) {
  try {
    if (device) localStorage.setItem(DEVICE_STORAGE_KEY, device);
    else localStorage.removeItem(DEVICE_STORAGE_KEY);
  } catch {}
  location.reload();
}
