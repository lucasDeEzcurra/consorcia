import { useState, type FormEvent } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Building2, ArrowLeft, Loader2 } from "lucide-react";

const serif = { fontFamily: "'Instrument Serif', Georgia, serif" };
const sans = { fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" };

export function LoginPage() {
  const { session, role, loading, signIn, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Still initializing auth — show spinner
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1120]">
        <Loader2 className="size-6 animate-spin text-amber-500" />
      </div>
    );
  }

  // Signed in with a valid role → redirect to dashboard
  if (session && role) {
    const redirect = role === "admin" ? "/admin/dashboard" : "/dashboard";
    return <Navigate to={redirect} replace />;
  }

  // Session exists but no role → user_profiles row missing or fetch failed.
  // Sign them out so they don't get stuck in a loading loop.
  if (session && !role) {
    signOut();
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1120]">
        <Loader2 className="size-6 animate-spin text-amber-500" />
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error } = await signIn(email, password);
    if (error) {
      setError(error.message);
      setSubmitting(false);
    }
    // On success, DON'T set submitting=false — keep the button loading
    // until onAuthStateChange sets session+role and LoginPage redirects
  };

  return (
    <div style={sans} className="flex min-h-screen">
      {/* Left side - decorative */}
      <div className="relative hidden w-1/2 bg-[#0b1120] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[700px] rounded-full bg-amber-500/5 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-[400px] w-[500px] rounded-full bg-blue-500/5 blur-[100px]" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        <div className="relative">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500">
              <Building2 className="size-5 text-[#0b1120]" />
            </div>
            <span className="text-2xl text-white font-semibold tracking-tight" style={serif}>
              Consorcia
            </span>
          </Link>
        </div>

        <div className="relative">
          <h2 className="text-4xl leading-tight text-white xl:text-5xl" style={serif}>
            Gestioná tus edificios
            <br />
            <span className="italic text-amber-400">de forma profesional.</span>
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-slate-400">
            WhatsApp, fotos, reportes con IA y envío por email.
            Todo en un solo lugar.
          </p>
        </div>

        <p className="relative text-xs text-slate-600">
          © {new Date().getFullYear()} Consorcia. Buenos Aires, Argentina.
        </p>
      </div>

      {/* Right side - login form */}
      <div className="flex flex-1 flex-col bg-white">
        {/* Mobile header */}
        <div className="flex items-center justify-between p-6 lg:hidden">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500">
              <Building2 className="size-4 text-[#0b1120]" />
            </div>
            <span className="text-xl font-semibold tracking-tight" style={serif}>
              Consorcia
            </span>
          </Link>
          <Link to="/" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <h1 className="text-3xl text-slate-900" style={serif}>
                Bienvenido
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Ingresá tus datos para acceder al panel.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm transition-all placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  placeholder="tu@email.com"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium text-slate-700">
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm transition-all placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  placeholder="Tu contraseña"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 text-sm font-semibold text-[#0b1120] shadow-sm transition-all hover:bg-amber-400 hover:shadow-md hover:shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Ingresando...
                  </>
                ) : (
                  "Ingresar"
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-xs text-slate-400">
              ¿No tenés cuenta?{" "}
              <a href="mailto:hola@consorcia.app" className="text-amber-600 hover:text-amber-500">
                Contactanos
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
