"use client";

import { useEffect, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SignatureFieldProps = {
  value?: string;
  onChange: (value: string) => void;
  error?: string;
  resetKey?: number;
};

export function SignatureField({ onChange, error, resetKey }: SignatureFieldProps) {
  const signatureRef = useRef<SignatureCanvas | null>(null);

  useEffect(() => {
    signatureRef.current?.clear();
  }, [resetKey]);

  function handleEnd() {
    const signature = signatureRef.current;
    if (!signature || signature.isEmpty()) {
      onChange("");
      return;
    }

    onChange(signature.getTrimmedCanvas().toDataURL("image/png"));
  }

  function clearSignature() {
    signatureRef.current?.clear();
    onChange("");
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "overflow-hidden rounded-md border bg-white shadow-sm transition-colors",
          error ? "border-destructive" : "border-input",
        )}
      >
        <SignatureCanvas
          ref={signatureRef}
          penColor="#0f172a"
          onEnd={handleEnd}
          canvasProps={{
            className: "signature-canvas touch-none",
            "aria-label": "Tanda tangan pemohon",
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Tanda tangani di area putih.</p>
        <Button type="button" variant="outline" size="sm" onClick={clearSignature}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Clear
        </Button>
      </div>
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
