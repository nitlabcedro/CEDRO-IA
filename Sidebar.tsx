import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
}

interface CustomDropdownProps {
  label?: string;
  placeholder?: string;
  value: string;
  options: (string | DropdownOption)[];
  onChange: (val: string) => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  required?: boolean;
  className?: string; // Optional parent wrapper styling
  triggerClassName?: string; // Optional custom trigger button styling
  optionsClassName?: string; // Optional custom dropdown list styling
  size?: "sm" | "md" | "lg";
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  label,
  placeholder,
  value,
  options,
  onChange,
  icon,
  disabled = false,
  className = "",
  triggerClassName = "",
  optionsClassName = "",
  size = "md",
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Normalize options to DropdownOption objects
  const normalizedOptions: DropdownOption[] = options.map((opt) => {
    if (typeof opt === "string") {
      return { value: opt, label: opt };
    }
    return opt;
  });

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : (placeholder || value || "");

  // Classes depending on size preset
  const getTriggerSizeClasses = () => {
    if (size === "lg") {
      return icon 
        ? "pl-12 pr-10 py-4 text-sm font-semibold rounded-2xl" 
        : "pl-4.5 pr-10 py-4 text-sm font-semibold rounded-2xl";
    }
    if (size === "sm") {
      return icon 
        ? "pl-8 pr-8 py-1.5 text-xs font-semibold rounded-lg" 
        : "pl-3.5 pr-8 py-1.5 text-xs font-semibold rounded-lg";
    }
    // "md" preset
    return icon 
      ? "pl-11 pr-9 py-3 text-xs font-bold rounded-xl" 
      : "pl-4.5 pr-9 py-3 text-xs font-bold rounded-xl";
  };

  const getTriggerBaseClasses = () => {
    if (disabled) {
      return "opacity-50 cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400";
    }
    
    // Default form classes
    if (size === "lg") {
      const isFilled = !!value;
      const borderClass = isFilled ? "border-[#075618]" : "border-[#075618]/50";
      return `bg-slate-50/50 hover:bg-slate-50 focus:bg-white text-[#111111] border-2 ${borderClass} hover:border-[#075618] focus:border-[#075618]`;
    }

    if (size === "sm") {
      return `bg-white border-2 ${
        isOpen ? "border-[#075618] ring-2 ring-[#075618]/10" : "border-[#075618]/30 hover:border-[#075618]/65 focus:border-[#075618]"
      } text-slate-700`;
    }

    // md size (like UserProfile)
    return `bg-white border-2 ${
      isOpen ? "border-[#075618] ring-2 ring-[#075618]/10" : "border-[#075618]/45 hover:border-[#075618]/75 focus:border-[#075618]"
    } text-[#1F2933]`;
  };

  const getChevronSize = () => {
    if (size === "sm") return 12;
    if (size === "lg") return 16;
    return 14;
  };

  const getChevronPadding = () => {
    if (size === "sm") return "right-2.5";
    if (size === "lg") return "right-4.5";
    return "right-3";
  };

  const getIconPadding = () => {
    if (size === "sm") return "left-2.5";
    if (size === "lg") return "left-4.5";
    return "left-4";
  };

  return (
    <div className={`space-y-1 w-full relative ${isOpen ? "z-50" : "z-10"} ${className}`}>
      {label && (
        <label className="text-[10px] font-black text-[#075618] uppercase tracking-wider block pl-1.5 select-none mb-1">
          {label}
        </label>
      )}

      <div className="relative">
        {/* Trigger Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full relative flex items-center transition-all duration-300 shadow-3xs outline-none text-left select-none ${getTriggerBaseClasses()} ${getTriggerSizeClasses()} ${triggerClassName}`}
        >
          {icon && (
            <div className={`absolute ${getIconPadding()} flex items-center justify-center text-[#075618] opacity-80`}>
              {icon}
            </div>
          )}
          
          <span className="truncate pr-2 block">
            {displayLabel}
          </span>

          <div
            className={`absolute ${getChevronPadding()} flex items-center text-[#075618] opacity-85 transition-transform duration-200`}
            style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)" }}
          >
            <ChevronDown size={getChevronSize()} strokeWidth={2.5} />
          </div>
        </button>

        {/* Click Outside Overlay (using React Portal isn't needed if z-index handles it perfectly, but this backdrop is great!) */}
        {isOpen && (
          <div
            className="fixed inset-0 z-40 cursor-default"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
          />
        )}

        {/* Dropdown Options List */}
        <AnimatePresence>
          {isOpen && !disabled && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className={`absolute left-0 min-w-full w-max max-w-[280px] mt-1.5 max-h-60 overflow-y-auto bg-white border-2 border-[#075618] rounded-xl shadow-lg z-50 p-1.5 scrollbar-thin scrollbar-thumb-slate-200 ${optionsClassName}`}
            >
              {normalizedOptions.length === 0 ? (
                <div className="px-4 py-3 text-xs font-bold text-[#075618]/50 text-center uppercase tracking-wider">
                  Nenhuma opção disponível
                </div>
              ) : (
                normalizedOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-xs font-extrabold uppercase tracking-wide rounded-lg transition-all flex items-center justify-between gap-2.5 whitespace-normal break-words leading-tight ${
                      value === opt.value
                        ? "bg-[#075618] text-white shadow-xs"
                        : "text-slate-700 hover:bg-[#075618]/5 hover:text-[#075618]"
                    }`}
                  >
                    <span className="text-left flex-1">{opt.label}</span>
                    {value === opt.value && (
                      <div className="size-1.5 rounded-full bg-white shadow-sm shrink-0" />
                    )}
                  </button>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CustomDropdown;
