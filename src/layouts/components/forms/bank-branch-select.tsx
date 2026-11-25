"use client";

import { getBankNames, getBranchesByBank } from "@/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCallback, useEffect, useId, useState } from "react";
import type { StylesConfig } from "react-select";
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
  variant?: "default" | "compact";
  disabled?: boolean;
}

function getSelectStyles<T extends OptionType>(
  isCompact: boolean,
): StylesConfig<T, false> {
  const fontSize = isCompact ? "0.75rem" : "0.875rem";
  return {
    control: (base, state) => ({
      ...base,
      minHeight: isCompact ? "34px" : "40px",
      borderRadius: "var(--radius)",
      borderColor: "var(--input)",
      backgroundColor: "var(--background)",
      boxShadow: state.isFocused
        ? "0 0 0 2px var(--background), 0 0 0 4px var(--ring)"
        : "none",
      fontSize,
      cursor: state.isDisabled ? "not-allowed" : "pointer",
      opacity: state.isDisabled ? 0.5 : 1,
      "&:hover": {
        borderColor: "var(--input)",
      },
    }),
    valueContainer: (base) => ({
      ...base,
      padding: "0 12px",
    }),
    menu: (base) => ({
      ...base,
      borderRadius: "var(--radius)",
      backgroundColor: "var(--popover)",
      border: "1px solid var(--border)",
      overflow: "hidden",
      zIndex: 50,
      boxShadow:
        "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
    }),
    option: (base, state) => ({
      ...base,
      fontSize,
      backgroundColor: state.isSelected
        ? "var(--primary)"
        : state.isFocused
          ? "var(--muted)"
          : "transparent",
      color: state.isSelected
        ? "var(--primary-foreground)"
        : "var(--popover-foreground)",
      cursor: "pointer",
      "&:active": {
        backgroundColor: state.isSelected ? "var(--primary)" : "var(--muted)",
      },
    }),
    placeholder: (base) => ({
      ...base,
      fontSize,
      margin: 0,
      color: "var(--muted-foreground)",
    }),
    singleValue: (base) => ({
      ...base,
      fontSize,
      margin: 0,
      color: "var(--foreground)",
    }),
    input: (base) => ({
      ...base,
      fontSize,
      margin: 0,
      padding: 0,
      color: "var(--foreground)",
    }),
    indicatorSeparator: (base) => ({
      ...base,
      backgroundColor: "var(--border)",
    }),
    dropdownIndicator: (base) => ({
      ...base,
      padding: isCompact ? "0 6px" : "0 8px",
      color: "var(--muted-foreground)",
      "&:hover": { color: "var(--foreground)" },
    }),
    clearIndicator: (base) => ({
      ...base,
      padding: isCompact ? "0 4px" : "0 6px",
      color: "var(--muted-foreground)",
      "&:hover": { color: "var(--foreground)" },
    }),
  };
}

export default function BankBranchSelect({
  bankName,
  branchName,
  routingNumber,
  onBankChange,
  onBranchChange,
  onRoutingChange,
  variant = "default",
  disabled = false,
}: BankBranchSelectProps) {
  const isCompact = variant === "compact";
  const selectId = useId();
  const bankStyles = getSelectStyles<OptionType>(isCompact);
  const branchStyles = getSelectStyles<BranchOption>(isCompact);
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

  const wrapperClass = isCompact ? "space-y-1" : "flex flex-col gap-1.5";
  const labelClass = isCompact
    ? "text-xs font-medium"
    : "text-sm font-normal text-text-strong";
  const routingId = `${selectId}-routing`;

  return (
    <>
      <div className={wrapperClass}>
        <Label htmlFor={`${selectId}-bank-input`} className={labelClass}>
          Bank Name
        </Label>
        <CreatableSelect<OptionType>
          instanceId={`${selectId}-bank`}
          inputId={`${selectId}-bank-input`}
          isClearable
          isDisabled={disabled}
          isLoading={loadingBanks}
          options={bankOptions}
          value={bankValue}
          onChange={handleBankSelect}
          onCreateOption={(value) => handleBankSelect({ label: value, value })}
          placeholder="Type to search or add bank..."
          formatCreateLabel={(input) => `Use custom: "${input}"`}
          styles={bankStyles}
          noOptionsMessage={() => "No banks found"}
        />
      </div>
      <div className={wrapperClass}>
        <Label htmlFor={`${selectId}-branch-input`} className={labelClass}>
          Branch Name
        </Label>
        <CreatableSelect<BranchOption>
          instanceId={`${selectId}-branch`}
          inputId={`${selectId}-branch-input`}
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
          styles={branchStyles}
          isDisabled={disabled || !bankName}
          noOptionsMessage={() =>
            bankName ? "No branches found" : "Select a bank first"
          }
        />
      </div>
      <div className={wrapperClass}>
        <Label htmlFor={routingId} className={labelClass}>
          Routing Number
        </Label>
        <Input
          id={routingId}
          required
          type="text"
          value={routingNumber}
          onChange={(e) => onRoutingChange(e.target.value)}
          disabled={disabled}
          className={isCompact ? "text-xs h-8.5 bg-background" : "bg-background"}
          placeholder="Auto-fills or enter manually"
        />
      </div>
    </>
  );
}
