import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteLayout } from "../components/layout/SiteLayout";
import { VoltarPortal } from "../components/layout/VoltarPortal";
import { assinarPwaInstall, ehIos, estaInstalado, getPromptDisponivel, instalarAgora } from "../lib/pwaInstall";

export const Route = createFileRoute("/instalar-app")({
  head: () => ({
    meta: [
      { title: "Instale o app do BIO — BIO" },
      {
        name: "description",
        content: "Como instalar o BIO na tela de início do seu celular ou computador.",
      },
    ],
  }),
  component: InstalarApp,
});

function Passo({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mono-caps flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mata-tint text-[12px] font-bold text-mata-deep">
        {n}
      </span>
      <span className="text-[15px] leading-relaxed text-ink-soft">{children}</span>
    </li>
  );
}

function InstalarApp() {
  const [pronto, setPronto] = useState(false);
  const [instalado, setInstalado] = useState(false);
  const [temPrompt, setTemPrompt] = useState(false);
  const [ios, setIos] = useState(false);
  const [instalando, setInstalando] = useState(false);
  const [recusado, setRecusado] = useState(false);

  useEffect(() => {
    setInstalado(estaInstalado());
    setTemPrompt(!!getPromptDisponivel());
    setIos(ehIos());
    setPronto(true);
    return assinarPwaInstall(() => {
      setInstalado(estaInstalado());
      setTemPrompt(!!getPromptDisponivel());
    });
  }, []);

  async function handleInstalar() {
    setInstalando(true);
    const aceitou = await instalarAgora();
    setInstalando(false);
    if (!aceitou) setRecusado(true);
  }

  return (
    <SiteLayout>
      <article className="py-4 sm:py-6">
        <p className="mono-caps inline-flex items-center gap-2 text-[11px] text-mata-deep">
          <span aria-hidden className="inline-block h-[6px] w-[6px] rounded-full bg-mata" />
          App do BIO
        </p>
        <h1
          className="mt-3 font-display text-ink"
          style={{ fontSize: "clamp(26px, 6vw, 34px)", fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.01em" }}
        >
          Instale o BIO no seu aparelho
        </h1>
        <p className="mt-4 max-w-[60ch] text-[16px] leading-relaxed text-ink-soft">
          Instalar cria um ícone na sua tela de início — abre em tela cheia, como um
          app de verdade, sem precisar procurar o site no navegador toda vez.
        </p>

        {!pronto ? null : instalado ? (
          <div className="mt-8 rounded-[12px] border border-mata-line bg-mata-tint px-5 py-4">
            <p className="text-[15px] font-bold text-mata-deep">✓ Já instalado</p>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
              O BIO já está instalado neste aparelho.
            </p>
          </div>
        ) : temPrompt ? (
          <div className="mt-8 rounded-[12px] border border-line bg-surface p-5">
            <p className="text-[15px] font-bold text-ink">Pronto para instalar</p>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
              Um toque e o BIO aparece na sua tela de início.
            </p>
            <button
              onClick={handleInstalar}
              disabled={instalando}
              className="mt-4 w-full rounded-[9px] bg-mata px-5 py-3 text-[14.5px] font-bold text-white hover:bg-mata-deep disabled:opacity-60 sm:w-auto"
            >
              {instalando ? "Abrindo…" : "Instalar agora"}
            </button>
            {recusado && (
              <p className="mt-3 text-[13px] text-ink-faint">
                Tudo bem — pode voltar aqui quando quiser, não fica só nessa hora.
              </p>
            )}
          </div>
        ) : ios ? (
          <div className="mt-8 rounded-[12px] border border-line bg-surface p-5">
            <p className="text-[15px] font-bold text-ink">iPhone/iPad (Safari)</p>
            <ol className="mt-4 space-y-3">
              <Passo n={1}>
                Toque no ícone de <strong className="text-ink">Compartilhar</strong> (quadrado
                com uma seta para cima), na barra do navegador.
              </Passo>
              <Passo n={2}>
                Role a lista de opções e toque em{" "}
                <strong className="text-ink">"Adicionar à Tela de Início"</strong>.
              </Passo>
              <Passo n={3}>
                Toque em <strong className="text-ink">"Adicionar"</strong> no canto superior
                direito. Pronto — o ícone do BIO aparece na tela de início.
              </Passo>
            </ol>
            <p className="mt-4 text-[13px] text-ink-faint">
              Precisa ser pelo Safari — outros navegadores no iPhone não oferecem essa opção.
            </p>
          </div>
        ) : (
          <div className="mt-8 rounded-[12px] border border-line bg-surface p-5">
            <p className="text-[15px] font-bold text-ink">Instalação manual</p>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
              Seu navegador não ofereceu o botão automático agora (pode já ter sido
              dispensado antes, ou o navegador não suporta instalação de apps). Tente:
            </p>
            <ul className="mt-4 space-y-3">
              <Passo n={1}>
                <strong className="text-ink">Chrome ou Edge (computador ou Android):</strong>{" "}
                procure o ícone de instalação (⊕ ou uma tela com seta) do lado direito da
                barra de endereço, ou abra o menu <strong className="text-ink">⋮</strong> e
                toque em <strong className="text-ink">"Instalar app"</strong> ou{" "}
                <strong className="text-ink">"Adicionar à tela inicial"</strong>.
              </Passo>
              <Passo n={2}>
                <strong className="text-ink">Não achou a opção?</strong> Recarregue esta
                página primeiro — em alguns navegadores o botão só aparece depois do site
                carregar por completo.
              </Passo>
            </ul>
          </div>
        )}

        <VoltarPortal />
      </article>
    </SiteLayout>
  );
}
