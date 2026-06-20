declare module "node-thermal-printer" {
  export enum PrinterTypes {
    EPSON = "epson",
    STAR = "star",
    BROTHER = "brother"
  }

  export enum CharacterSet {
    PC852_LATIN2 = "PC852_LATIN2"
  }

  export enum BreakLine {
    WORD = "WORD"
  }

  export class ThermalPrinter {
    constructor(options: Record<string, unknown>);
    alignCenter(): void;
    alignLeft(): void;
    bold(enabled: boolean): void;
    setTextSize(width: number, height: number): void;
    setTextNormal(): void;
    println(text: string): void;
    drawLine(): void;
    newLine(): void;
    cut(): void;
    tableCustom(columns: Array<{ text: string; align: string; width: number }>): void;
    printQR(data: string, options?: Record<string, unknown>): void;
    isPrinterConnected(): Promise<boolean>;
    execute(): Promise<void>;
  }
}
