import { useLocation, Link } from "wouter";
import { useState } from "react";
import { motion } from "framer-motion";
import { Hexagon, Lock, Mail, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("admin@converge.com");
  const [password, setPassword] = useState("password");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      await login(email, password);
      setLocation("/admin");
    } catch (err: any) {
      setError(err.message ?? "Login failed. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 z-0 flex">
        <div className="w-1/2 h-full bg-primary relative hidden lg:block">
          <img 
            src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920&q=80" 
            alt="Modern Architecture" 
            className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80" />
          <div className="relative z-10 flex flex-col justify-center h-full p-16 xl:p-24 text-primary-foreground max-w-2xl">
            <div className="mb-12">
              <Hexagon className="h-16 w-16 text-accent mb-6" />
              <h1 className="text-5xl font-display font-bold leading-tight mb-6">
                Command Center for Premium Events
              </h1>
              <p className="text-primary-foreground/70 text-lg leading-relaxed max-w-lg">
                Manage attendees, coordinate VIP meetings, and oversee sponsor interactions from one centralized concierge platform.
              </p>
            </div>
            
            <div className="space-y-6 mt-12 border-t border-primary-foreground/20 pt-12">
              <div className="flex items-center gap-4 text-primary-foreground/90">
                <div className="h-10 w-10 rounded-full bg-primary-foreground/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5 text-accent" />
                </div>
                <p className="font-medium">Enterprise-grade security and access controls</p>
              </div>
            </div>
          </div>
        </div>
        <div className="w-full lg:w-1/2 h-full bg-background relative flex items-center justify-center p-6 sm:p-12">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.15] pointer-events-none" />
          
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="w-full max-w-md relative z-10"
          >
            <div className="lg:hidden flex justify-center mb-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <Hexagon className="h-7 w-7" />
              </div>
            </div>

            <div className="bg-card p-8 sm:p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-border/50">
              <div className="text-center sm:text-left mb-8">
                <h2 className="text-3xl font-display font-bold text-foreground">Welcome Back</h2>
                <p className="text-muted-foreground mt-2">Sign in to access the admin dashboard</p>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 mb-5">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground/80 font-medium">Work Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60" />
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="admin@converge.com" 
                      className="pl-10 h-12 rounded-xl border-border/80 focus-visible:ring-accent"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="input-login-email"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-foreground/80 font-medium">Password</Label>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60" />
                    <Input 
                      id="password" 
                      type="password" 
                      placeholder="••••••••" 
                      className="pl-10 h-12 rounded-xl border-border/80 focus-visible:ring-accent"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      data-testid="input-login-password"
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base mt-2 shadow-lg shadow-primary/25 transition-all group"
                  data-testid="button-login-submit"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Authenticating...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Sign In to Dashboard
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  )}
                </Button>
              </form>

              <div className="mt-8 text-center text-sm text-muted-foreground">
                <p>Not an administrator? <Link href="/" className="font-medium text-foreground hover:text-accent transition-colors">Return to events</Link></p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
