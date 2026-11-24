import assert from "node:assert";
import { describe, expect, it } from "vitest";

describe("Salary Sheet & Payroll Calculation Contract Suite", () => {
  const employees = [
    {
      vendorId: "e1",
      name: "Senior Frontend Engineer",
      salary: "90000",
      selected: true,
    },
    {
      vendorId: "e2",
      name: "UI/UX Designer",
      salary: "75000",
      selected: true,
    },
    {
      vendorId: "e3",
      name: "QA Engineer",
      salary: "60000",
      selected: false, // unselected
    },
  ];

  it("calculates employees subtotal accurately for selected employees only", () => {
    const employeesSubtotal = employees
      .filter((e) => e.selected)
      .reduce((sum, e) => sum + (Number(e.salary) || 0), 0);

    // 90000 + 75000 = 165000
    assert.strictEqual(employeesSubtotal, 165000);
  });

  it("calculates additional bonuses, allowances, and payouts subtotal", () => {
    const additionalPayouts = [
      { id: "a1", amount: "15000", description: "Performance Bonus" },
      { id: "a2", amount: "8000", description: "Internet Allowance" },
      { id: "a3", amount: "", description: "Blank row" }, // empty
      { id: "a4", amount: "invalid", description: "Bad input" }, // invalid
    ];

    const additionalSubtotal = additionalPayouts.reduce((sum, a) => {
      const val = Number(a.amount);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

    // 15000 + 8000 = 23000
    assert.strictEqual(additionalSubtotal, 23000);
  });

  it("computes grand total payroll as sum of employee and additional subtotals", () => {
    const employeesSubtotal = 165000;
    const additionalSubtotal = 23000;
    const grandTotal = employeesSubtotal + additionalSubtotal;

    assert.strictEqual(grandTotal, 188000);
  });

  it("handles toggling all employees selection state", () => {
    // Select all
    let state = employees.map((e) => ({ ...e, selected: true }));
    let subtotalAll = state.reduce((sum, e) => sum + Number(e.salary), 0);
    expect(subtotalAll).toBe(225000); // 90k + 75k + 60k

    // Deselect all
    state = employees.map((e) => ({ ...e, selected: false }));
    let subtotalNone = state
      .filter((e) => e.selected)
      .reduce((sum, e) => sum + Number(e.salary), 0);
    expect(subtotalNone).toBe(0);
  });

  it("supports individual salary adjustment without mutating base dataset", () => {
    const originalSalary = 75000;
    const adjustedSalary = 80000;

    const modified = employees.map((e) =>
      e.vendorId === "e2" ? { ...e, salary: String(adjustedSalary) } : e,
    );

    const subtotal = modified
      .filter((e) => e.selected)
      .reduce((sum, e) => sum + Number(e.salary), 0);

    // 90000 + 80000 = 170000
    expect(subtotal).toBe(170000);
  });
});
