"use client";
// Six code boxes (email code page and the sign-up phone code). Typing, autofill and paste all spread the digits;
// the parent gets the full code once all six are in.
import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import s from "./auth.module.css";

export const EMPTY_CODE = ["", "", "", "", "", ""];

type Props = {
  digits: string[];
  setDigits: (d: string[]) => void;
  onComplete: (code: string) => void;
  labelledBy: string;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  boxes?: React.RefObject<(HTMLInputElement | null)[]>;
};

export function CodeBoxes({ digits, setDigits, onComplete, labelledBy, describedBy, invalid, disabled, autoFocus, boxes: given }: Props) {
  const own = useRef<(HTMLInputElement | null)[]>([]);
  const boxes = given ?? own;

  function fill(i: number, raw: string) {
    const got = raw.replace(/\D/g, "").slice(0, 6 - i).split("");
    if (!got.length) return;
    const next = [...digits];
    got.forEach((d, j) => (next[i + j] = d));
    setDigits(next);
    boxes.current[Math.min(i + got.length, 5)]?.focus();
    if (next.every(Boolean)) onComplete(next.join(""));
  }

  function onKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...digits];
      const at = digits[i] || i === 0 ? i : i - 1;
      next[at] = "";
      setDigits(next);
      boxes.current[at]?.focus();
    } else if (e.key === "ArrowLeft") boxes.current[i - 1]?.focus();
    else if (e.key === "ArrowRight") boxes.current[i + 1]?.focus();
  }

  return (
    <div className={s.boxes} role="group" aria-labelledby={labelledBy} aria-describedby={describedBy}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { boxes.current[i] = el; }}
          value={d}
          onChange={(e) => fill(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          onPaste={(e: ClipboardEvent<HTMLInputElement>) => { e.preventDefault(); fill(i, e.clipboardData.getData("text")); }}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1} of 6`}
          aria-invalid={invalid || undefined}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
