import { ArrowLeft } from "lucide-react"
import React from "react"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"

export interface NavPageLayoutProps {
  title: string
  description?: string
  onBack?: () => void
  backLabel?: string
  children: React.ReactNode
  
  // View toggles
  viewMode?: "cards" | "table"
  onViewModeChange?: (mode: "cards" | "table") => void
  showViewToggle?: boolean
  
  // Action buttons
  actionButtons?: React.ReactNode[]
  primaryAction?: React.ReactNode
  
  // Header badges/indicators  
  headerBadge?: React.ReactNode
  itemCount?: number
  
  // Layout options
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "6xl" | "7xl"
  padding?: "sm" | "md" | "lg"
  showSubnav?: boolean
  subnav?: React.ReactNode
}

export function NavPageLayout({
  title,
  description,
  onBack,
  backLabel = "Back",
  children,
  viewMode = "cards",
  onViewModeChange,
  showViewToggle = false,
  actionButtons = [],
  primaryAction,
  headerBadge,
  itemCount,
  maxWidth = "6xl",
  padding = "md",
  showSubnav = false,
  subnav,
}: NavPageLayoutProps) {
  const maxWidthClass = {
    sm: "max-w-sm",
    md: "max-w-md", 
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "6xl": "max-w-6xl",
    "7xl": "max-w-7xl",
  }[maxWidth]

  const paddingClass = {
    sm: "px-4 py-4",
    md: "px-6 py-8", 
    lg: "px-8 py-12",
  }[padding]

  return (
    <div className="relative min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Optional Subnav */}
      {showSubnav && subnav}

      {/* Header */}
      <div className="border-gray-200 border-b bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className={`mx-auto ${maxWidthClass} ${paddingClass}`}>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            {/* Left side: Back button + Title */}
            <div className="flex items-center gap-4">
              {onBack && (
                <Button variant="ghost" size="sm" onClick={onBack} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {backLabel}
                </Button>
              )}
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="font-semibold text-2xl text-gray-900 dark:text-white">
                    {title}
                  </h1>
                  {itemCount !== undefined && (
                    <Badge variant="secondary" className="text-xs font-medium">
                      {itemCount}
                    </Badge>
                  )}
                  {headerBadge}
                </div>
                {description && (
                  <p className="mt-1 text-gray-500 text-sm dark:text-gray-400">
                    {description}
                  </p>
                )}
              </div>
            </div>

            {/* Right side: View toggles + Actions */}
            <div className="flex flex-col items-end gap-3">
              {/* View Mode Toggle */}
              {showViewToggle && onViewModeChange && (
                <div className="flex rounded-md border border-gray-200 bg-gray-50 p-1 dark:border-gray-600 dark:bg-gray-700">
                  <button
                    onClick={() => onViewModeChange("cards")}
                    className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                      viewMode === "cards"
                        ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white"
                        : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                    }`}
                  >
                    Cards
                  </button>
                  <button
                    onClick={() => onViewModeChange("table")}
                    className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                      viewMode === "table"
                        ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white"
                        : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                    }`}
                  >
                    Table
                  </button>
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                {actionButtons}
                {primaryAction}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`mx-auto ${maxWidthClass} ${paddingClass}`}>
        {children}
      </div>
    </div>
  )
}

export default NavPageLayout