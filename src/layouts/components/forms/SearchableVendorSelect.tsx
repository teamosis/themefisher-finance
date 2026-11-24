"use client";

import type { Vendor } from "@/types";
import { Check, ChevronDown, Search, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

interface SearchableVendorSelectProps {
  vendors: Vendor[];
  value: string | null;
  onChange: (vendorId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function SearchableVendorSelect({
  vendors,
  value,
  onChange,
  placeholder = "Search receiver...",
  disabled = false,
}: SearchableVendorSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedVendor = vendors.find((v) => v.id === value) || null;

  const filteredVendors = vendors.filter((v) => {
    if (v.is_hidden) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      v.receiver_name.toLowerCase().includes(query) ||
      v.account_number.toLowerCase().includes(query) ||
      v.bank_name.toLowerCase().includes(query) ||
      (v.branch_name && v.branch_name.toLowerCase().includes(query)) ||
      (v.routing_number && v.routing_number.toLowerCase().includes(query))
    );
  });

  const closeDropdown = () => {
    setIsOpen(false);
    setSearchQuery("");
    setHighlightedIndex(0);
  };

  const openDropdown = () => {
    if (disabled) return;
    setIsOpen(true);
    setSearchQuery("");
    if (value) {
      const idx = vendors.findIndex((v) => v.id === value);
      setHighlightedIndex(idx >= 0 ? idx : 0);
    } else {
      setHighlightedIndex(0);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        closeDropdown();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSelect = (vendorId: string) => {
    onChange(vendorId);
    closeDropdown();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    closeDropdown();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        openDropdown();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredVendors.length - 1 ? prev + 1 : 0,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredVendors.length - 1,
        );
        break;
      case "Enter":
        e.preventDefault();
        if (filteredVendors.length > 0 && filteredVendors[highlightedIndex]) {
          handleSelect(filteredVendors[highlightedIndex].id);
        }
        break;
      case "Escape":
      case "Tab":
        e.preventDefault();
        closeDropdown();
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => (isOpen ? closeDropdown() : openDropdown())}
        className={`w-full px-3 py-2 border rounded-xl text-left text-sm flex items-center justify-between transition-colors bg-background cursor-pointer ${
          disabled
            ? "bg-muted text-text-muted cursor-not-allowed border-border opacity-60"
            : isOpen
              ? "border-ring ring-2 ring-ring/20"
              : "border-input hover:border-border focus:border-ring focus:ring-2 focus:ring-ring/20"
        }`}
      >
        <div className="flex items-center min-w-0 flex-1 mr-2">
          {selectedVendor ? (
            <div className="min-w-0 flex-1">
              <span className="block truncate font-medium text-text-strong">
                {selectedVendor.receiver_name}
              </span>
              <span className="block truncate text-xs text-text-muted">
                {selectedVendor.bank_name} • A/C:{" "}
                {selectedVendor.account_number}
              </span>
            </div>
          ) : (
            <span className="text-text-muted truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {selectedVendor && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={handleClear}
              className="p-1 rounded-md text-text-muted hover:text-text-strong hover:bg-muted transition-colors cursor-pointer"
              title="Clear selection"
            >
              <X className="size-3.5" />
            </span>
          )}
          <ChevronDown
            className={`size-4 text-text-muted transition-transform duration-200 ${
              isOpen ? "rotate-180 text-primary" : ""
            }`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-card rounded-xl shadow-lg border border-border z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
          {/* Search Bar */}
          <div className="p-2 border-b border-border bg-muted/40 flex items-center gap-2">
            <Search className="size-4 text-text-muted shrink-0 ml-1.5" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search receiver, account, bank, routing..."
              className="w-full bg-transparent text-sm text-text-strong placeholder:text-text-muted focus:outline-hidden py-0.5"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="p-1 text-text-muted hover:text-text-strong rounded-md hover:bg-muted cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* List */}
          <ul
            ref={listRef}
            role="listbox"
            className="max-h-56 overflow-y-auto divide-y divide-border/40 p-1"
          >
            {filteredVendors.length === 0 ? (
              <li className="py-6 px-3 text-center text-xs text-text-muted">
                {searchQuery
                  ? `No receivers matching "${searchQuery}"`
                  : "No receiver accounts available"}
              </li>
            ) : (
              filteredVendors.map((v, index) => {
                const isSelected = v.id === value;
                const isHighlighted = index === highlightedIndex;

                return (
                  <li
                    key={v.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(v.id)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`px-3 py-2 rounded-lg cursor-pointer transition-colors flex items-center justify-between text-left ${
                      isSelected
                        ? "bg-primary/10 text-primary font-semibold"
                        : isHighlighted
                          ? "bg-muted text-text-strong"
                          : "text-text-default hover:bg-muted/50"
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="text-sm font-medium truncate">
                        {v.receiver_name}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5 truncate">
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px] text-text-strong">
                          {v.account_number}
                        </span>
                        <span>{v.bank_name}</span>
                        {v.branch_name && <span>({v.branch_name})</span>}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="size-4 text-primary shrink-0 ml-2" />
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
