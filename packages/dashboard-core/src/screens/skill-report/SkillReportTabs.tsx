"use client";

import type { ReactNode } from "react";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@selftune/ui/primitives";

export interface SkillReportTabDefinition {
  value: string;
  label: ReactNode;
  badge?: ReactNode;
  tooltip?: ReactNode;
  content: ReactNode;
  hidden?: boolean;
  contentClassName?: string;
}

export interface SkillReportTabsProps {
  tabs: SkillReportTabDefinition[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

const TRIGGER_CLASS_NAME =
  "rounded-lg px-3 font-headline text-xs uppercase tracking-wider data-active:bg-background/70 data-active:text-foreground";

export function SkillReportTabs({
  tabs,
  value,
  defaultValue,
  onValueChange,
}: SkillReportTabsProps) {
  const visibleTabs = tabs.filter((tab) => !tab.hidden);
  if (visibleTabs.length === 0) return null;

  const firstValue = visibleTabs[0]?.value;
  const tabsProps =
    value !== undefined
      ? { value, onValueChange }
      : { defaultValue: defaultValue ?? firstValue, onValueChange };

  return (
    <Tabs {...tabsProps}>
      <TabsList
        variant="line"
        className="rounded-xl border border-border/10 bg-muted/20 px-1.5 py-1"
      >
        {visibleTabs.map((tab) => {
          const triggerChildren = (
            <>
              {tab.label}
              {tab.badge}
            </>
          );

          return tab.tooltip ? (
            <Tooltip key={tab.value}>
              <TooltipTrigger
                render={<TabsTrigger value={tab.value} className={TRIGGER_CLASS_NAME} />}
              >
                {triggerChildren}
              </TooltipTrigger>
              <TooltipContent>{tab.tooltip}</TooltipContent>
            </Tooltip>
          ) : (
            <TabsTrigger key={tab.value} value={tab.value} className={TRIGGER_CLASS_NAME}>
              {triggerChildren}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {visibleTabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className={tab.contentClassName}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
