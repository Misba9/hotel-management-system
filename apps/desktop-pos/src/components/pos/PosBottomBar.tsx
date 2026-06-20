const SHORTCUTS = [
  { key: "F1", label: "Search" },
  { key: "F2", label: "New" },
  { key: "F3", label: "Payment" },
  { key: "F4", label: "Print" },
  { key: "F5", label: "Hold" },
  { key: "F6", label: "Discount" },
  { key: "F7", label: "Customer" },
  { key: "F8", label: "Kitchen" },
  { key: "ESC", label: "Cancel" },
  { key: "CTRL+B", label: "Barcode" }
];

type Props = {
  onNewOrder?: () => void;
  onPrint?: () => void;
  onPay?: () => void;
  onMore?: () => void;
};

export function PosBottomBar({ onNewOrder, onPrint, onPay, onMore }: Props) {
  return (
    <footer className="pos-bottom-bar">
      <div className="pos-bottom-actions">
        <button type="button" className="pos-bottom-btn" onClick={onNewOrder}>New (F2)</button>
        <button type="button" className="pos-bottom-btn" onClick={onPrint}>Print (F4)</button>
        <button type="button" className="pos-bottom-btn pay" onClick={onPay}>Pay (F3)</button>
        <button type="button" className="pos-bottom-btn" onClick={onMore}>Shortcuts</button>
      </div>
      <div className="pos-shortcuts-row">
        {SHORTCUTS.map((shortcut) => (
          <div key={shortcut.key} className="pos-shortcut">
            <kbd>{shortcut.key}</kbd>
            <span>{shortcut.label}</span>
          </div>
        ))}
      </div>
    </footer>
  );
}
