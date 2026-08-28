export const EVENT_CATEGORIES = ['comedy', 'concert', 'sports'] as const
export type EventCategory = (typeof EVENT_CATEGORIES)[number]
