import { Building2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useRef } from "react";

export default function Login() {
  const { data: user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    if (user) {
      if (user.role === "CUSTOMER") setLocation("/dashboard");
      else if (user.role === "FACILITATOR") setLocation("/facilitator");
      else if (user.role === "ADMIN") setLocation("/admin");
    }
  }, [user, setLocation]);

  useEffect(() => {
    if (scriptLoadedRef.current || isLoading) return;

    const loadGoogleSignIn = () => {
      if ((window as any).google) {
        (window as any).google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
          callback: handleGoogleSignIn,
          auto_select: false,
          itp_support: true,
        });

        if (googleButtonRef.current) {
          (window as any).google.accounts.id.renderButton(googleButtonRef.current, {
            type: "standard",
            size: "large",
            theme: "outline",
            text: "signin_with",
            shape: "rectangular",
            logo_alignment: "left",
          });
        }
      }
    };

    const handleGoogleSignIn = async (response: any) => {
      try {
        if (response.credential) {
          // Send the ID token to the backend to exchange for session
          const res = await fetch("/api/auth/google/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ token: response.credential }),
          });

          if (res.ok) {
            window.location.href = "/";
          } else {
            console.error("Failed to authenticate");
          }
        }
      } catch (err) {
        console.error("Sign-in error:", err);
      }
    };

    // Load Google Identity Services script
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      scriptLoadedRef.current = true;
      loadGoogleSignIn();
    };
    script.onerror = () => {
      console.error("Failed to load Google Sign-In script");
      // Fallback to OAuth flow
      if (googleButtonRef.current) {
        googleButtonRef.current.innerHTML = `
          <button 
            onClick="window.location.href='/api/auth/google'"
            style="width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 12px;"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>
        `;
      }
    };
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [isLoading]);

  if (isLoading) return null;

  return (
    <div className="min-h-screen w-full flex bg-slate-900">
      {/* Left side - Image & Branding */}
      <div className="hidden lg:flex flex-1 relative items-center justify-center overflow-hidden">
        <img 
          src={`${import.meta.env.BASE_URL}images/login-bg.png`}
          alt="Corporate architecture"
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 to-slate-900/40" />
        
        <div className="relative z-10 px-12 animate-slide-up">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-8 shadow-2xl shadow-primary/20">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-5xl font-display font-bold text-white mb-6 leading-tight">
            Streamline your<br/>business setup.
          </h1>
          <p className="text-xl text-slate-300 max-w-lg font-light leading-relaxed">
            The all-in-one platform for registering Indian MSMEs & SMEs. 
            Automated pipelines, dedicated facilitators, zero hassle.
          </p>
        </div>
      </div>

      {/* Right side - Login Box */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white relative">
        <div className="w-full max-w-md space-y-10 animate-fade-in">
          
          <div className="lg:hidden flex justify-center mb-8">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <Building2 className="w-6 h-6 text-white" />
            </div>
          </div>

          <div className="text-center lg:text-left space-y-2">
            <h2 className="text-3xl font-bold font-display text-slate-900">Welcome to BizSetup</h2>
            <p className="text-slate-500">Sign in to manage your registrations</p>
          </div>

          <div className="space-y-4 flex justify-center">
            <div ref={googleButtonRef} />
          </div>

          <div className="text-center text-sm text-slate-500 pt-8">
            By signing in, you agree to our Terms of Service & Privacy Policy.
          </div>
        </div>
      </div>
    </div>
  );
}
