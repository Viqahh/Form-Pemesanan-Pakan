declare module "react-signature-canvas" {
  import type { Component } from "react";

  type SignatureCanvasProps = {
    penColor?: string;
    onEnd?: () => void;
    canvasProps?: Record<string, unknown>;
  };

  export default class SignatureCanvas extends Component<SignatureCanvasProps> {
    clear(): void;
    isEmpty(): boolean;
    getTrimmedCanvas(): HTMLCanvasElement;
  }
}
