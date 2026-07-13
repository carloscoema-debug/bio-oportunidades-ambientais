// BIO — captura do evento de instalação do PWA em escopo de módulo (não de
// componente): o Chrome dispara `beforeinstallprompt` uma vez por carregamento
// de página, e o evento só pode ser usado 1x. Guardando aqui fora do React,
// o evento sobrevive ao usuário fechar o banner de instalação — assim um
// botão manual em outra página ainda consegue acionar o prompt nativo depois,
// sem precisar esperar o navegador disparar de novo.

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let capturado: BeforeInstallPromptEvent | null = null;
let jaInstalado = false;
const ouvintes = new Set<() => void>();

function notificar() {
  ouvintes.forEach((fn) => fn());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    capturado = e as BeforeInstallPromptEvent;
    notificar();
  });
  window.addEventListener("appinstalled", () => {
    capturado = null;
    jaInstalado = true;
    notificar();
  });
}

export function getPromptDisponivel(): BeforeInstallPromptEvent | null {
  return capturado;
}

export function estaInstalado(): boolean {
  if (jaInstalado) return true;
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export function ehIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
}

/** Dispara o prompt nativo de instalação. Retorna `true` se aceito. */
export async function instalarAgora(): Promise<boolean> {
  if (!capturado) return false;
  await capturado.prompt();
  const { outcome } = await capturado.userChoice;
  capturado = null; // o evento só serve para 1 uso
  notificar();
  return outcome === "accepted";
}

/** Assina mudanças (evento capturado / instalado). Retorna função de cancelar. */
export function assinarPwaInstall(fn: () => void): () => void {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}
