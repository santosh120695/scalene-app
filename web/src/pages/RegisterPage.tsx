import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/stores/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { errMessage } from "@/api/client";
import { toast } from "@/components/ui/sonner";
import { AuthShell } from "./LoginPage";

export function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuth((s) => s.register);
  const loading = useAuth((s) => s.loading);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    try {
      await register(email, password, fullName);
      navigate("/");
    } catch (err) {
      toast.error(errMessage(err, "Registration failed"));
    }
  }

  return (
    <AuthShell>
      <h1 className="font-display text-[38px] italic leading-tight text-ink-primary">
        Create your space.
      </h1>
      <p className="mb-8 mt-1 text-[14px] text-ink-muted">
        It felt like your thoughts already lived here.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Input
          autoFocus
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <Input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          required
          placeholder="Password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" disabled={loading} className="mt-2">
          {loading ? "Creating…" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-[13px] text-ink-secondary">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
