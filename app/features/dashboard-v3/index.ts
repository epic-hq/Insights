/**
 * Dashboard V3 - Redesigned dashboard with state-aware UI
 *
 * Key features:
 * - Empty state: Onboarding experience without sidebar
 * - Processing state: Progress indicator with partial dashboard
 * - Active state: Full dashboard with tasks, insights, and lens feed
 */

export type { ActiveDashboardProps } from "./components/ActiveDashboard";
export { ActiveDashboard } from "./components/ActiveDashboard";
export type { DashboardShellProps, DashboardState } from "./components/DashboardShell";
// Main components
export { DashboardShell, shouldShowSidebar } from "./components/DashboardShell";
export type { OnboardingDashboardProps } from "./components/OnboardingDashboard";
export { OnboardingDashboard } from "./components/OnboardingDashboard";
export type { OnboardingTask, OnboardingTaskCardProps } from "./components/onboarding/OnboardingTaskCard";
// Onboarding components
export { OnboardingTaskCard } from "./components/onboarding/OnboardingTaskCard";
export type { WelcomeHeaderProps } from "./components/onboarding/WelcomeHeader";
export { WelcomeHeader } from "./components/onboarding/WelcomeHeader";
export type { ContextPanelProps } from "./components/sections/ContextPanel";
export { ContextPanel } from "./components/sections/ContextPanel";
export type { InsightsSectionProps } from "./components/sections/InsightsSection";
export { InsightsSection } from "./components/sections/InsightsSection";
export type { LensFeedProps } from "./components/sections/LensFeed";
export { LensFeed } from "./components/sections/LensFeed";
export type { TasksSectionProps } from "./components/sections/TasksSection";
// Section components
export { TasksSection } from "./components/sections/TasksSection";
export type { EmptyStateBoxProps } from "./components/shared/EmptyStateBox";
// Shared components
export { EmptyStateBox } from "./components/shared/EmptyStateBox";
export type { SectionHeaderProps } from "./components/shared/SectionHeader";
export { SectionHeader } from "./components/shared/SectionHeader";
export type { UseDashboardStateOptions, UseDashboardStateResult } from "./hooks/useDashboardState";
// Hooks
export { useDashboardState } from "./hooks/useDashboardState";
