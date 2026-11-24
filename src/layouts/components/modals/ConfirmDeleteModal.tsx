"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Modal } from "./Modal";

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onHide?: () => void;
  title?: string;
  description?: string;
  itemName?: string;
  isDeleting?: boolean;
  isHiding?: boolean;
}

export function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  onHide,
  title = "Delete Item?",
  description = "Are you sure you want to remove this item? This action cannot be undone.",
  itemName,
  isDeleting = false,
  isHiding = false,
}: ConfirmDeleteModalProps) {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      icon={<AlertTriangle className="size-5 text-destructive" />}
      maxWidth="sm"
    >
      <div className="p-6 text-center flex flex-col gap-5">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>

        {itemName && (
          <div>
            <Badge
              variant="destructive"
              className="py-1 px-3 text-xs font-semibold"
            >
              {itemName}
            </Badge>
          </div>
        )}

        <div
          className={`flex items-center gap-3 pt-2 ${onHide ? "flex-col sm:flex-row" : ""}`}
        >
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isDeleting || isHiding}
            className="flex-1 w-full"
          >
            Cancel
          </Button>

          {onHide && (
            <Button
              type="button"
              variant="outline"
              onClick={onHide}
              disabled={isDeleting || isHiding}
              className="flex-1 w-full"
            >
              {isHiding ? "Hiding..." : "Hide Instead"}
            </Button>
          )}

          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting || isHiding}
            className="flex-1 w-full"
          >
            <Trash2 className="size-4" />
            <span>{isDeleting ? "Deleting..." : "Delete"}</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
