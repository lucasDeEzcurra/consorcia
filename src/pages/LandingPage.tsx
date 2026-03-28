import { Link } from "react-router-dom";
import {
  MessageSquare,
  FileText,
  BarChart3,
  Mail,
  ArrowRight,
  Building2,
  Camera,
  Send,
  CheckCircle2,
  ChevronRight,
  Smartphone,
  Shield,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

/* ─── Intersection Observer hook for scroll animations ─── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function FadeIn({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(32px)",
        transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

/* ─── Styles ─── */
const serif = { fontFamily: "'Instrument Serif', Georgia, serif" };
const sans = { fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" };

export function LandingPage() {
  return (
    <div style={sans} className="overflow-hidden">
      {/* ════════ NAV ════════ */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-[#0b1120]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500">
              <Building2 className="size-4 text-[#0b1120]" />
            </div>
            <span
              className="text-xl text-white font-semibold tracking-tight"
              style={serif}
            >
              Consorcia
            </span>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <a
              href="#features"
              className="text-sm text-slate-400 transition-colors hover:text-white"
            >
              Funciones
            </a>
            <a
              href="#how"
              className="text-sm text-slate-400 transition-colors hover:text-white"
            >
              Cómo funciona
            </a>
            <a
              href="#pricing"
              className="text-sm text-slate-400 transition-colors hover:text-white"
            >
              Precios
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm text-slate-300 transition-colors hover:text-white"
            >
              Iniciar sesión
            </Link>
            <Link
              to="/login"
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-[#0b1120] transition-all hover:bg-amber-400 hover:shadow-lg hover:shadow-amber-500/25"
            >
              Comenzar gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* ════════ HERO ════════ */}
      <section className="relative min-h-screen bg-[#0b1120] pt-16">
        {/* Background elements */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-amber-500/5 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-[400px] w-[600px] rounded-full bg-blue-500/5 blur-[100px]" />
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-6 pt-24 pb-20 text-center md:pt-32">
          {/* Badge */}
          <FadeIn>
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-sm text-amber-400">
              <Zap className="size-3.5" />
              La plataforma #1 para administradoras de consorcios
            </div>
          </FadeIn>

          {/* Headline */}
          <FadeIn delay={0.1}>
            <h1
              className="max-w-4xl text-5xl leading-[1.1] text-white md:text-7xl lg:text-8xl"
              style={serif}
            >
              Tus edificios.
              <br />
              <span className="text-amber-400">Tu control.</span>
              <br />
              <span className="italic text-slate-400">Sin papeles.</span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.2}>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-slate-400 md:text-xl">
              Consorcia conecta a tus supervisores por Telegram, organiza los
              trabajos de mantenimiento con fotos, y genera reportes
              profesionales con inteligencia artificial.{" "}
              <span className="text-slate-200">
                Todo en un solo lugar.
              </span>
            </p>
          </FadeIn>

          <FadeIn delay={0.3}>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
              <Link
                to="/login"
                className="group flex items-center gap-2 rounded-xl bg-amber-500 px-8 py-4 text-base font-semibold text-[#0b1120] transition-all hover:bg-amber-400 hover:shadow-2xl hover:shadow-amber-500/30"
              >
                Comenzar gratis
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="mailto:hola@consorcia.app"
                className="flex items-center gap-2 rounded-xl border border-slate-700 px-8 py-4 text-base font-medium text-slate-300 transition-all hover:border-slate-500 hover:text-white"
              >
                Contactanos
              </a>
            </div>
          </FadeIn>

          {/* Hero visual — simulated dashboard */}
          <FadeIn delay={0.45} className="mt-16 w-full max-w-4xl">
            <div className="relative">
              {/* Glow behind */}
              <div className="absolute -inset-4 rounded-2xl bg-gradient-to-b from-amber-500/20 via-transparent to-transparent blur-2xl" />
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#131b2e] shadow-2xl">
                {/* Mock browser bar */}
                <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="size-2.5 rounded-full bg-white/10" />
                    <div className="size-2.5 rounded-full bg-white/10" />
                    <div className="size-2.5 rounded-full bg-white/10" />
                  </div>
                  <div className="mx-auto flex h-6 w-64 items-center justify-center rounded-md bg-white/5 text-xs text-slate-500">
                    app.consorcia.com/dashboard
                  </div>
                </div>
                {/* Mock dashboard */}
                <div className="grid grid-cols-12 gap-0">
                  {/* Sidebar */}
                  <div className="col-span-3 border-r border-white/5 p-4">
                    <div className="mb-6 flex items-center gap-2">
                      <div className="size-6 rounded bg-amber-500" />
                      <span className="text-sm font-semibold text-white">
                        Consorcia
                      </span>
                    </div>
                    {["Dashboard", "Supervisores", "Edificios"].map(
                      (item, i) => (
                        <div
                          key={item}
                          className={`mb-1 rounded-lg px-3 py-2 text-xs ${
                            i === 0
                              ? "bg-white/10 text-white"
                              : "text-slate-500"
                          }`}
                        >
                          {item}
                        </div>
                      )
                    )}
                  </div>
                  {/* Content */}
                  <div className="col-span-9 p-6">
                    <div className="mb-4 text-sm font-semibold text-white">
                      Dashboard
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { n: "12", l: "Edificios" },
                        { n: "3", l: "Supervisores" },
                        { n: "8", l: "Pendientes" },
                        { n: "47", l: "Completados" },
                      ].map((c) => (
                        <div
                          key={c.l}
                          className="rounded-lg border border-white/5 bg-white/[0.03] p-3"
                        >
                          <div className="text-lg font-bold text-white">
                            {c.n}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {c.l}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Mock building rows */}
                    <div className="mt-4 space-y-2">
                      {[
                        "Edificio Libertador 1420",
                        "Torre Belgrano",
                        "Residencias del Parque",
                      ].map((b) => (
                        <div
                          key={b}
                          className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                        >
                          <span className="text-xs text-slate-300">{b}</span>
                          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-400">
                            3 pendientes
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ════════ STATS ════════ */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { value: "500+", label: "Edificios gestionados" },
            { value: "10,000+", label: "Trabajos reportados" },
            { value: "98%", label: "Satisfacción de clientes" },
          ].map((s, i) => (
            <FadeIn key={s.label} delay={i * 0.1}>
              <div className="flex flex-col items-center py-12 px-6">
                <span
                  className="text-4xl font-light text-slate-900 md:text-5xl"
                  style={serif}
                >
                  {s.value}
                </span>
                <span className="mt-2 text-sm text-slate-500">{s.label}</span>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ════════ FEATURES ════════ */}
      <section id="features" className="bg-white py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="text-center">
              <span className="text-sm font-semibold uppercase tracking-widest text-amber-600">
                Funciones
              </span>
              <h2
                className="mt-4 text-4xl text-slate-900 md:text-5xl"
                style={serif}
              >
                Todo lo que necesitás
                <br />
                <span className="italic text-slate-400">
                  para gestionar tus edificios
                </span>
              </h2>
            </div>
          </FadeIn>

          <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2">
            {[
              {
                icon: MessageSquare,
                color: "bg-green-500",
                title: "Telegram como canal principal",
                desc: "Tus supervisores reportan trabajos directamente desde Telegram. Mandan fotos, describen el problema, y todo queda registrado automáticamente. Sin apps, sin capacitación.",
                tag: "Telegram Bot",
              },
              {
                icon: FileText,
                color: "bg-amber-500",
                title: "Reportes generados con IA",
                desc: "A fin de mes, la inteligencia artificial genera un informe profesional con resumen ejecutivo, descripciones mejoradas y fotos organizadas. Listo para enviar.",
                tag: "Inteligencia Artificial",
              },
              {
                icon: BarChart3,
                color: "bg-blue-500",
                title: "Panel de control en tiempo real",
                desc: "Dashboard completo para ver todos los edificios, trabajos pendientes, supervisores activos y estado de reportes. Visibilidad total desde cualquier dispositivo.",
                tag: "Dashboard",
              },
              {
                icon: Mail,
                color: "bg-violet-500",
                title: "Envío directo a propietarios",
                desc: "Enviá el reporte PDF por email a todos los propietarios del edificio con un click. Asunto, mensaje y destinatarios editables antes de enviar.",
                tag: "Email",
              },
            ].map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.1}>
                <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 transition-all hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50">
                  <div className="absolute top-0 right-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-slate-50 transition-transform group-hover:scale-150" />
                  <div className="relative">
                    <div
                      className={`mb-6 inline-flex size-12 items-center justify-center rounded-xl ${f.color}`}
                    >
                      <f.icon className="size-5 text-white" />
                    </div>
                    <span className="mb-3 block text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                      {f.tag}
                    </span>
                    <h3
                      className="text-xl text-slate-900"
                      style={serif}
                    >
                      {f.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-500">
                      {f.desc}
                    </p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ HOW IT WORKS ════════ */}
      <section id="how" className="bg-[#0b1120] py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="text-center">
              <span className="text-sm font-semibold uppercase tracking-widest text-amber-400">
                Cómo funciona
              </span>
              <h2
                className="mt-4 text-4xl text-white md:text-5xl"
                style={serif}
              >
                Tres pasos.
                <br />
                <span className="italic text-slate-500">Sin complicaciones.</span>
              </h2>
            </div>
          </FadeIn>

          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                icon: Camera,
                title: "El supervisor reporta",
                desc: "Desde Telegram manda fotos del trabajo y una descripción corta. El sistema crea el registro automáticamente.",
              },
              {
                step: "02",
                icon: Smartphone,
                title: "Vos controlás todo",
                desc: "Desde el panel web ves cada edificio, cada trabajo, cada supervisor. Creás, editás, asignás y reasignás en tiempo real.",
              },
              {
                step: "03",
                icon: Send,
                title: "El reporte se envía solo",
                desc: "A fin de mes generás el informe con IA, lo revisás, y lo enviás por email a los propietarios. Un click.",
              },
            ].map((s, i) => (
              <FadeIn key={s.step} delay={i * 0.15}>
                <div className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-8 transition-all hover:border-amber-500/30 hover:bg-white/[0.05]">
                  <span
                    className="text-6xl font-light text-white/5 md:text-7xl"
                    style={serif}
                  >
                    {s.step}
                  </span>
                  <div className="mt-4 mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-amber-500/10">
                    <s.icon className="size-5 text-amber-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {s.desc}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ TELEGRAM DEMO ════════ */}
      <section className="bg-white py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-1 items-center gap-16 md:grid-cols-2">
            <FadeIn>
              <div>
                <span className="text-sm font-semibold uppercase tracking-widest text-green-600">
                  Telegram Bot
                </span>
                <h2
                  className="mt-4 text-4xl text-slate-900 md:text-5xl"
                  style={serif}
                >
                  Tu supervisor ya sabe
                  <br />
                  <span className="italic text-slate-400">usar Telegram.</span>
                </h2>
                <p className="mt-6 text-lg leading-relaxed text-slate-500">
                  No necesita descargar nada. No necesita capacitación.
                  Manda un mensaje, elige el edificio, saca fotos, y listo.
                  El trabajo queda registrado con fecha, fotos y descripción.
                </p>
                <div className="mt-8 space-y-4">
                  {[
                    "Identificación automática por número de teléfono",
                    "Fotos antes y después del trabajo",
                    "Registro de gastos paso a paso",
                    "Menú conversacional simple y claro",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-500" />
                      <span className="text-sm text-slate-600">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>

            {/* Phone mockup with chat */}
            <FadeIn delay={0.2}>
              <div className="flex justify-center">
                <div className="w-72 rounded-[2rem] border-4 border-slate-900 bg-[#ECE5DD] p-1 shadow-2xl">
                  {/* Phone header */}
                  <div className="rounded-t-[1.7rem] bg-[#075E54] px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                        C
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          Consorcia Bot
                        </p>
                        <p className="text-[10px] text-green-200">en línea</p>
                      </div>
                    </div>
                  </div>
                  {/* Chat messages */}
                  <div className="space-y-2 px-3 py-4" style={{ minHeight: 340 }}>
                    <ChatBubble from="bot">
                      🏢 *Seleccioná un edificio:*{"\n\n"}
                      1. Edificio Libertador{"\n"}
                      2. Torre Belgrano{"\n"}
                      3. Residencias del Parque
                    </ChatBubble>
                    <ChatBubble from="user">1</ChatBubble>
                    <ChatBubble from="bot">
                      📋 *Edificio Libertador*{"\n\n"}
                      1. Nuevo trabajo{"\n"}
                      2. Completar pendiente{"\n"}
                      3. Ver pendientes
                    </ChatBubble>
                    <ChatBubble from="user">1</ChatBubble>
                    <ChatBubble from="bot">
                      📸 Enviá las fotos del *ANTES*{"\n\n"}
                      Cuando termines, escribí *LISTO*
                    </ChatBubble>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ════════ PRICING ════════ */}
      <section id="pricing" className="bg-slate-50 py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="text-center">
              <span className="text-sm font-semibold uppercase tracking-widest text-amber-600">
                Precios
              </span>
              <h2
                className="mt-4 text-4xl text-slate-900 md:text-5xl"
                style={serif}
              >
                Simple y transparente
              </h2>
              <p className="mt-4 text-lg text-slate-500">
                Un solo plan con todo incluido. Sin sorpresas.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="mx-auto mt-12 max-w-md">
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                {/* Accent bar */}
                <div className="h-1.5 bg-gradient-to-r from-amber-400 to-amber-600" />
                <div className="p-8">
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm text-slate-500">Desde</span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span
                      className="text-6xl text-slate-900"
                      style={serif}
                    >
                      $15.000
                    </span>
                    <span className="text-slate-400">/mes</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Por administración. IVA no incluido.
                  </p>

                  <div className="my-8 h-px bg-slate-100" />

                  <div className="space-y-3">
                    {[
                      "Supervisores ilimitados",
                      "Edificios ilimitados",
                      "Bot de Telegram incluido",
                      "Reportes con IA incluidos",
                      "Envío de emails ilimitado",
                      "Soporte por Telegram",
                      "Almacenamiento de fotos ilimitado",
                    ].map((f) => (
                      <div key={f} className="flex items-center gap-3">
                        <CheckCircle2 className="size-4 shrink-0 text-amber-500" />
                        <span className="text-sm text-slate-600">{f}</span>
                      </div>
                    ))}
                  </div>

                  <Link
                    to="/login"
                    className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0b1120] py-4 text-sm font-semibold text-white transition-all hover:bg-slate-800"
                  >
                    Empezar ahora
                    <ChevronRight className="size-4" />
                  </Link>

                  <p className="mt-4 text-center text-xs text-slate-400">
                    14 días gratis. Sin tarjeta de crédito.
                  </p>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ════════ TRUST ════════ */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {[
                {
                  icon: Shield,
                  title: "Datos seguros",
                  desc: "Infraestructura en la nube con encriptación de extremo a extremo. Tus datos y los de tus clientes siempre protegidos.",
                },
                {
                  icon: Zap,
                  title: "Siempre disponible",
                  desc: "99.9% de uptime garantizado. El bot de Telegram funciona 24/7, y el panel web está disponible desde cualquier dispositivo.",
                },
                {
                  icon: MessageSquare,
                  title: "Soporte humano",
                  desc: "Equipo de soporte real por Telegram. Te ayudamos a configurar todo y a capacitar a tu equipo sin costo extra.",
                },
              ].map((t) => (
                <div
                  key={t.title}
                  className="flex flex-col items-center text-center"
                >
                  <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-slate-100">
                    <t.icon className="size-5 text-slate-600" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {t.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    {t.desc}
                  </p>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ════════ FINAL CTA ════════ */}
      <section className="relative bg-[#0b1120] py-24 md:py-32">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[700px] rounded-full bg-amber-500/10 blur-[150px]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <FadeIn>
            <h2
              className="text-4xl text-white md:text-6xl"
              style={serif}
            >
              Dejá de perseguir
              <br />
              <span className="italic text-amber-400">papeles y fotos.</span>
            </h2>
            <p className="mt-6 text-lg text-slate-400">
              Empezá hoy a gestionar tus edificios de forma profesional.
              Configuración en minutos, resultados desde el primer día.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                to="/login"
                className="group flex items-center gap-2 rounded-xl bg-amber-500 px-8 py-4 text-base font-semibold text-[#0b1120] transition-all hover:bg-amber-400 hover:shadow-2xl hover:shadow-amber-500/30"
              >
                Comenzar gratis
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="mailto:hola@consorcia.app"
                className="flex items-center gap-2 rounded-xl border border-slate-700 px-8 py-4 text-base font-medium text-slate-300 transition-all hover:border-slate-500 hover:text-white"
              >
                Agendar una demo
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ════════ FOOTER ════════ */}
      <footer className="border-t border-slate-800 bg-[#0b1120] py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 md:flex-row md:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500">
              <Building2 className="size-3.5 text-[#0b1120]" />
            </div>
            <span className="text-lg text-white" style={serif}>
              Consorcia
            </span>
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            <a href="#features" className="hover:text-slate-300">
              Funciones
            </a>
            <a href="#pricing" className="hover:text-slate-300">
              Precios
            </a>
            <a href="mailto:hola@consorcia.app" className="hover:text-slate-300">
              Contacto
            </a>
          </div>
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} Consorcia. Buenos Aires, Argentina.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ─── Chat bubble component ─── */
function ChatBubble({
  from,
  children,
}: {
  from: "bot" | "user";
  children: React.ReactNode;
}) {
  return (
    <div className={`flex ${from === "user" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-[11px] leading-relaxed whitespace-pre-line ${
          from === "user"
            ? "bg-[#DCF8C6] text-slate-800"
            : "bg-white text-slate-800 shadow-sm"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
