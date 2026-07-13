import { useEffect, useState } from "react";

// BIO — PWA: registro do service worker, convite à instalação e aviso de
// atualização. Android (Chrome/Edge) dispara `beforeinstallprompt` → botão de
// 1 toque; iOS nunca dispara → instrução manual (Compartilhar → Adicionar à
// Tela de Início). Quando um novo deploy assume (controllerchange), mostra o
// aviso "Nova versão" para o usuário recarregar — assim a versão instalada no
// celular nunca fica para trás.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "bio-pwa-install-dismissed";
const DISMISS_DIAS = 30;

function dispensadoRecentemente(): boolean {
  try {
    const t = localStorage.getItem(DISMISS_KEY);
    return !!t && Date.now() - Number(t) < DISMISS_DIAS * 864e5;
  } catch {
    return false;
  }
}

export function PwaManager() {
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [mostrarIos, setMostrarIos] = useState(false);
  const [temAtualizacao, setTemAtualizacao] = useState(false);

  useEffect(() => {
    // service worker só em produção — em dev o cache atrapalha o HMR
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      const jaControlado = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.register("/sw.js").catch(() => {});
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        // primeiro registro também dispara — só avisa se já havia um SW antes
        if (jaControlado) setTemAtualizacao(true);
      });
    }

    const instalado =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    if (instalado || dispensadoRecentemente()) return;

    const aoPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    const aoInstalar = () => setInstallEvt(null);
    window.addEventListener("beforeinstallprompt", aoPrompt);
    window.addEventListener("appinstalled", aoInstalar);

    const ua = navigator.userAgent;
    const ehIos =
      /iphone|ipad|ipod/i.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
    if (ehIos) setMostrarIos(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", aoPrompt);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);

  function dispensar() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* modo privado sem storage — só fecha nesta sessão */
    }
    setInstallEvt(null);
    setMostrarIos(false);
  }

  async function instalar() {
    if (!installEvt) return;
    await installEvt.prompt();
    const { outcome } = await installEvt.userChoice;
    if (outcome === "accepted") setInstallEvt(null);
    else dispensar();
  }

  if (temAtualizacao) {
    return (
      <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-[420px] rounded-[12px] border border-mata-line bg-surface p-4 shadow-lg">
        <p className="font-display text-[15px] font-bold text-ink">Nova versão do BIO disponível</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
          Recarregue para usar a versão mais recente.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 w-full rounded-[9px] bg-mata px-4 py-2.5 text-[13.5px] font-bold text-white hover:bg-mata-deep"
        >
          Atualizar agora
        </button>
      </div>
    );
  }

  if (installEvt) {
    return (
      <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-[420px] rounded-[12px] border border-line bg-surface p-4 shadow-lg">
        <p className="font-display text-[15px] font-bold text-ink">Instale o BIO no seu celular</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
          Acesso às vagas com um toque, direto da tela inicial.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={instalar}
            className="flex-1 rounded-[9px] bg-mata px-4 py-2.5 text-[13.5px] font-bold text-white hover:bg-mata-deep"
          >
            Instalar
          </button>
          <button
            onClick={dispensar}
            className="rounded-[9px] border border-line-strong px-4 py-2.5 text-[13.5px] font-bold text-ink-soft hover:border-mata hover:text-mata"
          >
            Agora não
          </button>
        </div>
      </div>
    );
  }

  if (mostrarIos) {
    return (
      <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-[420px] rounded-[12px] border border-line bg-surface p-4 shadow-lg">
        <p className="font-display text-[15px] font-bold text-ink">
          Instale o BIO na tela de início
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
          No Safari, toque em <strong className="text-ink">Compartilhar</strong> (quadrado com
          seta) e depois em <strong className="text-ink">“Adicionar à Tela de Início”</strong>.
        </p>
        <button
          onClick={dispensar}
          className="mt-3 w-full rounded-[9px] border border-line-strong px-4 py-2.5 text-[13.5px] font-bold text-ink-soft hover:border-mata hover:text-mata"
        >
          Entendi
        </button>
      </div>
    );
  }

  return null;
}
