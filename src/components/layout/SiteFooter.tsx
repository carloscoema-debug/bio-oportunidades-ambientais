export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface-dim/60">
      <div className="mx-auto max-w-[680px] px-4 py-10">
        <p className="mono-caps text-[10.5px] text-ink-faint">Aviso institucional</p>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
          O BIO é operado pela Coordenação do Curso Técnico em Meio Ambiente do
          IFCE Campus Fortaleza. As oportunidades são divulgadas como serviço de
          informação — o IFCE não conduz, não endossa e não se responsabiliza
          pelos processos seletivos, pelas condições dos vínculos nem pela
          idoneidade dos anunciantes.
        </p>

        <nav
          aria-label="Links institucionais"
          className="mt-6 flex flex-wrap gap-x-6 gap-y-3"
        >
          {[
            { href: "#", label: "Como se candidatar" },
            { href: "#", label: "Divulgue uma oportunidade" },
            { href: "#", label: "Política de privacidade" },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="mono-caps text-[11px] text-ink hover:text-mata"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <p className="mono-caps mt-8 text-[10.5px] text-ink-faint">
          IFCE · Campus Fortaleza · Curso Técnico em Meio Ambiente
        </p>
      </div>
    </footer>
  );
}
