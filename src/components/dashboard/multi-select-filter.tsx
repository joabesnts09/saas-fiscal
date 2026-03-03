"use client";

import { ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type MultiSelectFilterProps = {
  label: string;
  options: string[];
  selected: string[];
  onSelectionChange: (selected: string[]) => void;
  placeholder?: string;
  formatOption?: (value: string) => string;
  className?: string;
};

export default function MultiSelectFilter({
  label,
  options,
  selected,
  onSelectionChange,
  placeholder = "Todos",
  formatOption = (v) => v,
  className,
}: MultiSelectFilterProps) {
  const allSelected = selected.length === 0 || selected.length === options.length;

  const toggleOption = (value: string) => {
    const isChecked = selected.length === 0 || selected.includes(value);
    if (isChecked) {
      if (selected.length === 0) {
        onSelectionChange(options.filter((o) => o !== value));
      } else {
        onSelectionChange(selected.filter((v) => v !== value));
      }
    } else {
      onSelectionChange([...selected, value]);
    }
  };

  const toggleAll = () => {
    onSelectionChange(options.length > 0 ? options : []);
  };

  const triggerLabel =
    selected.length === 0
      ? placeholder
      : selected.length === options.length
        ? placeholder
        : `${selected.length} selecionado(s)`;

  return (
    <div className={cn("grid gap-2", className)}>
      <label className="text-xs text-slate-500">{label}</label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-9 w-[180px] justify-between border-slate-200 bg-white px-3 font-normal text-slate-700 hover:bg-slate-50"
          >
            <span className="truncate text-left">{triggerLabel}</span>
            <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[280px] w-[240px] overflow-y-auto">
          <DropdownMenuLabel className="flex items-center justify-between py-1">
            <span className="text-xs font-medium">Selecionar</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={allSelected}
            onCheckedChange={toggleAll}
            onSelect={(e) => e.preventDefault()}
          >
            <span className="text-slate-500">{placeholder}</span>
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {options.map((value) => {
            const isChecked = selected.length === 0 || selected.includes(value);
            return (
              <DropdownMenuCheckboxItem
                key={value}
                checked={isChecked}
                onCheckedChange={() => toggleOption(value)}
                onSelect={(e) => e.preventDefault()}
              >
                {formatOption(value)}
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
