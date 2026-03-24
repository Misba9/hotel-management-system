export function CheckoutStepper({ step }: { step: 1 | 2 | 3 }) {
  const steps = ["Address", "Payment", "Confirm"];
  return (
    <div className="grid grid-cols-3 gap-2">
      {steps.map((label, index) => {
        const active = index + 1 <= step;
        return (
          <div key={label} className={`rounded-xl px-3 py-2 text-center text-sm ${active ? "bg-orange-500 text-white" : "bg-white text-slate-500"}`}>
            {index + 1}. {label}
          </div>
        );
      })}
    </div>
  );
}
