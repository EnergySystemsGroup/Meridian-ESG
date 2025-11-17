"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function Combobox({
  options = [],
  value,
  onChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  className,
  multiple = false,
}) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  // Normalize value to always be array internally for easier handling
  const selectedValues = React.useMemo(() => {
    if (multiple) {
      return Array.isArray(value) ? value : []
    }
    return value ? [value] : []
  }, [value, multiple])

  const handleSelect = (currentValue) => {
    if (multiple) {
      const newValues = selectedValues.includes(currentValue)
        ? selectedValues.filter((v) => v !== currentValue)
        : [...selectedValues, currentValue]
      onChange(newValues)
    } else {
      onChange(currentValue === value ? "" : currentValue)
      setOpen(false)
    }
  }

  const handleRemove = (valueToRemove) => {
    if (multiple) {
      onChange(selectedValues.filter((v) => v !== valueToRemove))
    } else {
      onChange("")
    }
  }

  const displayValue = React.useMemo(() => {
    if (selectedValues.length === 0) {
      return placeholder
    }
    if (multiple) {
      return `${selectedValues.length} selected`
    }
    return selectedValues[0]
  }, [selectedValues, placeholder, multiple])

  return (
    <div className={cn("w-full", className)}>
      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-[2.5rem] text-left font-normal"
          >
            <div className="flex flex-wrap gap-1 flex-1">
              {selectedValues.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : multiple ? (
                selectedValues.map((val) => (
                  <span
                    key={val}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-sm"
                  >
                    {val}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemove(val)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          e.stopPropagation()
                          handleRemove(val)
                        }
                      }}
                      aria-label={`Remove ${val}`}
                      className="cursor-pointer hover:opacity-70 focus:outline-none focus:ring-1 focus:ring-primary rounded-sm p-0.5 -m-0.5"
                    >
                      <X className="h-3 w-3" />
                    </div>
                  </span>
                ))
              ) : (
                <span>{displayValue}</span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" style={{ width: 'var(--radix-popover-trigger-width)' }}>
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={searchPlaceholder}
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {options
                  .filter((option) => {
                    // Manual filtering since we disabled cmdk's filter
                    if (!searchValue) return true
                    return option.toLowerCase().includes(searchValue.toLowerCase())
                  })
                  .map((option) => {
                    const isSelected = selectedValues.includes(option)
                    return (
                      <CommandItem
                        key={option}
                        value={option}
                        onSelect={(selectedValue) => {
                          // cmdk lowercases values, so find the actual option
                          const actualOption = options.find(
                            opt => opt.toLowerCase() === selectedValue.toLowerCase()
                          )
                          if (actualOption) {
                            handleSelect(actualOption)
                          }
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {option}
                      </CommandItem>
                    )
                  })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
