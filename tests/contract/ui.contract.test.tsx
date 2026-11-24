// @vitest-environment jsdom
import { BankInvoice } from "@/layouts/components/documents/bank-invoice";
import { CForm } from "@/layouts/components/documents/c-form";
import SearchableClientSelect from "@/layouts/components/forms/searchable-client-select";
import SearchableVendorSelect from "@/layouts/components/forms/searchable-vendor-select";
import { ConfirmDeleteModal } from "@/layouts/components/modals/confirm-delete-modal";
import type { Client, Invoice, PaymentAccount, Vendor } from "@/types";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("UI Document & Component Contract Suite", () => {
  beforeEach(() => {
    // JSDOM does not implement scrollIntoView
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  const mockClient: Client = {
    id: "c1",
    name: "Envato Pty Ltd",
    address: "PO Box 16122, Collins Street West, VIC 8007, Australia",
    tax_id: "AU12345678",
    bank_name: "ANZ Bank",
    bank_address: "Melbourne, Australia",
  };

  const mockInvoice: Invoice = {
    id: "inv_1",
    client_id: "c1",
    invoice_number: "TF-2026-11-24-01",
    invoice_date: "2026-11-24",
    amount: 5000,
    received_amount: 4985,
    currency: "USD",
    description: "UI/UX Theme Template Design & Web Development",
    payment_methods: ["pa_1"],
  };

  const mockPaymentAccounts: PaymentAccount[] = [
    {
      id: "pa_1",
      bank_name: "Standard Chartered Bank",
      bank_address: "67 Gulshan Avenue, Gulshan, Dhaka, Bangladesh",
      name_on_account: "Themefisher",
      bic_swift: "SCBLBDDXXXX",
      account_number: "0001914137101",
    },
    {
      id: "pa_2",
      bank_name: "BRAC Bank PLC",
      bank_address: "Gulshan-1, Dhaka, Bangladesh",
      name_on_account: "Themefisher",
      bic_swift: "BRAKBDDHXXX",
      account_number: "1501203456789001",
    },
  ];

  describe("BankInvoice Document Component", () => {
    it("renders invoice header, BIN number, client address, and sales period", () => {
      render(
        <BankInvoice
          invoice={mockInvoice}
          client={mockClient}
          paymentAccounts={mockPaymentAccounts}
        />,
      );

      // Header & Meta
      expect(screen.getByText("Invoice")).toBeDefined();
      expect(screen.getByText("TF-2026-11-24-01")).toBeDefined();
      expect(screen.getByText("BIN: 003271347")).toBeDefined();

      // Client details
      expect(screen.getByText("Envato Pty Ltd")).toBeDefined();
      expect(screen.getByText("VAT/Tax ID: AU12345678")).toBeDefined();

      // Currency & Order details
      expect(screen.getByText("CURRENCY-")).toBeDefined();
      const descriptions = screen.getAllByText(
        "UI/UX Theme Template Design & Web Development",
      );
      expect(descriptions.length).toBeGreaterThan(0);

      // Sales Period: 1-Nov-2026 - 30-Nov-2026
      expect(screen.getByText(/1-Nov-2026/)).toBeDefined();
      expect(screen.getByText(/30-Nov-2026/)).toBeDefined();

      // Billing Amount
      const amounts = screen.getAllByText("5000.00");
      expect(amounts.length).toBeGreaterThan(0);

      // Signing authority
      expect(screen.getByText("Mehedi Sharif")).toBeDefined();
      expect(screen.getByText("Founder")).toBeDefined();
    });

    it("renders multiple receiving bank accounts when invoice includes multiple payment methods", () => {
      const multiAccountInvoice: Invoice = {
        ...mockInvoice,
        payment_methods: ["pa_1", "pa_2"],
      };

      render(
        <BankInvoice
          invoice={multiAccountInvoice}
          client={mockClient}
          paymentAccounts={mockPaymentAccounts}
        />,
      );

      expect(screen.getByText("Standard Chartered Bank")).toBeDefined();
      expect(screen.getByText("BRAC Bank PLC")).toBeDefined();
      expect(screen.getByText("0001914137101")).toBeDefined();
      expect(screen.getByText("1501203456789001")).toBeDefined();
    });
  });

  describe("CForm Document Component", () => {
    it("renders Form-C declaration, formatted foreign remittance amount, and statutory purpose", () => {
      render(
        <CForm
          invoice={mockInvoice}
          client={mockClient}
          paymentAccounts={mockPaymentAccounts}
        />,
      );

      // Title
      expect(screen.getByText("Form–C (ICT)")).toBeDefined();
      expect(
        screen.getByText(
          /Declaration for inward remittance on account of ICT/,
        ),
      ).toBeDefined();

      // Prioritizes net received amount (4985.00)
      expect(screen.getByText("4,985.00")).toBeDefined();

      // Remitter details
      expect(screen.getByText("Envato Pty Ltd")).toBeDefined();
      expect(screen.getByText("ANZ Bank")).toBeDefined();
      expect(screen.getByText("TF-2026-11-24-01")).toBeDefined();

      // Code 2410 Purpose declaration
      expect(screen.getByText(/Information Technology Enabled Services/)).toBeDefined();

      // Authorized Dealer section
      expect(screen.getByText("(for AD’s use only)")).toBeDefined();
    });
  });

  describe("SearchableClientSelect Component", () => {
    it("opens dropdown on click, filters clients by search query, and fires onChange", () => {
      const handleChange = vi.fn();
      const clients: Client[] = [
        mockClient,
        {
          id: "c2",
          name: "FastSpring",
          address: "Santa Barbara, CA, USA",
          bank_name: "Wells Fargo",
          bank_address: "California",
        },
      ];

      render(
        <SearchableClientSelect
          clients={clients}
          value=""
          onChange={handleChange}
          placeholder="Select a client..."
        />,
      );

      // Initial state
      expect(screen.getByText("Select a client...")).toBeDefined();

      // Click to open
      const triggerButton = screen.getByRole("button");
      fireEvent.click(triggerButton);

      // Search input appears
      const searchInput = screen.getByPlaceholderText(
        "Search by client name, tax ID, bank...",
      );
      expect(searchInput).toBeDefined();

      // Filter for FastSpring
      fireEvent.change(searchInput, { target: { value: "Fast" } });
      expect(screen.getByText("FastSpring")).toBeDefined();
      expect(screen.queryByText("Envato Pty Ltd")).toBeNull();

      // Select option
      fireEvent.click(screen.getByText("FastSpring"));
      expect(handleChange).toHaveBeenCalledWith("c2");
    });
  });

  describe("SearchableVendorSelect Component", () => {
    it("filters out hidden vendors and fires onChange on selection", () => {
      const handleChange = vi.fn();
      const vendors: Vendor[] = [
        {
          id: "v1",
          receiver_name: "Visible Vendor",
          account_number: "111222333",
          bank_name: "BRAC Bank",
          branch_name: "Gulshan",
          routing_number: "060261111",
          is_hidden: false,
        },
        {
          id: "v2",
          receiver_name: "Archived Vendor",
          account_number: "999888777",
          bank_name: "Dutch-Bangla Bank",
          branch_name: "Dhanmondi",
          routing_number: "090272222",
          is_hidden: true, // hidden!
        },
      ];

      render(
        <SearchableVendorSelect
          vendors={vendors}
          value={null}
          onChange={handleChange}
          placeholder="Search receiver..."
        />,
      );

      const triggerButton = screen.getByRole("button");
      fireEvent.click(triggerButton);

      // Only visible vendor appears
      expect(screen.getByText("Visible Vendor")).toBeDefined();
      expect(screen.queryByText("Archived Vendor")).toBeNull();

      fireEvent.click(screen.getByText("Visible Vendor"));
      expect(handleChange).toHaveBeenCalledWith("v1");
    });
  });

  describe("ConfirmDeleteModal Component", () => {
    it("handles cancel, confirm, and isDeleting loading state", () => {
      const handleClose = vi.fn();
      const handleConfirm = vi.fn();

      const { rerender } = render(
        <ConfirmDeleteModal
          isOpen={true}
          onClose={handleClose}
          onConfirm={handleConfirm}
          title="Delete Invoice"
          description="Are you sure you want to permanently delete this invoice?"
          isDeleting={false}
        />,
      );

      expect(screen.getByText("Delete Invoice")).toBeDefined();
      expect(
        screen.getByText("Are you sure you want to permanently delete this invoice?"),
      ).toBeDefined();

      // Cancel button
      fireEvent.click(screen.getByText("Cancel"));
      expect(handleClose).toHaveBeenCalled();

      // Confirm button
      fireEvent.click(screen.getByText("Delete"));
      expect(handleConfirm).toHaveBeenCalled();

      // Re-render in deleting state
      rerender(
        <ConfirmDeleteModal
          isOpen={true}
          onClose={handleClose}
          onConfirm={handleConfirm}
          title="Delete Invoice"
          description="Are you sure you want to permanently delete this invoice?"
          isDeleting={true}
        />,
      );

      expect(screen.getByText("Deleting...")).toBeDefined();
    });
  });
});
