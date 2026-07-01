import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, Loader2, FlaskConical, Pipette, Sparkles, Microscope, TestTube, Atom, Dna } from "lucide-react";

export default function ResetPassword() {
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    // Garantir que a sessão do Supabase esteja carregada/inicializada ao abrir /reset-password
    const checkSession = async () => {
      try {
        await supabase.auth.getSession();
      } catch (err) {
        console.error("Erro ao obter sessão no ResetPassword:", err);
      }
    };
    checkSession();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const cleanPassword = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanPassword || !cleanConfirm) {
      setMessage({ type: "error", text: "Preencha todos os campos." });
      return;
    }

    if (cleanPassword.length < 6) {
      setMessage({ type: "error", text: "A senha deve ter pelo menos 6 caracteres." });
      return;
    }

    if (cleanPassword !== cleanConfirm) {
      setMessage({ type: "error", text: "As senhas informadas não coincidem." });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: cleanPassword,
      });

      if (error) throw error;

      setMessage({
        type: "success",
        text: "Senha atualizada com sucesso. Você já pode acessar o Cedro IA com sua nova senha.",
      });

      // Redireciona para o login após 3 segundos
      setTimeout(() => {
        window.location.href = "/";
      }, 3000);
    } catch (err: any) {
      console.error("Erro ao atualizar senha:", err);
      setMessage({
        type: "error",
        text: "Não foi possível atualizar a senha. Solicite um novo link de recuperação e tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen w-full relative flex flex-col lg:flex-row bg-cover bg-center overflow-hidden font-sans select-none"
      style={{
        backgroundImage: `url('https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1920&q=80')`
      }}
    >
      {/* Solid green overlay */}
      <div className="absolute inset-0 bg-[#003F1D]/85 z-0 pointer-events-none" />

      {/* LEFT COLUMN: Logo */}
      <div className="hidden lg:flex lg:w-[65%] flex-col justify-center items-center p-12 relative z-10">
        <div className="flex flex-col items-center justify-center text-center animate-fade-in">
          <img 
            src="https://raw.githubusercontent.com/nitlabcedro/assets/refs/heads/main/Ativo%206.png" 
            alt="Laboratório Cedro" 
            className="h-44 w-auto brightness-0 invert" 
          />
        </div>
      </div>

      {/* RIGHT COLUMN: Password Reset Card */}
      <div className="w-full lg:w-[35%] min-h-screen bg-white/95 backdrop-blur-md border-l border-slate-200 relative z-10 flex flex-col justify-between p-8 lg:p-14 xl:p-16 overflow-y-auto custom-scrollbar">
        
        {/* Subtle Laboratory Overlay Elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-15" />
          
          <motion.div 
            className="absolute top-[15%] left-[8%]"
            style={{ color: "rgba(7, 86, 24, 0.065)" }}
            animate={{ y: [0, -6, 0], rotate: [0, 6, -6, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          >
            <FlaskConical size={64} strokeWidth={1.2} />
          </motion.div>

          <motion.div 
            className="absolute top-[26%] right-[10%]"
            style={{ color: "rgba(242, 146, 34, 0.055)" }}
            animate={{ y: [0, 8, 0], rotate: [0, -8, 8, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          >
            <Pipette size={52} strokeWidth={1.2} />
          </motion.div>

          <motion.div 
            className="absolute top-[34%] left-[12%]"
            style={{ color: "rgba(242, 146, 34, 0.05)" }}
            animate={{ scale: [0.9, 1.15, 0.9], opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles size={36} strokeWidth={1.2} />
          </motion.div>

          <motion.div 
            className="absolute top-[44%] right-[8%]"
            style={{ color: "rgba(7, 86, 24, 0.065)" }}
            animate={{ y: [0, -8, 0], rotate: [0, -4, 4, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          >
            <Microscope size={68} strokeWidth={1.2} />
          </motion.div>

          <motion.div 
            className="absolute bottom-[38%] left-[8%]"
            style={{ color: "rgba(7, 86, 24, 0.065)" }}
            animate={{ y: [0, 6, 0], rotate: [0, 8, -8, 0] }}
            transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          >
            <TestTube size={56} strokeWidth={1.2} />
          </motion.div>

          <motion.div 
            className="absolute bottom-[24%] right-[12%]"
            style={{ color: "rgba(242, 146, 34, 0.055)" }}
            animate={{ scale: [0.95, 1.05, 0.95], rotate: [0, 360] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          >
            <Atom size={60} strokeWidth={1.2} />
          </motion.div>

          <motion.div 
            className="absolute bottom-[10%] left-[10%]"
            style={{ color: "rgba(7, 86, 24, 0.075)" }}
            animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          >
            <Dna size={72} strokeWidth={1.0} />
          </motion.div>
        </div>

        {/* Top brand indicator (only visible on mobile) */}
        <div className="block lg:hidden flex flex-col items-center mb-10 relative z-10">
          <img 
            src="https://raw.githubusercontent.com/nitlabcedro/assets/refs/heads/main/Ativo%206.png" 
            alt="Laboratório Cedro" 
            className="h-20 w-auto object-contain mb-3" 
          />
          <div className="flex items-center gap-1.5 select-none font-display">
            <span className="text-[#075618] font-extrabold text-xl tracking-tight">
              Cedro
            </span>
            <span className="text-[#F29222] font-semibold text-xl tracking-wide">
              IA
            </span>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center my-auto relative z-10">
          
          {/* Header Title */}
          <div className="mb-6 relative">
            <h2 className="text-2xl lg:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#075618] via-[#094d15] to-[#F29222] tracking-tight font-display">
              Redefinir senha
            </h2>
            <p className="text-slate-500 text-xs lg:text-[13px] mt-2 font-medium">
              Crie uma nova senha para acessar o Cedro IA.
            </p>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            
            {/* New Password Input */}
            <div className="relative group flex items-center bg-slate-100/50 hover:bg-slate-100/80 focus-within:bg-white border border-slate-300/90 focus-within:border-[#075618] rounded-2xl transition-all duration-300 focus-within:ring-4 focus-within:ring-[#075618]/5 shadow-[0_2px_10px_rgba(0,0,0,0.04)] focus-within:shadow-md">
              <div className="absolute left-4.5 flex items-center justify-center text-slate-500/90 group-focus-within:text-[#075618] group-hover:text-slate-600 transition-colors duration-200">
                <Lock size={20} strokeWidth={1.75} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Nova senha"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-13 pr-12 py-4 bg-transparent text-slate-900 outline-none text-base placeholder:text-slate-500 font-medium tracking-wide caret-[#075618]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4.5 flex items-center justify-center text-slate-500 hover:text-slate-700 focus:outline-none transition-colors duration-200"
              >
                {showPassword ? <EyeOff size={20} strokeWidth={1.75} /> : <Eye size={20} strokeWidth={1.75} />}
              </button>
            </div>

            {/* Confirm New Password Input */}
            <div className="relative group flex items-center bg-slate-100/50 hover:bg-slate-100/80 focus-within:bg-white border border-slate-300/90 focus-within:border-[#075618] rounded-2xl transition-all duration-300 focus-within:ring-4 focus-within:ring-[#075618]/5 shadow-[0_2px_10px_rgba(0,0,0,0.04)] focus-within:shadow-md">
              <div className="absolute left-4.5 flex items-center justify-center text-slate-500/90 group-focus-within:text-[#075618] group-hover:text-slate-600 transition-colors duration-200">
                <Lock size={20} strokeWidth={1.75} />
              </div>
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirmar nova senha"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-13 pr-12 py-4 bg-transparent text-slate-900 outline-none text-base placeholder:text-slate-500 font-medium tracking-wide caret-[#075618]"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4.5 flex items-center justify-center text-slate-500 hover:text-slate-700 focus:outline-none transition-colors duration-200"
              >
                {showConfirmPassword ? <EyeOff size={20} strokeWidth={1.75} /> : <Eye size={20} strokeWidth={1.75} />}
              </button>
            </div>

            {/* Status / Error messages */}
            {message && (
              <div className={`p-3.5 rounded-xl text-xs font-semibold ${
                message.type === "success" ? "bg-emerald-50 text-[#075618] border border-emerald-100/60" : "bg-red-50 text-red-600 border border-red-100/60"
              } flex items-start gap-2 transition-all`}>
                <span className={`size-1.5 rounded-full mt-1.5 shrink-0 ${message.type === "success" ? "bg-emerald-500" : "bg-red-500"}`} />
                <span>
                  {message.text}
                </span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#03440c] hover:bg-[#075618] active:scale-[0.99] text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-[#075618]/20 mt-4"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                "Atualizar senha"
              )}
            </button>
          </form>

          {/* Back to login */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => { window.location.href = "/"; }}
              className="text-slate-600 text-xs hover:text-[#075618] hover:underline transition-colors cursor-pointer"
            >
              Voltar para o login
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 pt-4 border-t border-slate-100 flex flex-col items-center relative z-10">
          <p className="text-slate-400 text-[11px]">
            Cedro IA &copy; {new Date().getFullYear()}
          </p>
        </div>

      </div>
    </div>
  );
}
