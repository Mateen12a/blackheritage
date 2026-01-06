import { useState, FormEvent } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import logoImg from "../assets/logo.png";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("organizer");
  const { login, register, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  if (isAuthenticated) {
    setLocation("/");
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isLogin && password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Passwords do not match",
      });
      return;
    }
    try {
      if (isLogin) {
        await login({ username, password });
      } else {
        await register({ username, email, password, role });
      }
      setLocation("/admin");
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <Link href="/">
          <div className="flex flex-col items-center mb-12 cursor-pointer group">
            <div className="w-20 h-20 mb-4">
              <img src={logoImg} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-3xl font-display font-bold text-white group-hover:text-primary transition-colors uppercase">
              Black Heritage
            </h1>
            <span className="text-xs uppercase tracking-[0.3em] text-primary">Events & Entertainment</span>
          </div>
        </Link>
        <Card className="w-full max-w-md bg-card border border-white/10 rounded-3xl p-8 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-3xl font-display font-bold text-white text-center mb-2">
              {isLogin ? "Welcome Back" : "Create Account"}
            </CardTitle>
            <p className="text-center text-muted-foreground">
              {isLogin ? "Sign in to manage your events" : "Register as an organizer or admin"}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  className="h-12 bg-white/5 border-white/10 text-white"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    className="h-12 bg-white/5 border-white/10 text-white"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="h-12 bg-white/5 border-white/10 pr-12 text-white"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    className="h-12 bg-white/5 border-white/10 text-white"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              )}
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="role">Account Type</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="h-12 bg-white/5 border-white/10">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="organizer">Organizer</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button type="submit" className="w-full h-14 bg-primary text-background font-black text-lg hover:bg-white transition-all rounded-xl shadow-lg active:scale-95">
                {isLogin ? "Sign In" : "Register Account"}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm font-medium text-primary hover:text-white transition-colors"
              >
                {isLogin ? "New here? Create an account" : "Already have an account? Sign in"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
