import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  const linkCls =
    "mono-caps text-[11px] text-ink-soft underline-offset-4 transition-colors hover:text-mata hover:underline";
  return (
    <footer className="mt-20 border-t border-line bg-surface-dim/50">
      <div className="mx-auto max-w-[680px] px-4 py-12">
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-6">
          <div>
            <span
              className="font-display text-2xl leading-none text-ink"
              style={{ fontWeight: 800, letterSpacing: "-0.02em" }}
            >
              BIO<span className="text-mata">.</span>
            </span>
            <p className="mt-2 max-w-[34ch] text-[13px] leading-relaxed text-ink-soft">
              Observatório Institucional de Oportunidades Ambientais — curadoria de
              vagas para quem estuda meio ambiente no Ceará.
            </p>
            <a
              href="https://portal.ifce.edu.br/cursos/fortaleza-tecnico-subsequente-meio-ambiente/"
              target="_blank"
              rel="noopener noreferrer"
              className="mono-caps mt-4 inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-mata-line bg-mata-tint px-4 py-2 text-[11px] text-mata-deep transition-colors hover:border-mata hover:bg-mata hover:text-white"
            >
              Conheça o curso técnico
              <span aria-hidden>↗</span>
            </a>
          </div>
          <nav aria-label="Links institucionais" className="flex flex-col gap-2.5">
            <Link to="/como-se-candidatar" className={linkCls}>Como se candidatar</Link>
            <Link to="/divulgar" className={linkCls}>Divulgue uma oportunidade</Link>
            <Link to="/politica-de-privacidade" className={linkCls}>Política de privacidade</Link>
          </nav>
        </div>

        <p className="mono-caps mt-10 text-[10.5px] text-ink-faint">Aviso institucional</p>
        <p className="mt-2 max-w-[64ch] text-[13px] leading-relaxed text-ink-soft">
          As oportunidades são divulgadas como serviço de informação. O IFCE não conduz,
          não endossa e não se responsabiliza pelos processos seletivos, pelas condições
          dos vínculos nem pela idoneidade dos anunciantes — confira sempre a fonte oficial.
        </p>

        <p className="mono-caps mt-8 border-t border-line pt-6 text-[10.5px] text-ink-faint">
          IFCE · Campus Fortaleza · Curso Técnico em Meio Ambiente (EaD)
        </p>
      </div>
    </footer>
  );
}
