import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "../css/tokens.css";
import { detectDevice, applyDevice } from "./device.js";
import { observeIcons } from "./icons.js";

const device = await detectDevice();
await applyDevice(device);
observeIcons();
await import("./app.js");
