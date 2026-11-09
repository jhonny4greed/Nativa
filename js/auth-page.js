import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "../css/tokens.css";
import "../css/auth-pages.css";
import { inicializarAutenticacao } from "./auth.js";

document.documentElement.dataset.deviceReady = "true";
void inicializarAutenticacao();
