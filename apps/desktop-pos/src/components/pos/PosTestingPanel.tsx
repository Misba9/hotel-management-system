import { useCashierPosStore } from "@/lib/pos/cashier-pos-store";
import type { TestPlatform } from "@/lib/pos/cashier-test-orders";

export function PosTestingFab() {
  const setShow = useCashierPosStore((s) => s.setShowTestPanel);
  return (
    <button type="button" className="pos-test-orders" onClick={() => setShow(true)}>
      Test Orders
    </button>
  );
}

export function PosTestingPanelModal() {
  const show = useCashierPosStore((s) => s.showTestPanel);
  const setShow = useCashierPosStore((s) => s.setShowTestPanel);
  const generateTest = useCashierPosStore((s) => s.generateTest);
  const clearTestOrders = useCashierPosStore((s) => s.clearTestOrders);
  const randomStatus = useCashierPosStore((s) => s.randomStatus);
  const randomPayment = useCashierPosStore((s) => s.randomPayment);
  const setRandomStatus = useCashierPosStore((s) => s.setRandomStatus);
  const setRandomPayment = useCashierPosStore((s) => s.setRandomPayment);

  if (!show) return null;

  const platforms: TestPlatform[] = ["parcel", "swiggy", "zomato", "online", "waiter"];

  return (
    <div className="pos-modal-overlay" onClick={() => setShow(false)}>
      <div className="pos-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Test orders panel</h2>
        <p>Generate mock orders for each platform module.</p>
        <div className="pos-test-grid">
          {platforms.map((p) => (
            <button key={p} type="button" className="pos-action-btn" onClick={() => generateTest(p, 1)}>
              + {p}
            </button>
          ))}
          <button type="button" className="pos-action-btn" onClick={() => generateTest("mixed", 3)}>+ mixed (3)</button>
        </div>
        <label className="pos-test-toggle">
          <input type="checkbox" checked={randomStatus} onChange={(e) => setRandomStatus(e.target.checked)} />
          Random status
        </label>
        <label className="pos-test-toggle">
          <input type="checkbox" checked={randomPayment} onChange={(e) => setRandomPayment(e.target.checked)} />
          Random payment
        </label>
        <button type="button" className="pos-cancel-btn" onClick={clearTestOrders}>Clear test orders</button>
        <button type="button" className="pos-pay-btn" onClick={() => setShow(false)}>Close</button>
      </div>
    </div>
  );
}
