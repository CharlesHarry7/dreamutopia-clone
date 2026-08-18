"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
  minLength?: number;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
};

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = "current-password",
  placeholder,
  minLength = 6,
  required = true,
  invalid = false,
  describedBy,
}: Props) {
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-20"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 h-9 min-h-9 -translate-y-1/2 px-2 text-xs"
          aria-pressed={show}
          aria-label={show ? "Hide password" : "Show password"}
          onClick={() => setShow((v) => !v)}
        >
          {show ? "Hide" : "Show"}
        </Button>
      </div>
    </div>
  );
}
