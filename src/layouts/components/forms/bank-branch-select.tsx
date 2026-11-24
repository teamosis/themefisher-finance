"use client";

import { getBankNames, getBranchesByBank } from "@/actions";
import { useCallback, useEffect, useState } from "react";
import CreatableSelect from "react-select/creatable";

interface OptionType {
  label: string;
  value: string;
}

interface BranchOption extends OptionType {
  branchName: string;
  routingNumber?: string;
}

interface BankBranchSelectProps {
  bankName: string;
  branchName: string;
  routingNumber: string;
  onBankChange: (value: string) => void;
  onBranchChange: (value: string) => void;
  onRoutingChange: (value: string) => void;
}

const selectStyles = {
  control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
    ...base,
    borderRadius: "0.75rem",
    borderColor: state.isFocused ? "#3b82f6" : "#e2e8f0",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(59,130,246,0.3)" : "none",
    fontSize: "0.875rem",
    minHeight: "38px",
    "&:hover": { borderColor: "#3b82f6" },
  }),
  menu: (base: Record<string, unknown>) => ({
    ...base,
    borderRadius: "0.75rem",
    overflow: "hidden",
    zIndex: 50,
    boxShadow:
      "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
  }),
  option: (
    base: Record<string, unknown>,
    state: { isFocused: boolean; isSelected: boolean },
  ) => ({
    ...base,
    fontSize: "0.875rem",
    backgroundColor: state.isSelected
      ? "#3b82f6"
      : state.isFocused
        ? "#eff6ff"
        : "white",
    color: state.isSelected ? "white" : "#1e293b",
    "&:active": { backgroundColor: "#dbeafe" },
  }),
  placeholder: (base: Record<string, unknown>) => ({
    ...base,
    fontSize: "0.875rem",
    color: "#94a3b8",
  }),
  singleValue: (base: Record<string, unknown>) => ({
    ...base,
    fontSize: "0.875rem",
  }),
  input: (base: Record<string, unknown>) => ({
    ...base,
    fontSize: "0.875rem",
  }),
};

export default function BankBranchSelect({
  bankName,
  branchName,
  routingNumber,
  onBankChange,
  onBranchChange,
  onRoutingChange,
}: BankBranchSelectProps) {
  const [bankOptions, setBankOptions] = useState<OptionType[]>([]);
  const [loadedBranches, setLoadedBranches] = useState<{
    bankName: string;
    options: BranchOption[];
  }>();
  const [loadingBanks, setLoadingBanks] = useState(false);

  // Fetch distinct bank names on mount
  useEffect(() => {
    let cancelled = false;
    async function fetchBanks() {
      setLoadingBanks(true);
      try {
        const data = await getBankNames();
        if (!cancelled && data) {
          setBankOptions(data.map((b: string) => ({ label: b, value: b })));
        }
      } catch (err) {
        console.error("Error fetching banks:", err);
      }
      if (!cancelled) setLoadingBanks(false);
    }
    void fetchBanks();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!bankName) return;
    let cancelled = false;

    async function fetchBranches() {
      try {
        const branches = await getBranchesByBank(bankName);
        if (cancelled) return;
        setLoadedBranches({
          bankName,
          options: branches.map(
            ({ branchName, districtName, routingNumber }) => ({
              label: `${branchName} (${districtName}) · ${routingNumber}`,
              value: routingNumber,
              branchName,
              routingNumber,
            }),
          ),
        });
      } catch (err) {
        if (!cancelled) setLoadedBranches({ bankName, options: [] });
        console.error("Error fetching branches:", err);
      }
    }

    void fetchBranches();
    return () => {
      cancelled = true;
    };
  }, [bankName]);

  const handleBankSelect = useCallback(
    (option: OptionType | null) => {
      onBankChange(option?.value ?? "");
      onBranchChange("");
      onRoutingChange("");
    },
    [onBankChange, onBranchChange, onRoutingChange],
  );

  const handleBranchSelect = (option: BranchOption | null) => {
    onBranchChange(option?.branchName ?? "");
    onRoutingChange(option?.routingNumber ?? "");
  };

  const branchOptions =
    loadedBranches?.bankName === bankName ? loadedBranches.options : [];
  const bankValue = bankName ? { label: bankName, value: bankName } : null;
  const branchValue = branchName
    ? (branchOptions.find(
        (option) =>
          option.routingNumber === routingNumber &&
          option.branchName === branchName,
      ) ?? { label: branchName, value: branchName, branchName })
    : null;

  return (
    <>
      <div>
        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
          Bank Name
        </label>
        <CreatableSelect
          isClearable
          isLoading={loadingBanks}
          options={bankOptions}
          value={bankValue}
          onChange={handleBankSelect}
          onCreateOption={(value) => handleBankSelect({ label: value, value })}
          placeholder="Type to search or add bank..."
          formatCreateLabel={(input) => `Use custom: "${input}"`}
          styles={selectStyles}
          noOptionsMessage={() => "No banks found"}
        />
      </div>
      <div>
        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
          Branch Name
        </label>
        <CreatableSelect<BranchOption>
          isClearable
          isLoading={Boolean(bankName && loadedBranches?.bankName !== bankName)}
          options={branchOptions}
          value={branchValue}
          onChange={handleBranchSelect}
          onCreateOption={(value) =>
            handleBranchSelect({ label: value, value, branchName: value })
          }
          placeholder={
            bankName ? "Type to search or add branch..." : "Select a bank first"
          }
          formatCreateLabel={(input) => `Use custom: "${input}"`}
          styles={selectStyles}
          isDisabled={!bankName}
          noOptionsMessage={() =>
            bankName ? "No branches found" : "Select a bank first"
          }
        />
      </div>
      <div>
        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
          Routing Number
        </label>
        <input
          required
          type="text"
          value={routingNumber}
          onChange={(e) => onRoutingChange(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          placeholder="Auto-fills or enter manually"
        />
      </div>
    </>
  );
}
