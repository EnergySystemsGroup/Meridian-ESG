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
  groups,
  value,
  onChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  className,
  multiple = false,
  listClassName,
}) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  // Normalize options: support both string[] and {value, label}[]
  const normalizedOptions = React.useMemo(() => {
    return options.map((opt) =>
      typeof opt === 'string' ? { value: opt, label: opt } : opt
    )
  }, [options])

  // Normalize value to always be array internally for easier handling
  const selectedValues = React.useMemo(() => {
    if (multiple) {
      return Array.isArray(value) ? value : []
    }
    return value ? [value] : []
  }, [value, multiple])

  // Lookup label for a stored value
  const getLabelForValue = React.useCallback((val) => {
    const found = normalizedOptions.find((o) => o.value === val)
    if (found) return found.label
    // Also check groups if available
    if (groups) {
      for (const group of groups) {
        const item = group.items?.find((i) =>
          typeof i === 'string' ? i === val : i.value === val
        )
        if (item) return typeof item === 'string' ? item : item.label
      }
    }
    return val
  }, [normalizedOptions, groups])

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

  const handleRemove = (valueToRemove, e) => {
    if (e) {
      e.stopPropagation()
    }
    if (multiple) {
      onChange(selectedValues.filter((v) => v !== valueToRemove))
    } else {
      onChange("")
    }
  }

  const handleToggleGroup = (groupItems, e) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    if (!multiple) return
    const allSelected = groupItems.every((item) => selectedValues.includes(item))
    if (allSelected) {
      onChange(selectedValues.filter((v) => !groupItems.includes(v)))
    } else {
      const newValues = [...new Set([...selectedValues, ...groupItems])]
      onChange(newValues)
    }
  }

  const displayValue = React.useMemo(() => {
    if (selectedValues.length === 0) {
      return placeholder
    }
    if (multiple) {
      return `${selectedValues.length} selected`
    }
    return getLabelForValue(selectedValues[0])
  }, [selectedValues, placeholder, multiple, getLabelForValue])

  // Build a descriptive trigger label for multi-select: first 1-2 items + "+N more"
  const triggerLabel = React.useMemo(() => {
    if (!multiple || selectedValues.length === 0) return null
    const maxShow = selectedValues.length > 3 ? 1 : 2
    const labels = selectedValues.slice(0, maxShow).map(getLabelForValue)
    const remaining = selectedValues.length - maxShow
    if (remaining > 0) {
      return { labels, remaining }
    }
    return { labels, remaining: 0 }
  }, [multiple, selectedValues, getLabelForValue])

  // Build filtered groups for grouped mode
  const filteredGroups = React.useMemo(() => {
    if (!groups) return null
    return groups.map((group) => {
      const items = (group.items || []).filter((item) => {
        const label = typeof item === 'string' ? item : item.label
        if (!searchValue) return true
        return label.toLowerCase().includes(searchValue.toLowerCase())
      })
      return { ...group, items }
    }).filter((group) => group.items.length > 0)
  }, [groups, searchValue])

  // Total items count for scope awareness
  const totalItemCount = React.useMemo(() => {
    if (groups) {
      return groups.reduce((sum, g) => sum + (g.items?.length || 0), 0)
    }
    return normalizedOptions.length
  }, [groups, normalizedOptions])

  return (
    <div className={cn("w-full", className)}>
      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-10 text-left font-normal"
          >
            <span className={cn(
              "truncate",
              selectedValues.length === 0 && "text-muted-foreground"
            )}>
              {selectedValues.length === 0 ? placeholder : (
                multiple && triggerLabel ? (
                  <span className="flex items-center gap-1 overflow-hidden">
                    {triggerLabel.labels.map((label, i) => (
                      <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-300 truncate max-w-[120px]">
                        {label}
                      </span>
                    ))}
                    {triggerLabel.remaining > 0 && (
                      <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                        +{triggerLabel.remaining} more
                      </span>
                    )}
                  </span>
                ) : (
                  displayValue
                )
              )}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" style={{ width: 'var(--radix-popover-trigger-width)' }}>
          <Command shouldFilter={false}>
            {/* Selection count header for multi-select */}
            {multiple && (
              <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/80">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {selectedValues.length} of {totalItemCount} selected
                </span>
                {selectedValues.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onChange([])}
                    className="text-xs font-medium text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 px-2 py-1 min-h-[28px] rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    aria-label="Clear all selections"
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}
            <CommandInput
              placeholder={searchPlaceholder}
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList className={cn(
              groups ? "max-h-[400px]" : "max-h-[300px]",
              listClassName
            )}>
              <CommandEmpty>
                <div className="flex flex-col items-center py-4 text-center">
                  <p className="text-sm text-muted-foreground">{emptyMessage}</p>
                </div>
              </CommandEmpty>

              {/* Grouped mode */}
              {filteredGroups ? (
                filteredGroups.map((group) => {
                  const groupItemValues = group.items.map((i) =>
                    typeof i === 'string' ? i : i.value
                  )
                  const allSelected = multiple && groupItemValues.every((v) => selectedValues.includes(v))

                  return (
                    <CommandGroup
                      key={group.label}
                      heading={
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                            {group.label}
                          </span>
                          {multiple && (
                            <button
                              type="button"
                              onPointerDown={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleToggleGroup(groupItemValues, e)
                              }}
                              className="text-[11px] font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 px-2 py-1 min-h-[28px] rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                              aria-label={allSelected ? `Deselect all ${group.label}` : `Select all ${group.label}`}
                            >
                              {allSelected ? 'Deselect all' : 'Select all'}
                            </button>
                          )}
                        </div>
                      }
                      className="[&_[cmdk-group-heading]]:sticky [&_[cmdk-group-heading]]:top-0 [&_[cmdk-group-heading]]:bg-popover [&_[cmdk-group-heading]]:z-10 [&_[cmdk-group-heading]]:border-b [&_[cmdk-group-heading]]:border-neutral-100 [&_[cmdk-group-heading]]:dark:border-neutral-800"
                    >
                      {group.items.map((item) => {
                        const itemValue = typeof item === 'string' ? item : item.value
                        const itemLabel = typeof item === 'string' ? item : item.label
                        const isSelected = selectedValues.includes(itemValue)
                        return (
                          <CommandItem
                            key={itemValue}
                            value={itemValue}
                            onSelect={(selectedValue) => {
                              // cmdk lowercases values, so find actual
                              const actual = groupItemValues.find(
                                (v) => v.toLowerCase() === selectedValue.toLowerCase()
                              )
                              if (actual) handleSelect(actual)
                            }}
                            className="rounded-md px-3 py-2 text-[13px]"
                          >
                            {multiple ? (
                              <div className={cn(
                                "mr-2 h-4 w-4 rounded-[4px] border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                                isSelected
                                  ? "bg-blue-500 border-blue-500"
                                  : "border-neutral-300 dark:border-neutral-600"
                              )}>
                                {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                              </div>
                            ) : (
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4 flex-shrink-0",
                                  isSelected ? "opacity-100 text-blue-500" : "opacity-0"
                                )}
                              />
                            )}
                            {itemLabel}
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  )
                })
              ) : (
                /* Flat mode (original behavior) */
                <CommandGroup>
                  {normalizedOptions
                    .filter((opt) => {
                      if (!searchValue) return true
                      return opt.label.toLowerCase().includes(searchValue.toLowerCase())
                    })
                    .map((opt) => {
                      const isSelected = selectedValues.includes(opt.value)
                      return (
                        <CommandItem
                          key={opt.value}
                          value={opt.value}
                          onSelect={(selectedValue) => {
                            const actualOpt = normalizedOptions.find(
                              (o) => o.value.toLowerCase() === selectedValue.toLowerCase()
                            )
                            if (actualOpt) {
                              handleSelect(actualOpt.value)
                            }
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              isSelected ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {opt.label}
                        </CommandItem>
                      )
                    })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
