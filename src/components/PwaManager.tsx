import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { assinarPwaInstall, ehIos, estaInstalado, getPromptDisponivel, instalarAgora } from "../lib/pwaInstall";

// BIO — PWA: registro do service worker, convite à instalação e aviso de
// atualização. O evento de instalação em si é capturado em ../lib/pwaInstall
// (escopo de módulo) — este componente só reage a ele. Se o usuário fechar o
// banner, ainda dá para instalar depois pela página /instalar-app (link sempre
// visível no rodapé), sem depender do navegador disparar o prompt de novo.

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
  const [temPrompt, setTemPrompt] = useState(false);
  const [mostrarIos, setMostrarIos] = useState(false);
  const [temAtualizacao, setTemAtualizacao] = useState(false);

  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      const jaControlado = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.register("/sw.js").catch(() => {});
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (jaControlado) setTemAtualizacao(true);
      });
    }

    if (estaInstalado() || dispensadoRecentemente()) return;

    setTemPrompt(!!getPromptDisponivel());
    if (ehIos()) setMostrarIos(true);

    return assinarPwaInstall(() => {
      setTemPrompt(!!getPromptDisponivel());
    });
  }, []);

  function dispensar() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* modo privado sem storage — só fecha nesta sessão */
    }
    setTemPrompt(false);
    setMostrarIos(false);
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

  if (temPrompt) {
    return (
      <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-[420px] rounded-[12px] border border-line bg-surface p-4 shadow-lg">
        <p className="font-display text-[15px] font-bold text-ink">Instale o BIO no seu celular</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
          Acesso às vagas com um toque, direto da tela inicial.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={async () => {
              const aceitou = await instalarAgora();
              if (!aceitou) dispensar();
            }}
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
        <p className="mt-2.5 text-[11.5px] text-ink-faint">
          Mudou de ideia depois? Instale quando quiser em{" "}
          <Link to="/instalar-app" className="underline underline-offset-2 hover:text-mata-deep">
            biooportunidades.org/instalar-app
          </Link>
          .
        </p>
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
        <div className="mt-3 flex gap-2">
          <Link
            to="/instalar-app"
            onClick={dispensar}
            className="flex-1 rounded-[9px] bg-mata px-4 py-2.5 text-center text-[13.5px] font-bold text-white hover:bg-mata-deep"
          >
            Ver passo a passo
          </Link>
          <button
            onClick={dispensar}
            className="rounded-[9px] border border-line-strong px-4 py-2.5 text-[13.5px] font-bold text-ink-soft hover:border-mata hover:text-mata"
          >
            Entendi
          </button>
        </div>
      </div>
    );
  }

  return null;
}
